// ─────────────────────────────────────────────────────────────────────────────
// AdminBottomBarV2 — barre d'onglets de l'espace ADMIN V2. Séparée de
// BottomBarV2 (cavalier/coach/organisateur) : mirroir Blush du set admin de
// components/CustomBottomBar.tsx (6 onglets opérationnels).
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontWeight } from '../../constants/theme';
import { BL } from '../ui/blush';
import { Icon } from '../ui/Icon';
import { ADMIN_TABS } from './adminNavConfig';
import { useV2AdminBadges } from '../adapters/admin';

export function AdminBottomBarV2() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { supportOpen, notifUnread } = useV2AdminBadges();

  const isActive = (t: (typeof ADMIN_TABS)[number]) =>
    t.match.some((m) => pathname === m || pathname.startsWith(m));

  const badgeFor = (key: string) => {
    if (key === 'support') return supportOpen;
    if (key === 'notifications') return notifUnread;
    return 0;
  };

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) }]}>
      {ADMIN_TABS.map((t) => {
        const active = isActive(t);
        const badge = badgeFor(t.key);
        return (
          <TouchableOpacity key={t.key} style={s.tab} activeOpacity={0.8} onPress={() => router.replace(t.route as any)}>
            <View>
              <Icon name={t.icon} size={21} color={active ? BL.accent : BL.faint} />
              {badge > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{badge > 9 ? '9+' : badge}</Text></View>}
            </View>
            <Text style={[s.label, active && s.labelOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: BL.card, borderTopWidth: 1, borderTopColor: BL.line, paddingTop: 8, paddingHorizontal: 2 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 1 },
  label: { fontSize: 9.5, fontWeight: FontWeight.semibold, color: BL.faint, textAlign: 'center' },
  labelOn: { color: BL.accent, fontWeight: FontWeight.bold },
  badge: { position: 'absolute', top: -5, right: -10, backgroundColor: BL.berry, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: BL.card },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
