import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { notificationsStore, userStore } from '../../data/store';
import { Notification } from '../../types/notification';

export default function OrgNotificationsScreen() {
  const [notifications, setNotifications] = useState(notificationsStore.list);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteNotifId, setDeleteNotifId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    setNotifications([...notificationsStore.list]);
    notificationsStore.list.forEach((n) => {
      if (n.destinataireId === userStore.id && !n.lu) {
        n.lu = true;
      }
    });
    setNotifications([...notificationsStore.list]);
  }, []));

  const myNotifications = notifications.filter(
    (n) => n.destinataireId === userStore.id && n.type !== 'message'
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
    setDeleteNotifId(notificationId);
    setDeleteModal(true);
  }

  function confirmDelete() {
    if (deleteNotifId) {
      const newNotifications = notifications.filter((n) => n.id !== deleteNotifId);
      setNotifications(newNotifications);
      notificationsStore.list = notificationsStore.list.filter((n) => n.id !== deleteNotifId);
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
            <Text style={s.emptyText}>Vous recevrez une notification quand quelqu'un interagit avec vos posts</Text>
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

      <Modal
        visible={deleteModal}
        transparent
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Confirmer la suppression</Text>
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
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const showPaymentButton = notification.status === 'accepted' &&
    (notification.type === 'course_request' || notification.type === 'reservation_request');

  const isCommunity = notification.type === 'like' || notification.type === 'comment';

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

      <Text style={s.cavalierPseudo}>@{notification.auteurPseudo}</Text>

      <Text style={s.detailsText}>
        {notification.donnees?.stageTitre || notification.donnees?.annonceTitre || notification.donnees?.titre} · {notification.donnees?.nombreParticipants || ''} {notification.donnees?.nombreParticipants ? 'participant' + (notification.donnees.nombreParticipants !== 1 ? 's' : '') : ''}
      </Text>

      <Text style={s.montantText}>💰 {notification.donnees?.prixTotal || notification.donnees?.prix}€ TTC</Text>

      <View style={s.buttonRow}>
        {showPaymentButton && (
          <TouchableOpacity style={[s.actionBtn, s.payBtn]} onPress={handlePaymentNavigation}>
            <Text style={s.payBtnText}>💳 Payer maintenant</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={onDelete}>
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
  authorAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  authorInitiales: { color: Colors.textInverse, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  notificationTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, marginLeft: 'auto' },
  notificationMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  statusBadgeMini: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.md, alignSelf: 'flex-start' },
  statusAcceptedMini: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#10B981' },
  statusRejectedMini: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#EF4444' },
  statusPendingMini: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#F59E0B' },
  statusBadgeTextMini: { fontWeight: FontWeight.semibold, fontSize: FontSize.xs, color: Colors.textPrimary },
  cavalierPseudo: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  detailsText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  montantText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  buttonRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  actionBtn: { flex: 1, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center', borderWidth: 1, borderColor: Colors.primaryBorder },
  payBtn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  payBtnText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: Colors.textInverse },
  deleteBtn: { backgroundColor: '#FEE2E2', borderColor: '#FEC2C2' },
  deleteBtnText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: '#DC2626' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, width: '80%', maxWidth: 300 },
  modalTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  modalButtons: { flexDirection: 'row', gap: Spacing.md },
  modalBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryBorder },
  modalBtnCancelText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: Colors.primary },
  modalBtnDelete: { backgroundColor: '#EF4444' },
  modalBtnDeleteText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: '#FFFFFF' },
});
