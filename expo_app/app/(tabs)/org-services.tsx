import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

// LOT 1 Org V2 — l'ancien contenu affichait des statistiques services CODÉES EN DUR
// (Box 3/11/9, Transport 2/4/2) = données fabriquées, trompeuses. Retirées.
// Les vraies stats services par concours (annonces / réservées / CA) arriveront
// au LOT 2 (agrégat réel via fn_org_concours_radar étendu). En attendant :
// empty-state honnête, aucun chiffre inventé.
export default function OrgServicesScreen() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Services</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        <View style={s.card}>
          <Text style={s.icon}>📊</Text>
          <Text style={s.title}>Statistiques services à venir</Text>
          <Text style={s.text}>
            Les box, transports et coachs liés à tes concours, ainsi que les réservations générées,
            apparaîtront ici. En attendant, suis l'intérêt autour de tes concours dans le Radar de demande.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', gap: Spacing.sm, ...Shadow.card },
  icon: { fontSize: 40 },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  text: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
