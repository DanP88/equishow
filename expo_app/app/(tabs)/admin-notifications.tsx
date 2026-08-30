import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { AuthGuard } from '../../components/AuthGuard';
import { useNotifications } from '../../hooks/useNotifications';
import { selectActiveNotifications } from '../../hooks/useActiveNotifications';
import { userStore } from '../../data/store';
import { useScreenTracking } from '../../hooks/useScreenTracking';
import { Notification } from '../../types/notification';

export default function AdminNotificationsScreen() {
  return (
    <AuthGuard requiredRole="admin">
      <AdminNotificationsContent />
    </AuthGuard>
  );
}

// Deep-link admin selon le type de notification (réutilise les écrans existants).
function adminTarget(n: Notification): string {
  if (n.type === 'support_request' || n.type === 'support_ack' || n.type === 'support_resolved') {
    const sid = n.donnees?.support_id;
    return sid ? `/(tabs)/admin-support?ticket=${sid}` : '/(tabs)/admin-support';
  }
  if (n.type === 'dispute_opened' || n.type === 'dispute_resolved') return '/(tabs)/admin-disputes';
  if (n.type === 'escrow_alert') return '/(tabs)/admin-disputes';
  return n.actionUrl ?? '';
}

function AdminNotificationsContent() {
  useScreenTracking('admin-notifications');
  const { notifications: allNotifs, markAsRead, markAllAsRead, removeNotification, isLoading } = useNotifications();

  // Règle unique (N4/N5) : exclut `message` + notifs de demande obsolètes.
  const notifications = selectActiveNotifications(allNotifs, {
    courseDemands: [], stageReservations: [], viewerId: userStore.id,
  });
  const unreadCount = notifications.filter((n) => !n.lu).length;

  function openNotif(n: Notification) {
    if (!n.lu) markAsRead(n.id);
    const target = adminTarget(n);
    if (target) router.push(target as any);
  }

  return (
    <View style={s.root}>
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
        {isLoading && notifications.length === 0 ? (
          <View style={s.emptyState}><ActivityIndicator color={Colors.primary} /></View>
        ) : notifications.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🔔</Text>
            <Text style={s.emptyTitle}>Aucune notification</Text>
            <Text style={s.emptyText}>Les alertes escrow, réclamations et litiges apparaîtront ici.</Text>
          </View>
        ) : (
          notifications.map((n) => {
            const hasTarget = !!adminTarget(n);
            return (
              <View key={n.id} style={[s.card, !n.lu && s.cardUnread]}>
                <View style={s.cardTop}>
                  <Text style={s.notifTitle}>{n.titre}</Text>
                  {!n.lu && <View style={s.unreadDot} />}
                </View>
                {!!n.message && <Text style={s.notifMessage}>{n.message}</Text>}
                <View style={s.buttonRow}>
                  {hasTarget && (
                    <TouchableOpacity style={[s.actionBtn, s.openBtn]} onPress={() => openNotif(n)}>
                      <Text style={s.openBtnText}>Ouvrir</Text>
                    </TouchableOpacity>
                  )}
                  {!n.lu && (
                    <TouchableOpacity style={[s.actionBtn, s.readBtn]} onPress={() => markAsRead(n.id)}>
                      <Text style={s.readBtnText}>Marquer lu</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={() => removeNotification(n.id)}>
                    <Text style={s.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
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
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.sm },
  cardUnread: { borderLeftWidth: 4, borderLeftColor: Colors.primary },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  notifTitle: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  notifMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  buttonRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  actionBtn: { borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, alignItems: 'center', borderWidth: 1 },
  openBtn: { flex: 1, backgroundColor: Colors.primary, borderColor: Colors.primary },
  openBtnText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: Colors.textInverse },
  readBtn: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryBorder },
  readBtnText: { fontWeight: FontWeight.semibold, fontSize: FontSize.xs, color: Colors.primary },
  deleteBtn: { backgroundColor: '#FEE2E2', borderColor: '#FEC2C2' },
  deleteBtnText: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: '#DC2626' },
});
