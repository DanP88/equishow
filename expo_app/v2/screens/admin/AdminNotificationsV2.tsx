// ─────────────────────────────────────────────────────────────────────────────
// AdminNotificationsV2 — reskin Blush de app/(tabs)/admin-notifications.tsx.
// Mêmes hooks (useNotifications + selectActiveNotifications) ; deep-links
// pointent vers les écrans admin V2 (support/disputes) au lieu de (tabs).
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { BL, FONT } from '../../ui/blush';
import { Spacing, FontSize, FontWeight } from '../../../constants/theme';
import { useNotifications } from '../../../hooks/useNotifications';
import { selectActiveNotifications } from '../../../hooks/useActiveNotifications';
import { userStore } from '../../../data/store';
import { Notification } from '../../../types/notification';

function adminTarget(n: Notification): string {
  if (n.type === 'support_request' || n.type === 'support_ack' || n.type === 'support_resolved') {
    const sid = n.donnees?.support_id;
    return sid ? `/(v2)/admin/support?ticket=${sid}` : '/(v2)/admin/support';
  }
  if (n.type === 'dispute_opened' || n.type === 'dispute_resolved' || n.type === 'escrow_alert') return '/(v2)/admin/disputes';
  return '';
}

export function AdminNotificationsV2() {
  const { notifications: allNotifs, markAsRead, markAllAsRead, removeNotification, isLoading } = useNotifications();
  const notifications = selectActiveNotifications(allNotifs, { courseDemands: [], stageReservations: [], viewerId: userStore.id });
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
          <Text style={s.h1}>Notifications</Text>
          {unreadCount > 0 && <Text style={s.headerSub}>{unreadCount} non lu{unreadCount > 1 ? 's' : ''}</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={s.markAllBtn} onPress={() => markAllAsRead()}>
            <Text style={s.markAllTxt}>Tout marquer lu</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.pad} showsVerticalScrollIndicator={false}>
        {isLoading && notifications.length === 0 ? (
          <View style={s.empty}><ActivityIndicator color={BL.accent} /></View>
        ) : notifications.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🔔</Text>
            <Text style={s.emptyTitle}>Aucune notification</Text>
            <Text style={s.emptyText}>Les alertes escrow, réclamations et litiges apparaîtront ici.</Text>
          </View>
        ) : notifications.map((n) => {
          const hasTarget = !!adminTarget(n);
          return (
            <View key={n.id} style={[s.card, !n.lu && s.cardUnread]}>
              <View style={s.cardTop}>
                <Text style={s.notifTitle}>{n.titre}</Text>
                {!n.lu && <View style={s.dot} />}
              </View>
              {!!n.message && <Text style={s.notifMsg}>{n.message}</Text>}
              <View style={s.btnRow}>
                {hasTarget && (
                  <TouchableOpacity style={[s.actionBtn, s.openBtn]} onPress={() => openNotif(n)}><Text style={s.openBtnTxt}>Ouvrir</Text></TouchableOpacity>
                )}
                {!n.lu && (
                  <TouchableOpacity style={[s.actionBtn, s.readBtn]} onPress={() => markAsRead(n.id)}><Text style={s.readBtnTxt}>Marquer lu</Text></TouchableOpacity>
                )}
                <TouchableOpacity style={[s.actionBtn, s.delBtn]} onPress={() => removeNotification(n.id)}><Text style={s.delBtnTxt}>🗑</Text></TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BL.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: BL.line, backgroundColor: BL.card },
  h1: { fontFamily: FONT.head, fontSize: 22, fontWeight: '700', color: BL.ink },
  headerSub: { fontSize: FontSize.xs, color: BL.sub, marginTop: 2 },
  markAllBtn: { backgroundColor: BL.accentSoft, borderRadius: 999, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: BL.accentLine },
  markAllTxt: { fontSize: FontSize.xs, color: BL.accent, fontWeight: FontWeight.semibold },
  pad: { padding: Spacing.lg, gap: Spacing.md },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: BL.ink },
  emptyText: { fontSize: FontSize.sm, color: BL.sub, textAlign: 'center' },
  card: { backgroundColor: BL.card, borderRadius: 16, padding: Spacing.lg, borderWidth: 1, borderColor: BL.line, gap: Spacing.sm },
  cardUnread: { borderLeftWidth: 4, borderLeftColor: BL.accent },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  notifTitle: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.bold, color: BL.ink },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BL.accent },
  notifMsg: { fontSize: FontSize.sm, color: BL.sub, lineHeight: 20 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  actionBtn: { borderRadius: 999, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, alignItems: 'center', borderWidth: 1 },
  openBtn: { flex: 1, backgroundColor: BL.accent, borderColor: BL.accent },
  openBtnTxt: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: '#fff' },
  readBtn: { backgroundColor: BL.accentSoft, borderColor: BL.accentLine },
  readBtnTxt: { fontWeight: FontWeight.semibold, fontSize: FontSize.xs, color: BL.accent },
  delBtn: { backgroundColor: '#FCE9EC', borderColor: '#F3C7CE' },
  delBtnTxt: { fontWeight: FontWeight.semibold, fontSize: FontSize.sm, color: BL.berry },
});
