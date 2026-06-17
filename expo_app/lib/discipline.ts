// ─────────────────────────────────────────────────────────────────────────────
// discipline — dérivation best-effort de la discipline d'un concours.
//
// L'export FFE laisse `type_concours = 'nan'` pour ~83% des concours → on ne peut
// pas s'y fier seul. On déduit une discipline GROSSIÈRE à partir de `type_concours`
// (quand exploitable) + des libellés d'épreuves (`liste_epreuves`). Aucune
// invention : si rien n'est détecté → 'Autre'. Sert au filtre de découverte.
// ─────────────────────────────────────────────────────────────────────────────

export type Discipline = 'CSO' | 'Dressage' | 'CCE' | 'Hunter' | 'Autre';

export const DISCIPLINES: Discipline[] = ['CSO', 'Dressage', 'CCE', 'Hunter', 'Autre'];

const HEIGHT_RE = /\(\s*\d+[.,]\d+\s*m\s*\)/; // « (1,05 m) » = épreuve à obstacles

export function deriveDiscipline(
  typeConcours: string | null | undefined,
  listeEpreuves: string[] | null | undefined,
): Discipline {
  const type = typeConcours && typeConcours.toLowerCase() !== 'nan' ? typeConcours : '';
  const eps = (listeEpreuves ?? []).join(' ');
  const t = `${type} ${eps}`.toLowerCase();

  if (!t.trim()) return 'Autre';
  // Ordre = du plus spécifique au plus générique.
  if (/dressage/.test(t)) return 'Dressage';
  if (/\bcce\b|concours complet|complet d'équitation|cross|eventing/.test(t)) return 'CCE';
  if (/hunter/.test(t)) return 'Hunter';
  if (/\bcso\b|saut d'obstacles?|obstacle|grand prix|spéciale au chrono|au chrono|barème/.test(t) || HEIGHT_RE.test(eps)) return 'CSO';
  return 'Autre';
}

// Région lisible : « CRE ILE DE FRANCE » → « Île de France » (best-effort, sinon brut).
export function regionLabel(cre: string | null | undefined): string {
  if (!cre) return '';
  return cre.replace(/^\$?CRE\s+/i, '').trim() || cre;
}
