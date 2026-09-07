// ─────────────────────────────────────────────────────────────────────────────
// v2/state/activityCounts — compteurs d'activité de la personne (F9).
//
// Agrège, en LECTURE SEULE, ce qui est réel (hooks V1, filtrés sur mon id) et
// ce qui est local V2 (bookings / offers des stores `v2:*`). AUCUNE écriture,
// AUCUN backend. Repli démo quand la personne n'est pas connectée.
//
// Utilisé par ProfilV2 (en-tête + compteurs par section).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useMyTransportReservations } from '../../hooks/useTransports';
import { useMyBoxReservations } from '../../hooks/useBoxes';
import { useMyCourseDemands } from '../../hooks/useCourseDemands';
import { useMyStageReservations } from '../../hooks/useStages';
import { useMyConcours } from '../../hooks/useConcours';
import { useAvisStats, useMyAvisRefs } from '../../hooks/useAvis';
import { useConcoursLocal } from './concoursLocal';
import { useV2AllHorses } from './contestHorses';
import { useTransportLocal } from './transportLocal';
import { useBoxLocal } from './boxLocal';
import { useCoachLocal } from './coachLocal';
import { useV2CoachDemands } from '../adapters/coach';

const DEAD = new Set(['cancelled', 'rejected', 'payment_expired', 'expired']);
const mine = (arr: any[] | undefined, me: string | undefined, field = 'buyerId') =>
  (arr ?? []).filter((r) => (!me || r[field] === me) && !DEAD.has(String(r.statut)));

export interface V2ActivityCounts {
  ready: boolean;
  demo: boolean;
  chevaux: number;
  concoursSuivis: number;      // « J'y serai » ∪ suivis (local)
  concoursOrganises: number;
  transports: number;          // réservations transport (réelles + simulées V2)
  box: number;
  coachings: number;           // coachings réservés en tant que cavalier
  coachAnnonces: number;       // mes annonces de coaching (local V2)
  coachDemandesRecues: number; // demandes reçues (coach)
  avisNote: number;
  avisRecus: number;
  avisDeposes: number;
}

export function useV2ActivityCounts(): V2ActivityCounts {
  const { isSignedIn, profile } = useAuth();
  const me = (profile as any)?.id as string | undefined;

  const { reservations: rTransport } = useMyTransportReservations();
  const { reservations: rBox } = useMyBoxReservations();
  const { demands: rCourse } = useMyCourseDemands();
  const { reservations: rStage } = useMyStageReservations();
  const { concours: organised } = useMyConcours();
  const avisStats = useAvisStats(me);
  const avisRefs = useMyAvisRefs();

  const cl = useConcoursLocal();
  const horses = useV2AllHorses();
  const tl = useTransportLocal();
  const bl = useBoxLocal();
  const kl = useCoachLocal();
  const kDemands = useV2CoachDemands();

  return useMemo(() => {
    const localConcours = new Set([...cl.goingIds, ...cl.followingIds]);

    const real = {
      transports: mine(rTransport, me).length,
      box: mine(rBox, me).length,
      coachings: (rCourse ?? []).filter((d: any) => (!me || d.cavalierUserId === me) && !DEAD.has(String(d.statut))).length
        + (rStage ?? []).filter((r: any) => (!me || r.cavalierUserId === me) && !DEAD.has(String(r.statut))).length,
      concoursOrganises: (organised ?? []).length,
      coachDemandesRecues: kDemands.demo ? 0 : kDemands.demands.length,
    };

    const counts: V2ActivityCounts = {
      ready: horses.ready,
      demo: false, // vrais compteurs (réels V1 + simulés V2) — pas des placeholders
      chevaux: horses.all.length,
      concoursSuivis: localConcours.size,
      concoursOrganises: real.concoursOrganises,
      transports: real.transports + tl.bookings.length,
      box: real.box + bl.bookings.length,
      coachings: real.coachings + kl.bookings.length,
      coachAnnonces: kl.offers.length,
      coachDemandesRecues: real.coachDemandesRecues + (kDemands.demo ? kDemands.demands.length : 0),
      avisNote: avisStats.average || 0,
      avisRecus: avisStats.count || 0,
      avisDeposes: avisRefs.size,
    };

    if (!isSignedIn && counts.chevaux === 0 && counts.concoursSuivis === 0
      && counts.transports === 0 && counts.box === 0 && counts.coachings === 0) {
      // Prototype non connecté et vide : aperçu de démonstration.
      return {
        ...counts, demo: true,
        chevaux: 2, concoursSuivis: 3, concoursOrganises: 0,
        transports: 4, box: 2, coachings: 3, coachAnnonces: 0,
        coachDemandesRecues: 0, avisNote: 4.8, avisRecus: 3, avisDeposes: 7,
      };
    }
    return counts;
  }, [isSignedIn, me, rTransport, rBox, rCourse, rStage, organised, avisStats, avisRefs,
      cl.goingIds, cl.followingIds, horses, tl.bookings, bl.bookings, kl.bookings, kl.offers, kDemands]);
}
