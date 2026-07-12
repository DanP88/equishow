// ─────────────────────────────────────────────────────────────────────────────
// encoding — décodage robuste des fichiers d'import (CSV/XLS→CSV FFE).
//
// Problème : les exports FFE / Excel arrivent dans des encodages variés :
//   - UTF-8 propre (cas standard, ex « fusion canonique ») → à NE PAS toucher
//   - Windows-1252 / Latin-1 (Excel FR) : « é » = octet 0xE9 → lu en UTF-8 =
//     octet invalide → caractère de remplacement U+FFFD
//   - double-encodé : la chaîne contient littéralement « PrÃ©paratoire » (octets
//     UTF-8 de « Ã© »), reliquat d'un fichier Latin-1 transcodé à tort en UTF-8
//
// Stratégie (lecture à l'OCTET, pas en texte) :
//   1. décoder en UTF-8 ; si pas d'octet invalide ni de marqueur mojibake → tel quel
//   2. octets invalides (U+FFFD) → re-décoder en Windows-1252
//   3. marqueurs « Ã©/Â° » sur un UTF-8 valide → réparer le double-encodage
//      (réinterpréter les chars comme octets Latin-1, redécoder UTF-8), conservé
//      seulement si ça supprime les marqueurs (jamais destructeur sinon).
//
// 100% lecture seule sur le contenu importé. Aucune dépendance React Native.
// ─────────────────────────────────────────────────────────────────────────────

const REPLACEMENT_CHAR = '�';

// Séquences typiques d'un texte FR double-encodé : « Ã » (U+00C3) ou « Â » (U+00C2)
// suivi d'un caractère Latin-1 0x80–0xBF (2e octet d'une séquence UTF-8 lue à tort) —
// couvre Ã©/Ã¨/Ã /Ã§/Ã´/Ã¢/Ãª/Ã®/Ã¼/Ã¹/Â°/Â… Le français correct ne contient ~jamais
// un « Ã »/« Â » isolé suivi de ces caractères.
const MOJIBAKE_RE = /[ÃÂ][-¿]/;

export function hasMojibakeMarkers(s: string): boolean {
  return MOJIBAKE_RE.test(s);
}

// Réinterprète chaque char (< 256) comme un octet Latin-1 puis décode en UTF-8.
// Renvoie null si la chaîne contient du vrai Unicode (char > 255) ou si le décodage
// UTF-8 strict échoue → on ne répare pas dans le doute.
function repairDoubleEncoded(s: string): string | null {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0xff) return null; // vrai caractère Unicode présent → ne pas toucher
    bytes[i] = c;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Décode les octets bruts d'un fichier importé en texte correct, en gérant
 * UTF-8 (par défaut), Windows-1252 (repli) et le double-encodage (réparation).
 * Un fichier UTF-8 propre ressort tel quel.
 */
export function decodeImportedText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder('utf-8').decode(bytes); // ignore BOM par défaut

  // (1) octets invalides UTF-8 (U+FFFD) → le fichier est Latin-1 / Windows-1252.
  if (utf8.includes(REPLACEMENT_CHAR)) {
    try {
      return new TextDecoder('windows-1252').decode(bytes);
    } catch {
      return utf8;
    }
  }

  // (2) UTF-8 valide mais double-encodé (« Ã© ») → réparation conservatrice.
  if (hasMojibakeMarkers(utf8)) {
    const repaired = repairDoubleEncoded(utf8);
    if (repaired && !hasMojibakeMarkers(repaired)) return repaired;
  }

  // (3) UTF-8 propre → inchangé.
  return utf8;
}
