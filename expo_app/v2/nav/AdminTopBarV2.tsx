// ─────────────────────────────────────────────────────────────────────────────
// AdminTopBarV2 — top bar de l'espace ADMIN V2. Minimale : logo + libellé
// « Administration » (pas de 🔔/💬 — l'admin a son propre onglet Notifs et
// n'a pas de messagerie dédiée en V1).
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '../../constants/theme';
import { BL, FONT } from '../ui/blush';

export function AdminTopBarV2() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingTop: insets.top + Spacing.sm }]}>
      <Text style={s.logo}>EquiShow</Text>
      <View style={s.pill}><Text style={s.pillTxt}>Administration</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, backgroundColor: BL.card, borderBottomWidth: 1, borderBottomColor: BL.line },
  logo: { fontFamily: FONT.head, fontSize: 19, fontWeight: '700', color: BL.accent, letterSpacing: -0.2 },
  pill: { backgroundColor: BL.lilacSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillTxt: { fontSize: 11, fontWeight: '700', color: BL.lilac },
});
