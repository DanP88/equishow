import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

const SERVICES = [
  { type: 'Box', annonces: 3, reservees: 11, libres: 9 },
  { type: 'Transport', annonces: 2, reservees: 4, libres: 2 },
];

export default function OrgServicesScreen() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Services</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {SERVICES.map((service) => (
          <View key={service.type} style={s.serviceCard}>
            <Text style={s.serviceTitle}>{service.type}</Text>
            <View style={s.statsRow}>
              <StatCard label="Annonces" value={service.annonces} color={Colors.primary} />
              <StatCard label="Réservées" value={service.reservees} color={Colors.success} />
              <StatCard label="Libres" value={service.libres} color={Colors.textSecondary} />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.md },
  serviceCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  serviceTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: 4, borderTopWidth: 3 },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
});
