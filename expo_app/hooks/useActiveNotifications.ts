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
    // On ne conclut « obsolète » QUE si on connaît réellement une demande de ce
    // coach pour cette annonce (sinon : demandes non chargées, ou pas notre
    // demande → on garde la notif). Obsolète = aucune de ces demandes n'est pending.
    const mine = courseDemands.filter((d) => d.coachId === viewerId && d.annonceId === n.donnees?.annonceId);
    if (mine.length === 0) return false;
    return !mine.some((d) => d.statut === 'pending');
  }
  if (n.status === 'pending' && n.type === 'stage_reservation' && n.donnees?.stageId) {
    const mine = stageReservations.filter((r) => r.coachId === viewerId && r.stageId === n.donnees?.stageId);
    if (mine.length === 0) return false;
    return !mine.some((r) => r.statut === 'pending');
  }
  return false;
}

/**
 * Types de notif volontairement EXCLUS de la surface « Notifications » (écrans +
 * badge) : ils ont leur propre canal/badge dédié. `message` → badge Messagerie
 * (`useUnreadMessagesCount`). Règle unique appliquée partout (N4/N5).
 */
export const NOTIF_HIDDEN_TYPES: ReadonlySet<string> = new Set(['message']);

/**
 * Filtre pur : notifications à afficher/compter dans la surface Notifications.
 * = actives (non obsolètes) ET pas d'un type à canal dédié (`message`).
 */
export function selectActiveNotifications(
  notifications: Notification[],
  ctx: ActiveNotificationsContext,
): Notification[] {
  return notifications.filter(
    (n) => !NOTIF_HIDDEN_TYPES.has(n.type) && !isNotificationObsolete(n, ctx),
  );
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
