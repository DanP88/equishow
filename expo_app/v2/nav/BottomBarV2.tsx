// ─────────────────────────────────────────────────────────────────────────────
// BottomBarV2 — barre d'onglets V2. FIXE : 5 onglets identiques pour TOUTES les
// capacités (cf. navConfig). Aucune variante par rôle, aucun sélecteur de mode.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { FontWeight } from '../../constants/theme';
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
              <Text style={s.icon}>{t.icon}</Text>
              {badge > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{badge > 9 ? '9+' : badge}</Text></View>}
            </View>
            <Text style={[s.label, active && s.labelOn]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, paddingHorizontal: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4 },
  icon: { fontSize: 20 },
  label: { fontSize: 11, fontWeight: FontWeight.semibold, color: Colors.textTertiary },
  labelOn: { color: Colors.primary, fontWeight: FontWeight.bold },
  badge: { position: 'absolute', top: -5, right: -10, backgroundColor: '#FF4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: Colors.surface },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
