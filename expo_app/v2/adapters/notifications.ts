// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/notifications — useV2Notifications()
//
// F3 : branche le flux RÉEL (useActiveNotifications = useNotifications +
// selectActiveNotifications, déjà agnostique du rôle et agrégé par user id).
// LECTURE SEULE : pas de « marquer lu » (= écriture) en Phase 1.
// Repli sur un jeu de démo si aucune notification réelle.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useActiveNotifications } from '../../hooks/useActiveNotifications';
import { relativeDayLabel } from '../lib/dates';
import type { Notification } from '../../types/notification';

export interface V2Notif { id: string; group: string; icon: string; label: string; unread: boolean }
export interface V2NotifGroup { label: string; items: V2Notif[] }

const ICON: Record<string, string> = {
  course_request: '🎓', stage_reservation: '🎓', reservation_request: '✅',
  transport_reservation: '🚚', box_reservation: '🏠', trajet_complet: '🚚',
  message: '💬', mention: '💬', comment: '💬', like: '❤️',
  concours_presence: '⭐', escrow_alert: '⚠', escrow_prestation_done: '✅',
  escrow_release_soon: '⏳', dispute_opened: '⚠', dispute_resolved: '✅',
  seller_onboarded: '✅', support_request: '📩', support_ack: '📩', support_resolved: '✅',
};

const MOCK: V2Notif[] = [
  { id: 'n1', group: "Aujourd'hui", icon: '🎓', label: 'Nouvelle demande — Thomas R. / Rio', unread: true },
  { id: 'n2', group: "Aujourd'hui", icon: '✅', label: 'Transport La Baule accepté', unread: true },
  { id: 'n3', group: "Aujourd'hui", icon: '💬', label: 'Émilie a répondu à votre demande', unread: false },
  { id: 'n4', group: 'Hier', icon: '🏆', label: 'Horaire publié — CSO Deauville', unread: false },
  { id: 'n5', group: 'Hier', icon: '⭐', label: '2 nouveaux participants à La Baule', unread: false },
];

export function useV2Notifications() {
  const { notifications } = useActiveNotifications() as { notifications: Notification[] };

  return useMemo(() => {
    const real: V2Notif[] = (notifications ?? []).map((n) => ({
      id: n.id,
      group: relativeDayLabel(n.dateCreation instanceof Date ? n.dateCreation : new Date(n.dateCreation)),
      icon: ICON[n.type] ?? '🔔',
      label: n.titre || n.message || 'Notification',
      unread: !n.lu,
    }));
    const demo = real.length === 0;
    const list = demo ? MOCK : real;
    const groups: V2NotifGroup[] = [];
    for (const it of list) {
      let g = groups.find((x) => x.label === it.group);
      if (!g) { g = { label: it.group, items: [] }; groups.push(g); }
      g.items.push(it);
    }
    return { groups, demo, unreadCount: list.filter((x) => x.unread).length };
  }, [notifications]);
}
