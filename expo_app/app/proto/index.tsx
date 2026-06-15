import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

/**
 * PROTOTYPE — hub de navigation vers tous les écrans de la vision
 * « Concours contexte + Mon déplacement ». Écran jetable, mock uniquement.
 */

const SCREENS: { icon: string; title: string; sub: string; route: string }[] = [
  { icon: '🏆', title: 'Liste des concours', sub: 'Étape 4 — 3 concours mockés', route: '/proto/concours-list' },
  { icon: '📋', title: 'Fiche concours (A — avec compteurs)', sub: 'Étape 5 · Variante A', route: '/proto/concours/p-fontainebleau?variant=A' },
  { icon: '📋', title: 'Fiche concours (B — sans compteur)', sub: 'Étape 5 · Variante B', route: '/proto/concours/p-fontainebleau?variant=B' },
  { icon: '🪙', title: 'Fiche concours « mince » (Lyon)', sub: 'Anti cold-start — concours quasi vide', route: '/proto/concours/p-lyon?variant=A' },
  { icon: '🎓', title: 'Fiche coach + présence concours', sub: 'Étape 6 · confirmé / intéressé', route: '/proto/coach' },
  { icon: '🏟️', title: 'Espace organisateur', sub: 'Étape 7 · Mes concours + revendiquer', route: '/proto/org' },
  { icon: '🧳', title: 'Mon déplacement', sub: 'Étape 8 · conteneur box/transport/coach', route: '/proto/deplacement' },
  { icon: '✅', title: 'Cross-sell post-réservation', sub: 'Étape 9 · écran succès', route: '/proto/cross-sell' },
];

export default function ProtoHub() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <View>
          <Text style={s.title}>🧪 Prototype Concours</Text>
          <Text style={s.sub}>Vision « contexte + Mon déplacement »</Text>
        </View>
      </View>

      <View style={s.notice}>
        <Text style={s.noticeTxt}>
          Écrans de démonstration — données 100% mockées, aucune action réelle (DB, paiement, prod).
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {SCREENS.map((sc) => (
          <TouchableOpacity key={sc.route} style={s.card} activeOpacity={0.85} onPress={() => router.push(sc.route as any)}>
            <Text style={s.cardIcon}>{sc.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{sc.title}</Text>
              <Text style={s.cardSub}>{sc.sub}</Text>
            </View>
            <Text style={s.chev}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceVariant },
  backTxt: { fontSize: 20, color: Colors.textPrimary },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  notice: { margin: Spacing.lg, marginBottom: 0, backgroundColor: Colors.infoBg, borderWidth: 1, borderColor: Colors.infoBorder, borderRadius: Radius.md, padding: Spacing.md },
  noticeTxt: { fontSize: FontSize.sm, color: Colors.info, lineHeight: 18 },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 100 },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, ...Shadow.card },
  cardIcon: { fontSize: 24 },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  chev: { fontSize: 24, color: Colors.textTertiary },
});
