// ─────────────────────────────────────────────────────────────────────────────
// categories — parsing de la colonne « categories » du CSV FFE.
//
// 100% READ-ONLY sur la donnée importée. On n'invente JAMAIS de catégorie :
// on découpe la chaîne brute, on nettoie, on dédoublonne.
//
// Format source FFE (colonne « categories ») = liste séparée par virgules :
//   "Club 2 Circuit Dpt, Club 1 Circuit Dpt, Poney Elite Circuit Dpt"
// On tolère aussi « ; » et les sauts de ligne comme séparateurs, par robustesse.
//
// Contrairement aux ÉPREUVES (lib/epreuves.ts, doublons FFE volontairement
// conservés car ce sont des passages distincts), les CATÉGORIES sont des libellés
// de classification → on DÉDOUBLONNE (un concours « propose » une catégorie 0/1 fois).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Découpe + nettoie la colonne « categories » en libellés unitaires dédupliqués.
 * - séparateurs : virgule, « ; », saut de ligne
 * - trim, normalisation des espaces multiples, NBSP → espace
 * - suppression des vides et des doublons (insensible à la casse/espaces)
 *   en conservant la 1ʳᵉ graphie rencontrée.
 */
export function parseCategories(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const text = raw.replace(/ /g, ' ');
  if (!text.trim()) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[;,\n]/)) {
    const label = part.replace(/\s+/g, ' ').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}
