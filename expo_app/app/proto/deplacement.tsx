import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { getProtoConcours, PROTO_DEPLACEMENT_DEFAULT } from '../../data/mockProto';

/**
 * PROTOTYPE — Étape 8 : « Mon déplacement ».
 * Conteneur piloté par la demande : box / transport / coach pour un même concours.
 * Embryon de la proposition concurrente (panier déplacement).
 */
const PRIX = { box: 90, transport: 120, coach: 65 };

export default function ProtoDeplacement() {
  const [dep, setDep] = useState(PROTO_DEPLACEMENT_DEFAULT);
  const concours = getProtoConcours(dep.concoursId);

  const toggle = (k: 'box' | 'transport' | 'coach') => setDep((d) => ({ ...d, [k]: !d[k] }));
  const total =
    (dep.box ? PRIX.box : 0) + (dep.transport ? PRIX.transport : 0) + (dep.coach ? PRIX.coach : 0);

  const rows: { key: 'box' | 'transport' | 'coach'; icon: string; label: string; prix: number }[] = [
    { key: 'box', icon: '📦', label: 'Box', prix: PRIX.box },
    { key: 'transport', icon: '🚐', label: 'Transport', prix: PRIX.transport },
    { key: 'coach', icon: '🎓', label: 'Coach', prix: PRIX.coach },
  ];

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title}>🧳 Mon déplacement</Text>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        <View style={s.ctxCard}>
          <Text style={s.ctxNom}>🏆 {concours?.nom}</Text>
          <Text style={s.ctxMeta}>📅 {concours?.dateLabel} · 📍 {concours?.lieu}</Text>
        </View>

        <Text style={s.sectionTitle}>Ma checklist</Text>
        <View style={s.card}>
          {rows.map((r) => {
            const on = dep[r.key];
            return (
              <View key={r.key} style={s.row}>
                <Text style={s.rowIcon}>{r.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{r.label}</Text>
                  <Text style={[s.rowState, on ? s.stateOk : s.stateKo]}>
                    {on ? `✅ réservé · ${r.prix} €` : '❌ à ajouter'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.actBtn, on ? s.actBtnOff : s.actBtnOn]}
                  onPress={() => toggle(r.key)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.actTxt, on ? s.actTxtOff : s.actTxtOn]}>
                    {on ? 'Retirer' : 'Ajouter'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total déplacement</Text>
          <Text style={s.totalValue}>{total} €</Text>
        </View>

        <TouchableOpacity style={[s.checkoutBtn, total === 0 && s.checkoutDisabled]} disabled={total === 0} activeOpacity={0.85}>
          <Text style={s.checkoutTxt}>🔒 Tout réserver (séquestre)</Text>
        </TouchableOpacity>
        <Text style={s.note}>
          Le déplacement marche même incomplet : un box seul reste valide, le reste s'ajoute quand
          l'offre existe. Pas de cul-de-sac « 0 dispo ».
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceVariant },
  backTxt: { fontSize: 20, color: Colors.textPrimary },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  list: { padding: Spacing.lg, paddingBottom: 100 },

  ctxCard: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryBorder, borderRadius: Radius.md, padding: Spacing.lg },
  ctxNom: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primaryDark },
  ctxMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },

  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: { fontSize: 20 },
  rowLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  rowState: { fontSize: FontSize.xs, marginTop: 2, fontWeight: FontWeight.semibold },
  stateOk: { color: Colors.success },
  stateKo: { color: Colors.textTertiary },
  actBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1 },
  actBtnOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  actBtnOff: { backgroundColor: Colors.surface, borderColor: Colors.borderMedium },
  actTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  actTxtOn: { color: Colors.textInverse },
  actTxtOff: { color: Colors.textSecondary },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg },
  totalLabel: { fontSize: FontSize.base, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  checkoutBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  checkoutDisabled: { backgroundColor: Colors.borderMedium },
  checkoutTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  note: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.sm, lineHeight: 17 },
});
