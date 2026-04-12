import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

const MOCK = {
  tarifHeure: 65,
  disciplines: ['CSO', 'Hunter'],
  region: 'Auvergne-Rhône-Alpes',
};

export default function CoachServicesScreen() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Mes services</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        <View style={s.serviceCard}>
          <View style={s.serviceRow}>
            <Text style={s.serviceLabel}>Tarif horaire</Text>
            <Text style={s.serviceValue}>{MOCK.tarifHeure}€ HT / heure</Text>
          </View>
          <View style={s.serviceRow}>
            <Text style={s.serviceLabel}>Disciplines</Text>
            <Text style={s.serviceValue}>{MOCK.disciplines.join(', ')}</Text>
          </View>
          <View style={s.serviceRow}>
            <Text style={s.serviceLabel}>Région</Text>
            <Text style={s.serviceValue}>{MOCK.region}</Text>
          </View>
          <View style={[s.serviceRow, { borderBottomWidth: 0 }]}>
            <Text style={s.serviceLabel}>Commission plateforme</Text>
            <Text style={[s.serviceValue, { color: Colors.textTertiary }]}>9% par paiement</Text>
          </View>
        </View>

        <TouchableOpacity
          style={s.createButton}
          onPress={() => router.push('/proposer-coach-annonce')}
          activeOpacity={0.85}
        >
          <Text style={s.createIcon}>📢</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.createTitle}>Créer une annonce</Text>
            <Text style={s.createHint}>Proposez une séance, un stage ou un service</Text>
          </View>
          <Text style={s.createArrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.md },
  serviceCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, overflow: 'hidden' },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  serviceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  serviceValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  createButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primaryBorder, gap: Spacing.md, marginTop: Spacing.lg, ...Shadow.card },
  createIcon: { fontSize: 28 },
  createTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
  createHint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  createArrow: { fontSize: 20, color: Colors.primary, fontWeight: FontWeight.bold },
});
