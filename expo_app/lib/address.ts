// Extraction de la ville (commune) à partir d'une adresse.
//
// Source fiable : le champ structuré `address.city / town / village` renvoyé par
// Nominatim (`addressdetails=1`) — capté au moment de la sélection dans
// `AddressAutocomplete`. Ce module fournit :
//  - `extractCityFromAddress` : repli heuristique quand on n'a que le
//    `display_name` complet (adresses saisies à la main, annonces legacy).
//  - `displayCity` : renvoie la meilleure ville pour l'AFFICHAGE (privilégie la
//    valeur stockée si elle est correcte, sinon la dérive de l'adresse complète).

// Segments « voie / hiérarchie » à ignorer pour trouver la commune.
const STREET_RE =
  /^\d|^\d+\s*[;,\-–]\s*\d|\b(rue|avenue|av|boulevard|bd|place|pl|chemin|impasse|quai|all[ée]es?|cours|route|rte|quartier|lieu[-\s]?dit|zone|z\.?\s?[ai]\.?|rond[-\s]point|passage|square|villa|clos|hameau|r[ée]sidence|parc|voie|sentier|mail|esplanade|traverse|montée|descente)\b|arrondissement/i;

/**
 * Meilleure estimation de la commune à partir d'un `display_name` Nominatim
 * (« Place Morny, Deauville, Lisieux, Calvados, Normandie, …, 14800, France »
 *  → « Deauville »). Heuristique : premier segment qui ne ressemble pas à une
 * voie / un numéro / un arrondissement.
 */
export function extractCityFromAddress(full?: string | null): string {
  if (!full) return '';
  const parts = full
    .split(',')
    .map((p) => p.trim().replace(/^\d{4,6}\s+/, '').replace(/\s+\d{4,6}$/, '').trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  const city = parts.find((p) => !STREET_RE.test(p) && !/^\d/.test(p));
  return (city ?? parts.find((p) => !/^\d/.test(p)) ?? parts[0]).trim();
}

/**
 * Une valeur `ville_depart` / `ville_arrivee` stockée est « mauvaise » si elle
 * est vide, un pays, un code postal seul, ou un fragment de hiérarchie admin.
 */
export function isBadCity(s?: string | null): boolean {
  const v = (s ?? '').trim();
  if (!v || v === '—' || v === '-') return true;
  if (/^\d{4,6}$/.test(v)) return true;
  if (/^france(\s+m[ée]tropolitaine)?$/i.test(v)) return true;
  if (/m[ée]tropolitaine|arrondissement/i.test(v)) return true;
  return false;
}

/**
 * Ville à afficher : la valeur stockée si elle est correcte, sinon dérivée de
 * l'adresse complète (annonces legacy où `ville_depart` = « France »).
 */
export function displayCity(stored?: string | null, fullAddress?: string | null): string {
  if (!isBadCity(stored)) return (stored ?? '').trim();
  return extractCityFromAddress(fullAddress) || (stored ?? '').trim() || '—';
}
