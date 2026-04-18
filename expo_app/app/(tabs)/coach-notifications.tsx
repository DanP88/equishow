import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { notificationsStore, userStore } from '../../data/store';
import { Notification } from '../../types/notification';

export default function CoachNotificationsScreen() {
  const [notifications, setNotifications] = useState(notificationsStore.list);

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

  // Filtrer pour ne montrer que les notifications du coach actuel
  const myNotifications = notifications.filter(
    (n) => n.destinataireId === userStore.id
  );

  const unreadCount = myNotifications.filter((n) => !n.lu).length;



  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={s.headerSub}>{unreadCount} non lu{unreadCount > 1 ? 's' : ''}</Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {myNotifications.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🔔</Text>
            <Text style={s.emptyTitle}>Aucune notification</Text>
            <Text style={s.emptyText}>Vous recevrez une notification quand un cavalier vous envoie une demande de cours ou s'inscrit à un stage</Text>
          </View>
        ) : (
          myNotifications.map((notif) => (
            <NotificationCard
              key={notif.id}
              notification={notif}
            />
          ))
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

interface NotificationCardProps {
  notification: Notification;
}

function NotificationCard({ notification }: NotificationCardProps) {
  const isCourseRequest = notification.type === 'course_request';

  return (
    <View style={s.card}>
      {/* Status badge */}
      {notification.status && (
        <View style={[s.statusBadgeMini, notification.status === 'pending' ? s.statusPendingMini : (notification.status === 'accepted' ? s.statusAcceptedMini : s.statusRejectedMini)]}>
          <Text style={s.statusBadgeTextMini}>
            {notification.status === 'pending' ? '● En attente' : (notification.status === 'accepted' ? '● Acceptée' : '● Refusée')}
          </Text>
        </View>
      )}

      {/* Cavalier pseudo with avatar */}
      <View style={s.headerRow}>
        {notification.auteurCouleur && (
          <View style={[s.avatar, { backgroundColor: notification.auteurCouleur }]}>
            <Text style={s.avatarText}>{notification.auteurInitiales}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.cavalierPseudo}>@{notification.auteurPseudo}</Text>
          <Text style={s.messageText}>{notification.message}</Text>
        </View>
      </View>

      {/* Détails */}
      {isCourseRequest ? (
        <>
          <Text style={s.detailsText}>
            {notification.donnees?.annonceTitre}
            {notification.donnees?.concoursNom && ` · ${notification.donnees.concoursNom}`}
          </Text>
        </>
      ) : (
        <>
          <Text style={s.detailsText}>
            {notification.donnees?.stageTitre} · {notification.donnees?.nombreParticipants} participant{notification.donnees?.nombreParticipants !== 1 ? 's' : ''}
          </Text>
        </>
      )}
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
  container: { padding: Spacing.lg, gap: Spacing.md },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.md },
  statusBadgeMini: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.md, alignSelf: 'flex-start' },
  statusPendingMini: { backgroundColor: '#FFF3CD', borderWidth: 1, borderColor: '#FFC107' },
  statusAcceptedMini: { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#10B981' },
  statusRejectedMini: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#EF4444' },
  statusBadgeTextMini: { fontWeight: FontWeight.bold, fontSize: FontSize.xs, color: Colors.textPrimary },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textInverse },
  cavalierPseudo: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
  messageText: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  detailsText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  montantText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
});
