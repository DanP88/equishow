// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/org — espace organisateur V2 (F10).
//
// LECTURE SEULE : useMyConcours (mes concours) + useOrgRadar (agrégats RGPD,
// masquage < 5, jamais de nominatif). Aucune écriture, aucun backend nouveau.
// Repli démo quand la personne n'est pas connectée.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useMyConcours } from '../../hooks/useConcours';
import { useOrgRadar, OrgRadar } from '../../hooks/useOrgRadar';

export interface OrgConcours { id: string; nom: string; statut: string; dateLabel: string; lieu: string | null }

const DEMO_CONCOURS: OrgConcours[] = [
  { id: 'demo-o1', nom: 'CSO Amateur du Haras des Pins', statut: 'publie', dateLabel: '18–20 oct. 2026', lieu: 'Le Pin-au-Haras' },
  { id: 'demo-o2', nom: 'Derby de printemps', statut: 'brouillon', dateLabel: '4 avr. 2026', lieu: 'Fontainebleau' },
];

export interface V2OrgSpace {
  ready: boolean;
  demo: boolean;
  isPending: boolean;
  concours: OrgConcours[];
  counts: { publie: number; brouillon: number; archive: number; total: number };
}

export function useV2OrgSpace(): V2OrgSpace {
  const { isSignedIn } = useAuth();
  const { concours, isLoading } = useMyConcours();

  return useMemo(() => {
    const real: OrgConcours[] = (concours ?? []).map((c: any) => ({
      id: c.id, nom: c.nom, statut: c.statut, dateLabel: c.dateLabel, lieu: c.lieu ?? null,
    }));
    const list = isSignedIn ? real : (real.length ? real : DEMO_CONCOURS);
    const demo = !isSignedIn && real.length === 0;
    const counts = {
      publie: list.filter((c) => c.statut === 'publie').length,
      brouillon: list.filter((c) => c.statut === 'brouillon').length,
      archive: list.filter((c) => c.statut === 'archive').length,
      total: list.length,
    };
    return { ready: !isLoading || !isSignedIn, demo, isPending: false, concours: list, counts };
  }, [isSignedIn, concours, isLoading]);
}

export interface V2OrgRadar { ready: boolean; demo: boolean; radar: OrgRadar | null }

/** Radar d'un concours — agrégats RGPD-aware, lecture seule. */
export function useV2OrgRadar(concoursId?: string): V2OrgRadar {
  const { isSignedIn } = useAuth();
  const isDemoId = !!concoursId && concoursId.startsWith('demo-');
  const { radar, isLoading, isDemo } = useOrgRadar(isDemoId ? 'demo' : concoursId);
  return useMemo(() => ({
    ready: !isLoading,
    demo: isDemo || isDemoId || !isSignedIn,
    radar,
  }), [radar, isLoading, isDemo, isDemoId, isSignedIn]);
}
