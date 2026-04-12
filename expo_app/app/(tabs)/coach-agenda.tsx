import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

const AGENDA = [
  { jour: 'Mer 15 avr', creneaux: ['09h00 - SarahL_CSO · Éclipse', '14h30 - Libre', '16h00 - Libre'] },
  { jour: 'Sam 22 avr', creneaux: ['08h00 - ThomasR · Mistral', '10h00 - Libre'] },
];

export default function CoachAgendaScreen() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Mon agenda</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {AGENDA.map((a) => (
          <View key={a.jour} style={s.agendaDay}>
            <Text style={s.agendaJour}>{a.jour}</Text>
            {a.creneaux.map((c) => (
              <View key={c} style={[s.creneau, c.includes('Libre') && s.creneauLibre]}>
                <Text style={[s.creneauText, c.includes('Libre') && s.creneauLibreText]}>{c}</Text>
              </View>
            ))}
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
  agendaDay: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.xs },
  agendaJour: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  creneau: { backgroundColor: '#7C3AED15', borderRadius: Radius.sm, padding: Spacing.sm, borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
  creneauLibre: { backgroundColor: Colors.surfaceVariant, borderLeftColor: Colors.border },
  creneauText: { fontSize: FontSize.sm, color: '#7C3AED', fontWeight: FontWeight.semibold },
  creneauLibreText: { color: Colors.textTertiary, fontWeight: 'normal' },
});
