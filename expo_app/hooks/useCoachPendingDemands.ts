// ─────────────────────────────────────────────────────────────────────────────
// Source UNIQUE de la définition « demande de réservation EN ATTENTE » pour un
// coach. Utilisée par :
//   - accueil coach (hero « X demandes en attente », KPI, « Demandes récentes »)
//   - coach-demandes.tsx (liste « Demandes reçues »)
//   - CustomBottomBar (badge de l'onglet « Demandes »)
//
// Objectif : rendre IMPOSSIBLE un écart du type Accueil = 2 / Demandes = 0.
// Toute évolution de la règle (nouveau statut, nouveau type…) se fait ICI, une
// seule fois.
// ─────────────────────────────────────────────────────────────────────────────

import { userStore } from '../data/store';
import { useMyCourseDemands } from './useCourseDemands';
import { useMyStageReservations } from './useStages';
import type { CourseDemande, StageReservation } from '../types/service';

export interface CoachPendingDemands {
  /** Demandes de cours en attente adressées à ce coach. */
  courses: CourseDemande[];
  /** Inscriptions à un stage en attente adressées à ce coach. */
  stages: StageReservation[];
  /** Total = courses.length + stages.length. C'est LE compteur « X demandes ». */
  count: number;
  /** Listes brutes complètes (tous statuts) — pour dériver d'autres vues coach
   *  (cours à venir, rendez-vous confirmés…) SANS re-souscrire aux mêmes tables. */
  allCourses: CourseDemande[];
  allStages: StageReservation[];
}

/**
 * Prédicat unique. Une « demande en attente » = une demande de cours OU une
 * inscription à un stage, dont ce coach est le destinataire (`coachId`) et dont
 * le statut est exactement `pending`. Identique au filtre de coach-demandes.tsx.
 */
export function selectCoachPendingDemands(
  courseDemands: CourseDemande[],
  stageReservations: StageReservation[],
  coachId: string | undefined | null,
): CoachPendingDemands {
  const courses = coachId
    ? courseDemands.filter((d) => d.coachId === coachId && d.statut === 'pending')
    : [];
  const stages = coachId
    ? stageReservations.filter((r) => r.coachId === coachId && r.statut === 'pending')
    : [];
  return {
    courses,
    stages,
    count: courses.length + stages.length,
    allCourses: courseDemands,
    allStages: stageReservations,
  };
}

/**
 * Hook prêt à l'emploi. Réutilise EXACTEMENT les mêmes requêtes + realtime que
 * coach-demandes.tsx (`useMyCourseDemands` / `useMyStageReservations`).
 */
export function useCoachPendingDemands(): CoachPendingDemands {
  const { demands: courseDemands } = useMyCourseDemands();
  const { reservations: stageReservations } = useMyStageReservations();
  return selectCoachPendingDemands(courseDemands, stageReservations, userStore.id);
}
