import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useNotifications } from '../../hooks/useNotifications';
import { notificationsStore } from '../../data/notificationsStore';

const ICON_BY_TYPE: Record<string, string> = {
  mention: '🏷️',
  message: '💬',
  like: '❤️',
  comment: '💭',
};

export default function CoachNotificationsScreen() {
  const { notifications } = useNotifications();

  const unreadNotifs = notifications.filter(n => !n.read);
  const readNotifs = notifications.filter(n => n.read);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔔 Notifications</Text>
        {unreadNotifs.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadNotifs.length}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {unreadNotifs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Nouvelles</Text>
            {unreadNotifs.map((notif) => (
              <NotificationCard
                key={notif.id}
                notification={notif}
                onPress={() => notificationsStore.markAsRead(notif.id)}
              />
            ))}
          </>
        )}

        {readNotifs.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Antérieures</Text>
            {readNotifs.map((notif) => (
              <NotificationCard
                key={notif.id}
                notification={notif}
                isRead
              />
            ))}
          </>
        )}

        {notifications.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>Aucune notification</Text>
            <Text style={styles.emptyDesc}>Vous recevrez des notifications quand quelqu\'un vous tag</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NotificationCard({ notification, isRead, onPress }: {
  notification: any;
  isRead?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.notifCard, !isRead && styles.notifCardUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.notifIcon}>{ICON_BY_TYPE[notification.type] || '📌'}</Text>

      <View style={styles.notifContent}>
        <Text style={[styles.notifTitle, !isRead && styles.notifTitleBold]}>
          {notification.title}
        </Text>
        <Text style={styles.notifMessage} numberOfLines={2}>
          {notification.message}
        </Text>
        <Text style={styles.notifMeta}>
          {notification.author} • {formatTime(notification.timestamp)}
        </Text>
      </View>

      {!isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'À l\'instant';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}j`;

  return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
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
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  badge: {
    backgroundColor: '#FF4444',
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: { color: '#FFF', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textTertiary, marginBottom: Spacing.sm },
  notifCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
    alignItems: 'flex-start',
  },
  notifCardUnread: {
    backgroundColor: Colors.primaryLight + '15',
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  notifIcon: { fontSize: 24, marginTop: 2 },
  notifContent: { flex: 1, gap: Spacing.xs },
  notifTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  notifTitleBold: { fontWeight: FontWeight.bold },
  notifMessage: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  notifMeta: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.xs },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 2 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },
});
