import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Alert, Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { notificationsStore, userStore, courseDemandesStore, stageReservationsStore, transportReservationsStore, boxReservationsStore } from '../../data/store';
import { Notification } from '../../types/notification';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState(notificationsStore.list);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteNotifId, setDeleteNotifId] = useState<string | null>(null);

  // Refresh quand on revient sur l'écran
  useFocusEffect(useCallback(() => {
    setNotifications([...notificationsStore.list]);
    // Marquer automatiquement toutes les notifications comme lues quand on ouvre la page
    notificationsStore.list.forEach((n) => {
      if (n.destinataireId === userStore.id && !n.lu) {
        n.lu = true;
      }
    });
    setNotifications([...notificationsStore.list]);
  }, []));

  // Filtrer pour ne montrer que les notifications du cavalier actuel
  const myNotifications = notifications.filter(
    (n) => n.destinataireId === userStore.id
  );

  const unreadCount = myNotifications.filter((n) => !n.lu).length;

  function markAsRead(notificationId: string) {
    const notification = notificationsStore.list.find((n) => n.id === notificationId);
    if (notification) {
      notification.lu = true;
      setNotifications([...notificationsStore.list]);
    }
  }

  function handleDelete(notificationId: string) {
    console.log('🗑️ Delete clicked for notification:', notificationId);
    setDeleteNotifId(notificationId);
    setDeleteModal(true);
  }

  function confirmDelete() {
    if (deleteNotifId) {
      console.log('✅ Confirmed delete for:', deleteNotifId);

      // Trouver la notification pour vérifier si c'est une acceptation
      const notifToDelete = notificationsStore.list.find(n => n.id === deleteNotifId);

      if (notifToDelete && notifToDelete.status === 'accepted') {
        // Trouver le propriétaire/coach pour envoyer une notification
        let ownerId: string | null = null;

        if (notifToDelete.type === 'course_request') {
          // Trouver le coach associé à cette demande
          const demand = courseDemandesStore.list.find(d => d.cavalierUserId === userStore.id && d.statut === 'accepted');
          if (demand) ownerId = demand.coachId;
        } else if (notifToDelete.type === 'stage_reservation') {
          const stage = stageReservationsStore.list.find(s => s.cavalierUserId === userStore.id && s.statut === 'accepted');
          if (stage) ownerId = stage.coachId;
        } else if (notifToDelete.type === 'reservation_request') {
          // Trouver le propriétaire du transport ou du box
          const transport = transportReservationsStore.list.find(t => t.buyerId === userStore.id && t.statut === 'accepted');
          const box = boxReservationsStore.list.find(b => b.buyerId === userStore.id && b.statut === 'accepted');
          if (transport) ownerId = transport.sellerId;
          if (box) ownerId = box.sellerId;
        }

        // Envoyer notification au propriétaire
        if (ownerId) {
          const cancelNotif: Notification = {
            id: `notif_${Date.now()}`,
            destinataireId: ownerId,
            type: notifToDelete.type,
            titre: '❌ Réservation annulée',
            message: `${userStore.nom} a annulé sa réservation`,
            status: 'rejected',
            lu: false,
            dateCreation: new Date(),
            auteurId: userStore.id,
            auteurNom: userStore.nom,
            auteurPseudo: userStore.pseudo,
            auteurInitiales: `${userStore.prenom[0]}${userStore.nom[0]}`,
            auteurCouleur: userStore.avatarColor,
          };
          notificationsStore.list = [cancelNotif, ...notificationsStore.list];
        }
      }

      const newNotifications = notifications.filter((n) => n.id !== deleteNotifId);
      setNotifications(newNotifications);
      notificationsStore.list = notificationsStore.list.filter((n) => n.id !== deleteNotifId);
      console.log('✅ Notification deleted');
    }
    setDeleteModal(false);
    setDeleteNotifId(null);
  }

  function cancelDelete() {
    setDeleteModal(false);
    setDeleteNotifId(null);
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
          <TouchableOpacity
            style={s.markAllBtn}
            onPress={() => {
              notificationsStore.list.forEach((n) => {
                if (n.destinataireId === userStore.id) {
                  n.lu = true;
                }
              });
              setNotifications([...notificationsStore.list]);
            }}
          >
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
          myNotifications.map((notif) => (
            <NotificationCard
              key={notif.id}
              notification={notif}
              onMarkAsRead={() => markAsRead(notif.id)}
              onDelete={() => handleDelete(notif.id)}
            />
          ))
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
}

function NotificationCard({ notification, onMarkAsRead, onDelete }: NotificationCardProps) {
  const handlePaymentNavigation = () => {
    console.log('🔵 handlePaymentNavigation called');
    console.log('📍 actionUrl:', notification.actionUrl);
    if (notification.actionUrl) {
      console.log('🚀 Navigating to:', notification.actionUrl);
      router.push(notification.actionUrl);
    } else {
      console.log('❌ No actionUrl provided');
    }
  };

  const showPaymentButton = notification.status === 'accepted' &&
    (notification.type === 'course_request' || notification.type === 'reservation_request');

  return (
    <View style={s.card}>
      {/* Statut badge */}
      {notification.status && (
        <View style={[s.statusBadgeMini, notification.status === 'accepted' ? s.statusAcceptedMini : s.statusRejectedMini]}>
          <Text style={s.statusBadgeTextMini}>
            {notification.status === 'accepted' ? '● Acceptée' : '● Refusée'}
          </Text>
        </View>
      )}

      {/* Cavalier pseudo */}
      <Text style={s.cavalierPseudo}>@{notification.auteurPseudo}</Text>

      {/* Détails */}
      <Text style={s.detailsText}>
        {notification.donnees?.stageTitre || notification.donnees?.annonceTitre || notification.donnees?.titre} · {notification.donnees?.nombreParticipants || ''} {notification.donnees?.nombreParticipants ? 'participant' + (notification.donnees.nombreParticipants !== 1 ? 's' : '') : ''}
      </Text>

      {/* Montant */}
      <Text style={s.montantText}>💰 {notification.donnees?.prixTotal || notification.donnees?.prix}€ TTC</Text>

      {/* Action buttons */}
      <View style={s.buttonRow}>
        {showPaymentButton && (
          <TouchableOpacity
            style={[s.actionBtn, s.payBtn]}
            onPress={handlePaymentNavigation}
          >
            <Text style={s.payBtnText}>💳 Payer maintenant</Text>
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
  payBtnText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: Colors.textInverse },
  deleteBtn: { backgroundColor: '#FEE2E2', borderColor: '#FEC2C2' },
  deleteBtnText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: '#DC2626' },
  statusBadgeMini: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.md },
  statusAcceptedMini: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#10B981' },
  statusRejectedMini: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#EF4444' },
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
