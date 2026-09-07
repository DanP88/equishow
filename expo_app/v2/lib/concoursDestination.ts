// ─────────────────────────────────────────────────────────────────────────────
// v2/lib/concoursDestination — DESTINATION / ZONE d'un besoin lié à un concours.
//
// F15 §1 & §3 : quand un besoin (transport / box / coach) est « lié à un concours »,
// la destination / zone est pré-remplie avec le LIEU RÉEL du concours.
//
//   Ordre de fallback imposé :
//     1. adresse complète
//     2. lieu + ville
//     3. ville
//     4. lieu seul  (import FFE : `lieu` vaut souvent la ville)
//     5. secteur / localisation restante (région · département)
//
// On n'invente JAMAIS d'adresse : rien d'exploitable → destination vide.
//
// PARTIE PURE (aucun import) — le hook `useAutoDestination` vit dans
// `v2/state/autoDestination.ts`.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConcoursLoc {
  lieu?: string | null;
  adresse?: string | null;
  departement?: string | null;
  ville?: string | null;
  codePostal?: string | null;
  region?: string | null;
}

export type DestSource = 'adresse' | 'lieu-ville' | 'ville' | 'lieu' | 'secteur' | 'none';

export interface Destination {
  /** Valeur à pré-remplir dans le champ. */
  text: string;
  /** Quelle donnée du concours a servi (pour l'UI « vient du concours »). */
  source: DestSource;
  /** Libellé lisible de la source (« Adresse du concours », …). */
  label: string;
}

function clean(v?: string | null): string {
  const s = (v ?? '').toString().trim();
  if (!s || /^(nan|null|undefined|—|-|\.)$/i.test(s)) return '';
  return s;
}
function sameCity(a: string, b: string): boolean {
  const norm = (x: string) => x.toLowerCase().replace(/[^a-zà-ÿ]/gi, '');
  return norm(a) === norm(b);
}

/** Construit la destination à partir des données réelles du concours. */
export function buildDestination(loc?: ConcoursLoc | null): Destination {
  const none: Destination = { text: '', source: 'none', label: '' };
  if (!loc) return none;

  const lieu = clean(loc.lieu);
  const adresse = clean(loc.adresse);
  const ville = clean(loc.ville);
  const cp = clean(loc.codePostal);
  const dept = clean(loc.departement);
  const region = clean(loc.region);

  // 1) adresse complète (+ CP / ville si dispo)
  if (adresse) {
    const tail = [cp, ville].filter(Boolean).join(' ');
    return { text: tail ? `${adresse}, ${tail}` : adresse, source: 'adresse', label: 'Adresse du concours' };
  }
  // 2) lieu + ville (quand ce sont deux infos distinctes)
  if (lieu && ville && !sameCity(lieu, ville)) {
    return { text: `${lieu}, ${ville}`, source: 'lieu-ville', label: 'Lieu du concours' };
  }
  // 3) ville
  if (ville) {
    return { text: cp ? `${ville} (${cp})` : ville, source: 'ville', label: 'Ville du concours' };
  }
  // 4) lieu seul (import FFE : `lieu` = souvent la commune)
  if (lieu) {
    return { text: dept ? `${lieu} (${dept})` : lieu, source: 'lieu', label: 'Lieu du concours' };
  }
  // 5) secteur / localisation restante
  if (region || dept) {
    return { text: [region, dept].filter(Boolean).join(' · '), source: 'secteur', label: 'Secteur du concours' };
  }
  return none;
}

const PLACE_STOP = new Set(['la', 'le', 'les', 'l', 'du', 'de', 'des', 'saint', 'st', 'sainte', 'ste']);

/** Premier token « lieu » significatif (sans parenthèses, chiffres, articles). */
export function placeToken(s?: string | null): string {
  const words = (s ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[0-9]/g, ' ')
    .replace(/[^a-zà-ÿ\s-]/gi, ' ')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  return words.find((w) => !PLACE_STOP.has(w)) ?? words[0] ?? '';
}

/**
 * Rapprochement souple de deux libellés de lieu — tolère « La Baule » vs
 * « La Baule (44) » vs « Grand Parquet, Fontainebleau ». Utilisé par les filtres
 * de recherche DÉMO (aucun impact sur les résultats réels, filtrés par concoursId).
 */
export function placeMatches(a?: string | null, b?: string | null): boolean {
  const ta = placeToken(a);
  const tb = placeToken(b);
  if (!ta || !tb) return true;
  const la = (a ?? '').toLowerCase();
  const lb = (b ?? '').toLowerCase();
  return ta === tb || la.includes(tb) || lb.includes(ta);
}
