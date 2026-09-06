// v2/ui/prep — éléments visuels du « tableau de bord » Mon concours (F4).
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { PrepStatus, STATUS_META } from '../state/concoursLocal';

/** Barre de préparation « 3 / 5 éléments préparés ». */
export function PrepBar({ score, total }: { score: number; total: number }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  const done = score === total;
  return (
    <View style={p.wrap}>
      <View style={p.headRow}>
        <Text style={p.title}>Préparation du concours</Text>
        <Text style={[p.count, done && { color: Colors.success }]}>{score} / {total}</Text>
      </View>
      <View style={p.track}>
        <View style={[p.fill, { width: `${pct}%` }, done && { backgroundColor: Colors.success }]} />
      </View>
      <Text style={p.sub}>{done ? 'Tout est prêt pour ce concours 🎉' : `${total - score} élément${total - score > 1 ? 's' : ''} à décider`}</Text>
    </View>
  );
}

/** Pastille d'état : ✅ Prêt · 🟠 À organiser · 🔎 Recherche · 📣 Je propose · ➖ Pas nécessaire */
export function StatePill({ status }: { status: PrepStatus }) {
  const m = STATUS_META[status];
  return (
    <View style={[p.pill, { borderColor: m.dot + '55', backgroundColor: m.dot + '14' }]}>
      <Text style={[p.pillTxt, { color: m.dot }]}>{m.label}</Text>
    </View>
  );
}

const p = StyleSheet.create({
  wrap: { gap: 6 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  count: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.primaryDark },
  track: { height: 8, borderRadius: 4, backgroundColor: '#EDEBE6', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});
