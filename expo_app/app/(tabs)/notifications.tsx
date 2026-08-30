import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, Modal, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications, createNotification } from '../../hooks/useNotifications';
import { useMyTransportReservations } from '../../hooks/useTransports';
import { useMyBoxReservations } from '../../hooks/useBoxes';
import { useMyCourseDemands } from '../../hooks/useCourseDemands';
import { useMyStageReservations } from '../../hooks/useStages';
import { selectActiveNotifications } from '../../hooks/useActiveNotifications';
import { useCoursePayment } from '../../hooks/useCoursePayment';
import { Notification } from '../../types/notification';
import { userStore, supabase } from '../../data/store';

export default function NotificationsScreen() {
  const { profile, refetchProfile } = useAuth();
  const { notifications, unreadCount: totalUnread, markAsRead, markAllAsRead, removeNotification } = useNotifications();
  const { reservations: transportReservations } = useMyTransportReservations();
  const { reservations: boxReservations } = useMyBoxReservations();
  const { demands: courseDemands } = useMyCourseDemands();
  const { reservations: stageReservations } = useMyStageReservations();
  const { payCourse, loading: payLoading } = useCoursePayment();
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteNotifId, setDeleteNotifId] = useState<string | null>(null);
  const [switchingRole, setSwitchingRole] = useState(false);

  // Hors messages + filtre auto-cicatrisant CENTRALISÉ (même règle que
  // coach-notifications.tsx et le badge de la bottom bar) : une notif de demande
  // « pending » dont la demande n'est plus en attente est masquée.
  const myNotifications = selectActiveNotifications(notifications, {
    courseDemands,
    stageReservations,
    viewerId: userStore.id,
  });
  const unreadCount = myNotifications.filter((n) => !n.lu).length;

  // Marquer auto comme lu au focus (RLS bloque déjà l'IDOR côté serveur).
  useEffect(() => {
    if (totalUnread > 0) {
      markAllAsRead();
    }
  }, [totalUnread, markAllAsRead]);

  function handleDelete(notificationId: string) {
    setDeleteNotifId(notificationId);
    setDeleteModal(true);
  }

  async function confirmDelete() {
    if (!deleteNotifId || !profile?.id) {
      setDeleteModal(false);
      setDeleteNotifId(null);
      return;
    }

    const notifToDelete = myNotifications.find((n) => n.id === deleteNotifId);

    if (notifToDelete && notifToDelete.status === 'accepted') {
      // Trouver le propriétaire/coach pour envoyer une notification d'annulation.
      let ownerId: string | null = null;
      if (notifToDelete.type === 'course_request') {
        const demand = courseDemands.find(d => d.cavalierUserId === profile.id && d.statut === 'accepted');
        if (demand) ownerId = demand.coachId;
      } else if (notifToDelete.type === 'stage_reservation') {
        const stage = stageReservations.find(s => s.cavalierUserId === profile.id && s.statut === 'accepted');
        if (stage) ownerId = stage.coachId;
      } else if (notifToDelete.type === 'reservation_request') {
        const transport = transportReservations.find(t => t.buyerId === profile.id && t.statut === 'accepted');
        const box = boxReservations.find(b => b.buyerId === profile.id && b.statut === 'accepted');
        if (transport) ownerId = transport.sellerId;
        if (box) ownerId = box.sellerId;
      }

      if (ownerId) {
        await createNotification({
          destinataireId: ownerId,
          type: notifToDelete.type,
          titre: '❌ Réservation annulée',
          message: `${profile.prenom} ${profile.nom} a annulé sa réservation`,
          status: 'rejected',
        });
      }
    }

    const { error } = await removeNotification(deleteNotifId);
    if (error) Alert.alert('Erreur', error);
    setDeleteModal(false);
    setDeleteNotifId(null);
  }

  function cancelDelete() {
    setDeleteModal(false);
    setDeleteNotifId(null);
  }

  // Bascule cavalier → coach pour valider une demande coach/stage entrante.
  // Réutilise le même chemin que compte-type.tsx (RPC change_user_role +
  // applyRemoteProfile). Le rôle EST changé en DB ; l'écran d'acceptation
  // (coach-demandes) n'existe que sur la barre coach.
  async function switchToCoachToValidate() {
    if (switchingRole) return;
    if (userStore.role === 'coach') {
      router.replace('/(tabs)/coach-demandes' as any);
      return;
    }
    setSwitchingRole(true);
    const { error: rpcError } = await supabase.rpc('change_user_role', { p_new_role: 'coach' });
    if (rpcError) {
      setSwitchingRole(false);
      Alert.alert('Changement de rôle refusé', rpcError.message ?? 'Réessayez plus tard.');
      return;
    }
    try {
      const remoteProfile = await refetchProfile();
      if (remoteProfile) {
        userStore.applyRemoteProfile({
          id: remoteProfile.id,
          prenom: remoteProfile.prenom,
          nom: remoteProfile.nom,
          email: remoteProfile.email,
          role: remoteProfile.role,
          region: (remoteProfile as any).region ?? null,
          disciplines: (remoteProfile as any).disciplines ?? [],
          plan: (remoteProfile as any).plan ?? null,
        });
      } else {
        userStore.role = 'coach';
      }
    } catch (e) {
      console.error('[notifications] sync profil après switch coach échoué (rôle déjà changé):', e);
      userStore.role = 'coach';
    }
    setSwitchingRole(false);
    router.replace('/(tabs)/coach-demandes' as any);
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={s.headerSub}>{unreadCount} non lu{unreadCount > 1 ? 's' : ''}</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={s.markAllBtn} onPress={() => markAllAsRead()}>
            <Text style={s.markAllText}>Marquer tout comme lu</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {myNotifications.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🔔</Text>
            <Text style={s.emptyTitle}>Aucune notification</Text>
            <Text style={s.emptyText}>Vous recevrez une notification quand un coach valide ou refuse votre réservation</Text>
          </View>
        ) : (
          myNotifications.map((notif) => {
            // Paiement direct depuis la notif : on retrouve la demande acceptée
            // par demandId (posé à l'acceptation depuis ce déploiement), ou à
            // défaut par annonceId pour les notifs plus anciennes. Si rien ne
            // matche (transport/box, demande déjà payée…), la carte retombe sur
            // la navigation vers /pending-payments.
            const demandId = notif.donnees?.demandId;
            const annonceId = notif.donnees?.annonceId;
            const payableDemand = courseDemands.find((d) =>
              d.cavalierUserId === profile?.id &&
              d.statut === 'accepted' &&
              (demandId ? d.id === demandId : annonceId ? d.annonceId === annonceId : false),
            );
            return (
              <NotificationCard
                key={notif.id}
                notification={notif}
                onMarkAsRead={() => { markAsRead(notif.id); }}
                onDelete={() => handleDelete(notif.id)}
                onPay={payableDemand ? () => payCourse(payableDemand) : undefined}
                payLoading={payLoading}
                onSwitchToCoach={switchToCoachToValidate}
                switchingRole={switchingRole}
              />
            );
          })
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Modal de confirmation de suppression */}
      <Modal
        visible={deleteModal}
        transparent
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Confirmer l'annulation</Text>
            <View style={s.modalButtons}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnCancel]} onPress={cancelDelete}>
                <Text style={s.modalBtnCancelText}>Non</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnDelete]} onPress={confirmDelete}>
                <Text style={s.modalBtnDeleteText}>Oui</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

