// ─────────────────────────────────────────────────────────────────────────────
// v2/lib/epreuves — source des épreuves proposées pour un concours (F14).
//
//   1. si `concours.liste_epreuves` (mig 074, import CSV FFE) contient de vraies
//      épreuves → on les propose telles quelles (source = 'concours', RÉEL).
//   2. sinon → liste TYPE par discipline, clairement marquée « simulation »
//      (le concours n'a pas publié ses engagements). AUCUNE épreuve inventée
//      pour un concours précis : ce sont des catégories FFE standard.
//
// Aucune écriture, aucun backend.
// ─────────────────────────────────────────────────────────────────────────────

/** Entrées de `liste_epreuves` qui ne sont pas de vraies épreuves. */
const JUNK = /^(nan|—|-|\s*$|ouvert aux|inscriptions|engagements? ouverts?|à définir)/i;

function cleanList(raw: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of raw ?? []) {
    const v = (e ?? '').trim();
    if (!v || JUNK.test(v) || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}

// Catégories FFE standard (réelles) — repli quand le concours n'a rien publié.
const TYPE_LISTS: Record<string, string[]> = {
  CSO: [
    'Préparatoire', 'Club 3', 'Club 2', 'Club 1', 'Club Élite',
    'Amateur 3', 'Amateur 2', 'Amateur 1', 'Amateur Élite',
    'Amateur 2 Grand Prix', 'Amateur 1 Grand Prix',
    'Pro 3', 'Pro 2', 'Pro 1', 'Grand Prix Pro',
    'Épreuve à Vitesse', 'Épreuve Spéciale',
  ],
  Dressage: [
    'Club 4', 'Club 3', 'Club 2', 'Club 1',
    'Amateur 3', 'Amateur 2', 'Amateur 1', 'Amateur Élite',
    'Pro 3', 'Pro 2', 'Pro 1', 'Reprise Libre en Musique',
  ],
  CCE: [
    'Club Poney', 'Club 3', 'Club 2', 'Club 1',
    'Amateur 4', 'Amateur 3', 'Amateur 2', 'Amateur 1',
    'Pro 3', 'Pro 2', 'Pro 1',
  ],
  Hunter: [
    'Hunter Club', 'Hunter Amateur 3', 'Hunter Amateur 2', 'Hunter Amateur 1',
    'Hunter Style', 'Hunter Équitation', 'Hunter Pro',
  ],
};
const GENERIC = [
  'Préparatoire', 'Club 3', 'Club 2', 'Club 1',
  'Amateur 3', 'Amateur 2', 'Amateur 1', 'Amateur Élite',
  'Pro 3', 'Pro 2', 'Pro 1', 'Grand Prix',
];

function typeKey(t?: string | null): string {
  const s = (t ?? '').toLowerCase();
  if (s.includes('cso') || s.includes('saut') || s.includes('jumping') || s.includes('obstacle')) return 'CSO';
  if (s.includes('dressage')) return 'Dressage';
  if (s.includes('cce') || s.includes('complet') || s.includes('eventing')) return 'CCE';
  if (s.includes('hunter')) return 'Hunter';
  return '';
}

export interface EpreuveOptions {
  /** 'concours' = épreuves réelles publiées ; 'type' = liste standard (simulation). */
  source: 'concours' | 'type';
  list: string[];
  discipline: string; // '' si inconnue
}

export function epreuveOptions(concours?: { liste_epreuves?: string[] | null; type_concours?: string | null } | null): EpreuveOptions {
  const real = cleanList(concours?.liste_epreuves ?? null);
  if (real.length > 0) return { source: 'concours', list: real, discipline: typeKey(concours?.type_concours) };
  const key = typeKey(concours?.type_concours);
  return { source: 'type', list: (key && TYPE_LISTS[key]) || GENERIC, discipline: key };
}
