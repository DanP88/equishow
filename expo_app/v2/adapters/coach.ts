// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/coach — résultats « Je cherche un coach » + demandes reçues.
//
// LECTURE SEULE des données RÉELLES V1 (useCoachAnnonces, useMyCourseDemands).
// Repli DÉMO uniquement SANS session. Compte connecté vide → vrai vide.
// Miroir strict de v2/adapters/transport / box (F5/F6).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCoachAnnonces } from '../../hooks/useCoachAnnonces';
import { useMyCourseDemands } from '../../hooks/useCourseDemands';
import { getCommission } from '../../types/service';
import { MOCK_COACHES } from '../mocks/coach';

export interface V2CoachResult {
  src: 'real' | 'demo';
  id: string;
  nom: string;
  initiales: string;
  couleur: string;
  note?: number;
  disciplines: string;
  niveaux: string;
  prixSeance: number;       // € par séance
  places: number;
  coachedHere?: number;
  type: 'concours' | 'regulier';
  concoursNom?: string;
  concoursId?: string;
  region?: string;
  description?: string;
}

export interface CoachSearchCtx {
  concoursId?: string;
  discipline?: string;
}

const COMMISSION = () => { try { return getCommission('cours'); } catch { return 0.09; } };
const norm = (s?: string) => (s ?? '').toLowerCase();

export function useV2CoachResults(ctx: CoachSearchCtx) {
  const { isSignedIn } = useAuth();
  const { annonces } = useCoachAnnonces();

  return useMemo(() => {
    const real: V2CoachResult[] = (annonces ?? [])
      .filter((a) => (a.placesDisponibles ?? 0) > 0)
      .filter((a) => (ctx.concoursId ? a.concoursId === ctx.concoursId : true))
      .filter((a) => (ctx.discipline ? norm(a.discipline).includes(norm(ctx.discipline)) : true))
      .map((a) => ({
        src: 'real' as const,
        id: a.id,
        nom: a.auteurNom || a.auteurPseudo || 'Coach',
        initiales: a.auteurInitiales || (a.auteurNom || '?').slice(0, 2).toUpperCase(),
        couleur: a.auteurCouleur || '#7C3AED',
        disciplines: a.discipline || '—',
        niveaux: a.niveau || '—',
        prixSeance: Math.round(Number(a.prixHeure) || 0),
        places: a.placesDisponibles ?? 0,
        type: a.type,
        concoursNom: a.concours || undefined,
        concoursId: a.concoursId || undefined,
        region: a.region || undefined,
        description: a.description || undefined,
      }));

    if (isSignedIn) {
      return { results: real, demo: false, commission: COMMISSION() };
    }

    const demo: V2CoachResult[] = MOCK_COACHES
      .filter((m) => (ctx.discipline ? norm(m.disciplines).includes(norm(ctx.discipline)) : true))
      .map((m) => ({
        src: 'demo' as const,
        id: m.id, nom: m.nom, initiales: m.initiales, couleur: m.couleur, note: m.note,
        disciplines: m.disciplines, niveaux: m.niveaux, prixSeance: m.prixSeance,
        places: m.places, coachedHere: m.coachedHere, type: m.type,
        concoursNom: m.concoursNom, description: m.description,
      }));
    return { results: [...real, ...demo], demo: true, commission: COMMISSION() };
  }, [isSignedIn, annonces, ctx.concoursId, ctx.discipline]);
}

export interface V2CoachDemand {
  src: 'real' | 'demo';
  id: string;
  cavalier: string;
  cheval: string;
  discipline: string;
  niveau: string;
  concoursNom?: string;
  nbSeances: number;
}

/** Demandes de coaching REÇUES (côté coach). Lecture seule — 0 write. */
export function useV2CoachDemands() {
  const { isSignedIn, profile } = useAuth();
  const me = (profile as any)?.id as string | undefined;
  const { demands } = useMyCourseDemands();

  return useMemo(() => {
    const real: V2CoachDemand[] = (demands ?? [])
      .filter((d) => !!me && d.coachId === me && d.statut === 'pending')
      .map((d) => ({
        src: 'real' as const,
        id: d.id,
        cavalier: d.cavalierNom || d.cavalierPseudo || 'Cavalier',
        cheval: d.cheval || '—',
        discipline: d.discipline || '—',
        niveau: d.niveau || '—',
        concoursNom: d.concoursNom || undefined,
        nbSeances: d.nbJours || 1,
      }));
    if (isSignedIn) return { demands: real, demo: false };

    // Prototype non connecté : jeu de démonstration (mocks f2 partagés).
    const demo: V2CoachDemand[] = [
      { src: 'demo', id: 'dd1', cavalier: 'Thomas R.', cheval: 'Rio', discipline: 'CSO', niveau: 'Amateur 1', concoursNom: 'Jumping de La Baule', nbSeances: 1 },
      { src: 'demo', id: 'dd2', cavalier: 'Léa M.', cheval: 'Ideal', discipline: 'CSO', niveau: 'Club 1', concoursNom: 'Jumping de La Baule', nbSeances: 1 },
    ];
    return { demands: demo, demo: true };
  }, [isSignedIn, me, demands]);
}
