// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/notifications — useV2Notifications()
//
// F3 : branche le flux RÉEL (useActiveNotifications = useNotifications +
// selectActiveNotifications, déjà agnostique du rôle et agrégé par user id).
// LECTURE SEULE : pas de « marquer lu » (= écriture) en Phase 1.
// Repli sur un jeu de démo si aucune notification réelle.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useActiveNotifications } from '../../hooks/useActiveNotifications';
import { relativeDayLabel } from '../lib/dates';
import type { Notification } from '../../types/notification';

export interface V2Notif { id: string; group: string; icon: string; label: string; sub?: string; unread: boolean; href?: string }
export interface V2NotifGroup { label: string; items: V2Notif[] }

// Même repli que les écrans V1 (actionUrl ?? lien), + cas particulier réclamation
// (ticket ciblé via donnees.support_id). Une notif sans référence exploitable
// n'a pas de href → pas de navigation, pas de chevron affiché (cohérent).
// Ces 2 types visent tous deux le vendeur (offreur) côté box : une réponse
// à sa proposition vient d'être acceptée par l'acheteur (paiement à suivre),
// ou le paiement vient d'être confirmé — les 2 pointent vers l'onglet
// « Mes ventes » de Mes box, directement sur LA réservation concernée
// (donnees.reservation_id, posé par mig 117) plutôt que sur la liste entière.
const SELLER_BOX_RESERVATION_TYPES = new Set(['box_paiement_recu', 'box_reponse_acceptee']);

function resolveHref(n: Notification): string | undefined {
  const isSupport = n.type === 'support_request' || n.type === 'support_ack' || n.type === 'support_resolved';
  if (isSupport) {
    const sid = n.donnees?.support_id;
    const base = n.actionUrl ?? '/support';
    const sep = base.includes('?') ? '&' : '?';
    return sid ? `${base}${sep}ticket=${sid}` : base;
  }
  if (SELLER_BOX_RESERVATION_TYPES.has(n.type)) {
    const base = n.actionUrl ?? n.lien ?? '/box/mes-box';
    const rid = n.donnees?.reservation_id;
    return rid ? `${base}?tab=ventes&reservation=${rid}` : `${base}?tab=ventes`;
  }
  return n.actionUrl ?? n.lien;
}

const ICON: Record<string, string> = {
  course_request: '🎓', stage_reservation: '🎓', reservation_request: '✅',
  transport_reservation: '🚚', box_reservation: '🏠', trajet_complet: '🚚',
  message: '💬', mention: '💬', comment: '💬', like: '❤️',
  concours_presence: '⭐', escrow_alert: '⚠', escrow_prestation_done: '✅',
  escrow_release_soon: '⏳', dispute_opened: '⚠', dispute_resolved: '✅',
  seller_onboarded: '✅', support_request: '📩', support_ack: '📩', support_resolved: '✅',
  concours_reply: '💬', concours_mention: '💬',
  box_reponse_recue: '🏠', box_reponse_acceptee: '✅', box_paiement_recu: '💶', box_annulation: '❌',
  transport_reponse_recue: '🚚', transport_reponse_acceptee: '✅', transport_paiement_recu: '💶', transport_annulation: '❌',
};

const MOCK: V2Notif[] = [
  { id: 'n1', group: "Aujourd'hui", icon: '🎓', label: 'Nouvelle demande — Thomas R. / Rio', unread: true },
  { id: 'n2', group: "Aujourd'hui", icon: '✅', label: 'Transport La Baule accepté', unread: true },
  { id: 'n3', group: "Aujourd'hui", icon: '💬', label: 'Émilie a répondu à votre demande', unread: false },
  { id: 'n4', group: 'Hier', icon: '🏆', label: 'Horaire publié — CSO Deauville', unread: false },
  { id: 'n5', group: 'Hier', icon: '⭐', label: '2 nouveaux participants à La Baule', unread: false },
];

export function useV2Notifications() {
  const { isSignedIn } = useAuth();
  const { notifications } = useActiveNotifications() as { notifications: Notification[] };

  return useMemo(() => {
    const real: V2Notif[] = (notifications ?? []).map((n) => ({
      id: n.id,
      group: relativeDayLabel(n.dateCreation instanceof Date ? n.dateCreation : new Date(n.dateCreation)),
      icon: ICON[n.type] ?? '🔔',
      label: n.titre || n.message || 'Notification',
      // Titre = accroche générique ("Paiement reçu !") ; message = le détail
      // concret (lieu, dates — cf. mig 118). N'affiche le sous-texte que
      // s'il apporte vraiment quelque chose (évite un doublon quand titre et
      // message sont identiques, ex. anciennes notifs pré-118).
      sub: n.message && n.message !== n.titre ? n.message : undefined,
      unread: !n.lu,
      href: resolveHref(n),
    }));
    // Repli DÉMO uniquement SANS session réelle. Vrai compte sans notif → vide réel.
    const demo = !isSignedIn;
    const list = demo ? MOCK : real;
    const groups: V2NotifGroup[] = [];
    for (const it of list) {
      let g = groups.find((x) => x.label === it.group);
      if (!g) { g = { label: it.group, items: [] }; groups.push(g); }
      g.items.push(it);
    }
    return { groups, demo, unreadCount: list.filter((x) => x.unread).length };
  }, [notifications, isSignedIn]);
}
