// ─────────────────────────────────────────────────────────────────────────────
// Source UNIQUE : « une notification est-elle encore RÉELLEMENT active ? »
//
// Problème résolu : une notif « 🎓 Nouvelle demande de cours » (status='pending')
// reste en base même après que la demande a été acceptée / refusée / complétée /
// expirée (aucun trigger DB ne la met à jour — cf. C3, correctif DB à part).
// `coach-notifications.tsx` la masquait déjà via un filtre local ; mais
// `notifications.tsx` et le badge de la bottom bar (`useUnreadNotificationsCount`)
// NE le faisaient pas → badge = 1 / liste = 0.
//
// Ce module centralise le prédicat. Utilisé par :
//   - coach-notifications.tsx  (liste)
//   - notifications.tsx        (liste)
//   - CustomBottomBar.tsx      (badge Notifs)
// ─────────────────────────────────────────────────────────────────────────────

import { userStore } from '../data/store';
import { useNotifications } from './useNotifications';
import { useMyCourseDemands } from './useCourseDemands';
import { useMyStageReservations } from './useStages';
import type { Notification } from '../types/notification';
import type { CourseDemande, StageReservation } from '../types/service';

export interface ActiveNotificationsContext {
  courseDemands: CourseDemande[];
  stageReservations: StageReservation[];
  /** id du user courant (= destinataire de la notif = coach dans ces cas). */
  viewerId: string | undefined | null;
}

/**
 * Une notif de demande entrante (`course_request` / `stage_reservation`) au
 * statut `pending` est OBSOLÈTE si la demande sous-jacente (rapprochée par
 * `donnees.annonceId` / `donnees.stageId` + coach = viewer) n'est plus `pending`.
 * Toute autre notif est considérée active (on ne filtre jamais à tort).
 */
export function isNotificationObsolete(
  n: Notification,
  { courseDemands, stageReservations, viewerId }: ActiveNotificationsContext,
): boolean {
  if (!viewerId) return false;
  if (n.status === 'pending' && n.type === 'course_request' && n.donnees?.annonceId) {
    const stillPending = courseDemands.some(
      (d) => d.coachId === viewerId && d.annonceId === n.donnees?.annonceId && d.statut === 'pending',
    );
    return !stillPending;
  }
  if (n.status === 'pending' && n.type === 'stage_reservation' && n.donnees?.stageId) {
    const stillPending = stageReservations.some(
      (r) => r.coachId === viewerId && r.stageId === n.donnees?.stageId && r.statut === 'pending',
    );
    return !stillPending;
  }
  return false;
}

/** Filtre pur : ne garde que les notifications réellement actives. */
export function selectActiveNotifications(
  notifications: Notification[],
  ctx: ActiveNotificationsContext,
): Notification[] {
  return notifications.filter((n) => !isNotificationObsolete(n, ctx));
}

/**
 * Hook prêt à l'emploi : `useNotifications()` filtré des notifs obsolètes, avec
 * un `unreadCount` cohérent. Passe-plat de l'API `useNotifications` pour le reste.
 */
export function useActiveNotifications() {
  const base = useNotifications();
  const { demands: courseDemands } = useMyCourseDemands();
  const { reservations: stageReservations } = useMyStageReservations();
  const ctx: ActiveNotificationsContext = {
    courseDemands,
    stageReservations,
    viewerId: userStore.id,
  };
  const active = selectActiveNotifications(base.notifications, ctx);
  return {
    ...base,
    notifications: active,
    unreadCount: active.filter((n) => !n.lu).length,
  };
}
