// ─────────────────────────────────────────────────────────────────────────────
// epreuves — parsing/affichage des épreuves importées (colonne concours.liste_epreuves).
//
// 100% READ-ONLY sur la donnée DÉJÀ importée (CSV FFE). Aucune dépendance FFE,
// aucun scraping, aucun appel API. On n'invente JAMAIS d'épreuve : on nettoie et
// on découpe ce qui existe.
//
// La colonne `liste_epreuves` est un text[] (mig 074). Selon la source CSV elle
// peut contenir :
//   - soit un tableau déjà découpé (1 épreuve par élément),
//   - soit UN seul long élément FFE brut du type
//     "SO Amateur202614002 : Prix des As Jeunes Etape 1 (1,30 m)[A], Prix des As
//      Jeunes Etape 2 (1,35 m)[A] SO Préparatoire202614002 : Préparatoire (1,05 m)[P][A][C]"
// On gère les deux : on rejoint le tableau puis on redécoupe robustement.
// ─────────────────────────────────────────────────────────────────────────────

// En-tête de catégorie FFE collé au numéro de concours : "SO Amateur202614002 : ".
// (catégorie = un seul token suivi d'au moins 4 chiffres puis « : »). NE matche PAS
// les noms d'épreuves « SO Cycle Jeunes Poneys 6 ans C » (pas de num+« : »).
const FFE_CATEGORY_RE = /\bSO\s+[^\s:]*?\d{4,}\s*:\s*/g;

// Tags FFE entre crochets : [P] [A] [C] (poney/amateur/club, etc.).
const FFE_TAG_RE = /\[[A-Za-z]\]/g;

// Hauteur en fin de libellé : « (1,05 m) » ou « (0,95m) » → on l'extrait pour
// l'afficher proprement « — 1,05 m » (formatage seul, aucune invention).
const HEIGHT_RE = /\s*\((\d+[.,]\d+)\s*m\)\s*$/;

/**
 * Découpe + nettoie `liste_epreuves` (tableau OU chaîne longue) en libellés unitaires.
 * - séparateurs : « ; », saut de ligne, et virgule SAUF si décimale (ex « 1,05 »)
 * - retire en-têtes catégorie FFE + tags [P][A][C]
 * - normalise espaces doubles, trim, retire vides
 *
 * NB : on NE dédoublonne PAS. La FFE liste régulièrement deux fois un même libellé
 * (ex « Amateur 2 Spéciale au chrono (1,05 m) ») = épreuves distinctes courues sur
 * des sessions/jours différents. Dédoublonner les ferait disparaître à tort
 * (HARAS DE MADINE 202655009 : 47 épreuves réelles → 29 si dédup exact).
 */
export function parseEpreuves(raw: string[] | string | null | undefined): string[] {
  if (!raw) return [];
  const text = Array.isArray(raw) ? raw.join('\n') : raw;
  if (!text.trim()) return [];

  const cleaned = text
    .replace(/ /g, ' ')       // NBSP → espace
    .replace(FFE_CATEGORY_RE, '\n') // en-têtes catégorie → frontière
    .replace(FFE_TAG_RE, '');       // tags [P][A][C]

  return cleaned
    // « ; », saut de ligne, OU virgule non suivie d'un chiffre (préserve « 1,05 »)
    .split(/[;\n]|,(?!\s*\d)/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Nombre d'épreuves détectées (après nettoyage). */
export function countEpreuves(raw: string[] | string | null | undefined): number {
  return parseEpreuves(raw).length;
}

/** Formatage d'affichage : « Amateur 2 GP (1,05 m) » → « Amateur 2 GP — 1,05 m ». */
export function formatEpreuve(label: string): string {
  const m = label.match(HEIGHT_RE);
  if (!m) return label;
  return `${label.replace(HEIGHT_RE, '').trim()} — ${m[1]} m`;
}
