import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { getProtoConcours } from '../../data/mockProto';

/**
 * PROTOTYPE — Étape 9 : cross-sell post-réservation (écran succès).
 * Box réservé → propose transport + coach du même concours. Friction = nulle (intention déjà convertie).
 */
export default function ProtoCrossSell() {
  const concours = getProtoConcours('p-fontainebleau');

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.list}>
        {/* Succès */}
        <View style={s.successHead}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Box réservé</Text>
          <Text style={s.successSub}>Box confort · Écurie des Pins · 14 → 16 juil · 90 €</Text>
          <View style={s.escrow}>
            <Text style={s.escrowTxt}>🔒 Fonds sécurisés (séquestre)</Text>
          </View>
        </View>

        {/* Contexte concours */}
        <View style={s.ctxCard}>
          <Text style={s.ctxLabel}>🏆 Tu participes à</Text>
          <Text style={s.ctxNom}>{concours?.nom}</Text>
          <Text style={s.ctxMeta}>📅 {concours?.dateLabel} · 📍 {concours?.lieu}</Text>
        </View>

        {/* Cross-sell */}
        <Text style={s.sectionTitle}>Complète ton déplacement</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.row} activeOpacity={0.8} onPress={() => router.push('/proto/deplacement' as any)}>
            <Text style={s.rowIcon}>🚐</Text>
            <Text style={s.rowLabel}>{concours?.nbTransports} transports vers {concours?.lieu.split(',')[0]}</Text>
            <Text style={s.chev}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.row, s.rowLast]} activeOpacity={0.8} onPress={() => router.push('/proto/coach' as any)}>
            <Text style={s.rowIcon}>🎓</Text>
            <Text style={s.rowLabel}>{concours?.nbCoachs} coachs présents</Text>
            <Text style={s.chev}>›</Text>
          </TouchableOpacity>
        </View>

        {/* CTA conteneur */}
        <TouchableOpacity style={s.primaryBtn} activeOpacity={0.85} onPress={() => router.push('/proto/deplacement' as any)}>
          <Text style={s.primaryTxt}>🧳 Voir mon déplacement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondaryBtn} activeOpacity={0.8} onPress={() => router.push('/proto' as any)}>
          <Text style={s.secondaryTxt}>Terminer</Text>
        </TouchableOpacity>

        <Text style={s.note}>
          « Voir mon déplacement » = embryon de la proposition concurrente (panier déplacement).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, paddingTop: Spacing.xxxl, paddingBottom: 100 },
  successHead: { alignItems: 'center', gap: 6 },
  successIcon: { fontSize: 56 },
  successTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  successSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  escrow: { backgroundColor: Colors.successBg, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 6, marginTop: 6 },
  escrowTxt: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.bold },

  ctxCard: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryBorder, borderRadius: Radius.md, padding: Spacing.lg, marginTop: Spacing.xl },
  ctxLabel: { fontSize: FontSize.xs, color: Colors.primaryDark, fontWeight: FontWeight.bold },
  ctxNom: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginTop: 2 },
  ctxMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { fontSize: 20 },
  rowLabel: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  chev: { fontSize: 22, color: Colors.textTertiary },

  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg },
  primaryTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  secondaryBtn: { paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.xs },
  secondaryTxt: { color: Colors.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.base },
  note: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.md, textAlign: 'center', lineHeight: 16 },
});
