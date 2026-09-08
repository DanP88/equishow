// ─────────────────────────────────────────────────────────────────────────────
// BottomBarV2 — barre d'onglets V2. FIXE : 5 onglets identiques pour TOUTES les
// capacités (cf. navConfig). Aucune variante par rôle, aucun sélecteur de mode.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontWeight } from '../../constants/theme';
import { BL } from '../ui/blush';
import { Icon } from '../ui/Icon';
import { V2_TABS } from './navConfig';
import { useV2Agenda } from '../adapters/agenda';

export function BottomBarV2() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Badge Agenda = évènements imminents à traiter (indicatif, lecture seule).
  const { pendingCount: agendaBadge } = useV2Agenda();

  const isActive = (t: (typeof V2_TABS)[number]) =>
    t.match.some((m) => pathname === m || pathname.startsWith(m));

  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) }]}>
      {V2_TABS.map((t) => {
        const active = isActive(t);
        const badge = t.key === 'agenda' ? agendaBadge : 0;
        return (
          <TouchableOpacity key={t.key} style={s.tab} activeOpacity={0.8} onPress={() => router.replace(t.route as any)}>
            <View>
              <Icon name={t.icon} size={22} color={active ? BL.accent : BL.faint} />
              {badge > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{badge > 9 ? '9+' : badge}</Text></View>}
            </View>
            <Text style={[s.label, active && s.labelOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: BL.card, borderTopWidth: 1, borderTopColor: BL.line, paddingTop: 8, paddingHorizontal: 2 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 2 },
  icon: { fontSize: 20 },
  label: { fontSize: 10.5, fontWeight: FontWeight.semibold, color: BL.faint, textAlign: 'center' },
  labelOn: { color: BL.accent, fontWeight: FontWeight.bold },
  badge: { position: 'absolute', top: -5, right: -10, backgroundColor: BL.berry, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: BL.card },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