interface NotificationCardProps {
  notification: Notification;
  onMarkAsRead: () => void;
  onDelete: () => void;
  /** Paiement direct (Stripe) si la demande est retrouvée ; sinon undefined → navigation. */
  onPay?: () => void;
  payLoading?: boolean;
  /** Bascule cavalier → coach pour valider une demande coach/stage entrante. */
  onSwitchToCoach?: () => void;
  switchingRole?: boolean;
}

function NotificationCard({ notification, onMarkAsRead, onDelete, onPay, payLoading, onSwitchToCoach, switchingRole }: NotificationCardProps) {
  const handlePaymentNavigation = () => {
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  // Deep-link réclamation : ouvre directement le ticket concerné (donnees.support_id).
  // Fallback sûr sur l'écran support si l'id est absent.
  const isSupport = notification.type === 'support_request'
    || notification.type === 'support_ack'
    || notification.type === 'support_resolved';
  const handleSupportNavigation = () => {
    const sid = notification.donnees?.support_id;
    const base = notification.actionUrl ?? '/support';
    const sep = base.includes('?') ? '&' : '?';
    router.push((sid ? `${base}${sep}ticket=${sid}` : base) as any);
  };

  // Couvre cours (course_request), box/transport (reservation_request) et
  // stage (stage_reservation). Sans stage_reservation, la notif "stage
  // acceptée" n'avait aucun CTA pay → cavalier devait aller manuellement sur
  // /pending-payments.
  const showPaymentButton = notification.status === 'accepted' &&
    (notification.type === 'course_request'
      || notification.type === 'reservation_request'
      || notification.type === 'stage_reservation');

  // Demande coach/stage ENTRANTE (statut pending) = la notif arrive au coach
  // propriétaire de l'annonce. Comme l'écran d'acceptation (coach-demandes)
  // n'existe que sur la barre coach, on propose un CTA qui bascule le rôle.
  const isIncomingCoachDemand = notification.status === 'pending' &&
    (notification.type === 'course_request' || notification.type === 'stage_reservation');

  const isCommunity = notification.type === 'like' || notification.type === 'comment';

  // Notif présence concours (PR2b) : deep-link vers la fiche concours (action_url).
  const isConcoursPresence = notification.type === 'concours_presence';
  const handleConcoursNavigation = () => {
    const url = notification.actionUrl ?? notification.lien;
    if (url) router.push(url as any);
  };

  if (isCommunity) {
    return (
      <View style={[s.card, !notification.lu && s.cardUnread]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[s.authorAvatar, { backgroundColor: notification.auteurCouleur || '#888' }]}>
            <Text style={s.authorInitiales}>{notification.auteurInitiales || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.notificationTitle}>{notification.titre}</Text>
            <Text style={[s.notificationMessage, { marginTop: 4 }]}>{notification.message}</Text>
          </View>
          {!notification.lu && <View style={s.unreadDot} />}
        </View>
        <View style={s.buttonRow}>
          <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={onDelete}>
            <Text style={s.deleteBtnText}>🗑 Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.card}>
      {/* Statut badge */}
      {notification.status && (
        <View style={[s.statusBadgeMini,
          notification.status === 'accepted' || notification.status === 'paid' ? s.statusAcceptedMini
          : notification.status === 'pending' ? s.statusPendingMini
          : s.statusRejectedMini
        ]}>
          <Text style={s.statusBadgeTextMini}>
            {notification.status === 'accepted' ? '● Acceptée'
              : notification.status === 'paid' ? '● Réservé'
              : notification.status === 'pending' ? '● En attente'
              : '● Refusée'}
          </Text>
        </View>
      )}

      {/* Titre + message (l'info lisible que le cavalier attend) */}
      <Text style={s.notificationTitle}>{notification.titre}</Text>
      {!!notification.message && (
        <Text style={s.notificationMessage}>{notification.message}</Text>
      )}

      {/* Montant (si connu). Stage : prix coach seul, sans « TTC » (la
          commission n'apparaît qu'à l'étape paiement). Autres types inchangés. */}
      {(notification.donnees?.prixTotal || notification.donnees?.prix) != null && (
        <Text style={s.montantText}>💰 {notification.donnees?.prixTotal || notification.donnees?.prix}€{notification.type === 'stage_reservation' ? '' : ' TTC'}</Text>
      )}

      {/* Action buttons */}
      <View style={s.buttonRow}>
        {isSupport && (
          <TouchableOpacity
            style={[s.actionBtn, s.payBtn]}
            onPress={handleSupportNavigation}
          >
            <Text style={s.payBtnText}>📩 Voir la réclamation</Text>
          </TouchableOpacity>
        )}

        {isConcoursPresence && (
          <TouchableOpacity
            style={[s.actionBtn, s.payBtn]}
            onPress={handleConcoursNavigation}
          >
            <Text style={s.payBtnText}>🏇 Voir le concours</Text>
          </TouchableOpacity>
        )}
        {isIncomingCoachDemand && onSwitchToCoach && (
          <TouchableOpacity
            style={[s.actionBtn, s.coachBtn]}
            onPress={onSwitchToCoach}
            disabled={!!switchingRole}
          >
            {switchingRole ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <Text style={s.payBtnText}>🎓 Passer en compte coach pour valider</Text>
            )}
          </TouchableOpacity>
        )}
        {showPaymentButton && (
          <TouchableOpacity
            style={[s.actionBtn, s.payBtn]}
            onPress={onPay ?? handlePaymentNavigation}
            disabled={!!payLoading}
          >
            {onPay && payLoading ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <Text style={s.payBtnText}>💳 Payer maintenant</Text>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.actionBtn, s.deleteBtn]}
          onPress={onDelete}
        >
          <Text style={s.deleteBtnText}>🗑 Supprimer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs },
  markAllBtn: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.primaryBorder },
  markAllText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  container: { padding: Spacing.lg, gap: Spacing.md },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.md },
  cardUnread: { borderLeftWidth: 4, borderLeftColor: Colors.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  authorAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  authorInitiales: { color: Colors.textInverse, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  notificationTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  authorName: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: Spacing.xs },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginLeft: 'auto' },
  notificationMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  detailsBox: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  detailIcon: { fontSize: 18, width: 24 },
  detailLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold, marginTop: Spacing.xs },
  statusBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center' },
  statusAccepted: { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#10B981' },
  statusRejected: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#EF4444' },
  statusBadgeText: { fontWeight: FontWeight.semibold, fontSize: FontSize.xs, color: Colors.textPrimary },
  dateText: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flex: 1, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center', borderWidth: 1, borderColor: Colors.primaryBorder },
  actionBtnText: { fontWeight: FontWeight.semibold, fontSize: FontSize.xs, color: Colors.primary },
  actionBtnDelete: { backgroundColor: Colors.urgentBg, borderColor: Colors.urgentBorder },
  actionBtnDeleteText: { fontWeight: FontWeight.semibold, fontSize: FontSize.xs, color: Colors.danger },
  buttonRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  payBtn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  coachBtn: { backgroundColor: '#7C3AED', borderColor: '#7C3AED', flexBasis: '100%' },
  payBtnText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: Colors.textInverse },
  deleteBtn: { backgroundColor: '#FEE2E2', borderColor: '#FEC2C2' },
  deleteBtnText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: '#DC2626' },
  statusBadgeMini: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.md },
  statusAcceptedMini: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#10B981' },
  statusRejectedMini: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#EF4444' },
  statusPendingMini: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#F59E0B' },
  statusBadgeTextMini: { fontWeight: FontWeight.semibold, fontSize: FontSize.xs, color: Colors.textPrimary },
  cavalierPseudo: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  detailsText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  montantText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, width: '80%', maxWidth: 300 },
  modalTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  modalMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  modalButtons: { flexDirection: 'row', gap: Spacing.md },
  modalBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryBorder },
  modalBtnCancelText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: Colors.primary },
  modalBtnDelete: { backgroundColor: '#EF4444' },
  modalBtnDeleteText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: '#FFFFFF' },
});
