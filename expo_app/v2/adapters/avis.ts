// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/avis — avis REÇUS + DÉPOSÉS de la personne (F9).
//
// LECTURE SEULE des données réelles V1 (useAvis / useAvisStats / useMyAvisRefs).
// Aucune écriture : déposer un avis = flux « réservation completed » (Phase 2).
// Repli démo si non connecté.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAvis, useAvisStats, useMyAvisRefs, Avis, AvisType } from '../../hooks/useAvis';

export const AVIS_TYPE_META: Record<AvisType, { icon: string; label: string }> = {
  coach: { icon: '🎓', label: 'Coaching' },
  transport: { icon: '🚚', label: 'Transport' },
  box: { icon: '🏠', label: 'Box' },
  stage: { icon: '📅', label: 'Stage' },
};
const TYPES: AvisType[] = ['coach', 'transport', 'box', 'stage'];

export interface V2AvisBucket { type: AvisType | 'autre'; icon: string; label: string; count: number; average: number; derniers: Avis[] }
export interface V2Avis {
  ready: boolean;
  demo: boolean;
  note: number;
  count: number;
  deposesCount: number;
  recus: Avis[];
  buckets: V2AvisBucket[];
}

const DEMO: Avis[] = [
  { id: 'a1', auteur_id: '', auteur_nom: 'Julie D.', auteur_pseudo: null, auteur_initiales: 'JD', auteur_couleur: '#7C3AED', destinataire_id: '', note: 5, commentaire: 'Super coaching, très à l’écoute sur le paddock.', type: 'coach', ref_id: null, created_at: new Date().toISOString() },
  { id: 'a2', auteur_id: '', auteur_nom: 'Marc L.', auteur_pseudo: null, auteur_initiales: 'ML', auteur_couleur: '#0369A1', destinataire_id: '', note: 4, commentaire: 'Trajet ponctuel, van nickel.', type: 'transport', ref_id: null, created_at: new Date(Date.now() - 8.64e7).toISOString() },
  { id: 'a3', auteur_id: '', auteur_nom: 'Sophie R.', auteur_pseudo: null, auteur_initiales: 'SR', auteur_couleur: '#16A34A', destinataire_id: '', note: 5, commentaire: 'Box propre, foin à volonté.', type: 'box', ref_id: null, created_at: new Date(Date.now() - 3 * 8.64e7).toISOString() },
];

function bucketize(recus: Avis[]): V2AvisBucket[] {
  const out: V2AvisBucket[] = [];
  for (const t of TYPES) {
    const items = recus.filter((a) => a.type === t);
    if (!items.length) continue;
    out.push({
      type: t, icon: AVIS_TYPE_META[t].icon, label: AVIS_TYPE_META[t].label,
      count: items.length,
      average: Math.round((items.reduce((s, a) => s + (a.note ?? 0), 0) / items.length) * 10) / 10,
      derniers: items.slice(0, 3),
    });
  }
  const autres = recus.filter((a) => !a.type || !TYPES.includes(a.type));
  if (autres.length) out.push({
    type: 'autre', icon: '⭐', label: 'Autres', count: autres.length,
    average: Math.round((autres.reduce((s, a) => s + (a.note ?? 0), 0) / autres.length) * 10) / 10,
    derniers: autres.slice(0, 3),
  });
  return out;
}

export function useV2Avis(): V2Avis {
  const { isSignedIn, profile } = useAuth();
  const me = (profile as any)?.id as string | undefined;
  const { avis: recus, isLoading } = useAvis(me);
  const stats = useAvisStats(me);
  const refs = useMyAvisRefs();

  return useMemo(() => {
    if (isSignedIn) {
      return {
        ready: !isLoading,
        demo: false,
        note: stats.average || 0,
        count: stats.count || 0,
        deposesCount: refs.size,
        recus: recus ?? [],
        buckets: bucketize(recus ?? []),
      };
    }
    return {
      ready: true, demo: true,
      note: 4.8, count: DEMO.length, deposesCount: 7,
      recus: DEMO, buckets: bucketize(DEMO),
    };
  }, [isSignedIn, isLoading, recus, stats, refs]);
}
