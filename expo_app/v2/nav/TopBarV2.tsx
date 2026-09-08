// ─────────────────────────────────────────────────────────────────────────────
// TopBarV2 — logo → Accueil · 🔔 Notifications · 💬 Messagerie · avatar → Profil.
// FIXE pour toutes les capacités.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { BL, FONT } from '../ui/blush';
import { Icon } from '../ui/Icon';
import { V2_TOPBAR } from './navConfig';
import { useV2Session } from '../auth';
import { useV2Notifications } from '../adapters/notifications';
import { useV2Conversations } from '../adapters/messaging';

export function TopBarV2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { identity } = useV2Session();
  const { unreadCount: notifCount } = useV2Notifications();
  const { unreadCount: msgCount } = useV2Conversations();

  const initials = ((identity?.prenom?.[0] ?? '') + (identity?.nom?.[0] ?? '')).toUpperCase() || 'EQ';

  return (
    <View style={[s.bar, { paddingTop: insets.top + Spacing.sm }]}>
      <TouchableOpacity onPress={() => router.replace(V2_TOPBAR.home as any)} activeOpacity={0.7}>
        <Text style={s.logo}>EquiShow</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <IconBtn name="bell-outline" count={notifCount} onPress={() => router.push(V2_TOPBAR.notifications as any)} />
      <IconBtn name="message-outline" count={msgCount} onPress={() => router.push(V2_TOPBAR.messagerie as any)} />
      <TouchableOpacity style={s.avatar} onPress={() => router.replace(V2_TOPBAR.profil as any)} activeOpacity={0.8}>
        <Text style={s.avatarTxt}>{initials}</Text>
      </TouchableOpacity>
    </View>
  );
}

function IconBtn({ name, count, onPress }: { name: string; count: number; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.iconBtn} onPress={onPress} activeOpacity={0.7}>
      <Icon name={name} size={21} color={BL.ink} />
      {count > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{count > 9 ? '9+' : count}</Text></View>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, backgroundColor: BL.card, borderBottomWidth: 1, borderBottomColor: BL.line },
  logo: { fontFamily: FONT.head, fontSize: 19, fontWeight: '700', color: BL.accent, letterSpacing: -0.2 },
  iconBtn: { padding: 4 },
  icon: { fontSize: 20 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: BL.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: BL.accentSoft },
  avatarTxt: { color: BL.accentInk, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  badge: { position: 'absolute', top: -2, right: -4, backgroundColor: BL.berry, borderRadius: 9, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
