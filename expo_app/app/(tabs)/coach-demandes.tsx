import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

const DEMANDES = [
  { id: '1', cavalier: 'SarahL_CSO', cheval: 'Éclipse du Vent', date: '15 avr', lieu: 'Grand Prix de Lyon', discipline: 'CSO', statut: 'nouveau' },
  { id: '2', cavalier: 'ThomasR_CCE', cheval: 'Mistral', date: '22 avr', lieu: 'Championnat Dressage', discipline: 'Hunter', statut: 'confirme' },
  { id: '3', cavalier: 'Lucie_CSO_Pro', cheval: 'Diamant Noir', date: '10 mai', lieu: 'Trophée CCE', discipline: 'CSO', statut: 'confirme' },
];

export default function CoachDemandesScreen() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Demandes reçues</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {DEMANDES.map((d) => (
          <View key={d.id} style={s.demandeCard}>
            <View style={s.demandeLeft}>
              <View style={[s.demandeStatut, { backgroundColor: d.statut === 'nouveau' ? Colors.primaryLight : Colors.successBg }]}>
                <Text style={[s.demandeStatutText, { color: d.statut === 'nouveau' ? Colors.primary : Colors.success }]}>
                  {d.statut === 'nouveau' ? '● Nouveau' : '✓ Confirmé'}
                </Text>
              </View>
              <Text style={s.demandeCavalier}>@{d.cavalier}</Text>
              <Text style={s.demandeDetail}>{d.cheval} · {d.discipline}</Text>
              <Text style={s.demandeDate}>📅 {d.date} — {d.lieu}</Text>
            </View>
            {d.statut === 'nouveau' && (
              <View style={s.demandeActions}>
                <TouchableOpacity style={s.refuseBtn} onPress={() => Alert.alert('Demande refusée')}>
                  <Text style={s.refuseText}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.acceptBtn} onPress={() => Alert.alert('Demande acceptée ✓')}>
                  <Text style={s.acceptText}>✓</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.md },
  demandeCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  demandeLeft: { flex: 1, gap: 3 },
  demandeStatut: { alignSelf: 'flex-start', borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  demandeStatutText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  demandeCavalier: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  demandeDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  demandeDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
  demandeActions: { gap: Spacing.xs },
  refuseBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: Colors.urgentBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.urgentBg },
  refuseText: { color: Colors.urgent, fontWeight: FontWeight.bold },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: Colors.textInverse, fontWeight: FontWeight.bold },
});
