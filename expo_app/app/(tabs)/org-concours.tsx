import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { concoursStore, userStore } from '../../data/store';

export default function OrgConcoursScreen() {
  const [concours, setConcours] = useState(concoursStore.list.filter(c => c.organisateurId === userStore.id));

  useFocusEffect(useCallback(() => {
    setConcours(concoursStore.list.filter(c => c.organisateurId === userStore.id));
  }, []));
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Mes concours</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        <TouchableOpacity style={s.createBtn} onPress={() => router.push('/creer-concours')} activeOpacity={0.85}>
          <Text style={s.createIcon}>🏆</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.createTitle}>Créer un concours</Text>
            <Text style={s.createHint}>Remplissez tous les détails de votre concours</Text>
          </View>
          <Text style={s.createArrow}>→</Text>
        </TouchableOpacity>

        {concours.length === 0 ? (
          <Text style={s.emptyText}>Aucun concours créé pour le moment</Text>
        ) : (
          concours.map((c) => {
            const dateStr = `${c.dateDebut.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}-${c.dateFin.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`;
            return (
              <TouchableOpacity key={c.id} style={s.concoursCard} activeOpacity={0.8}>
                <View style={s.concoursHeader}>
                  <Text style={s.concoursName}>{c.nom}</Text>
                  <View style={[s.statutBadge, { backgroundColor: c.statut === 'ouvert' ? Colors.successBg : Colors.surfaceVariant }]}>
                    <Text style={[s.statutText, { color: c.statut === 'ouvert' ? Colors.success : Colors.textSecondary }]}>
                      {c.statut === 'ouvert' ? '● Ouvert' : '○ Brouillon'}
                    </Text>
                  </View>
                </View>
                <Text style={s.concoursDate}>📅 {dateStr} — {c.lieu}</Text>
                <Text style={s.concoursDetail}>{c.disciplines.join(', ')} • {c.typesCavaliers.join(', ')}</Text>
                <View style={s.concoursStats}>
                  <StatBadge label="Inscrits" value={`${c.nbInscrits}/${c.nbPlaces}`} />
                  {c.prix && <StatBadge label="Prix" value={`${c.prix}€`} />}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statBadge}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.md },
  createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primaryBorder, gap: Spacing.md, ...Shadow.card },
  createIcon: { fontSize: 28 },
  createTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
  createHint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  createArrow: { fontSize: 20, color: Colors.primary, fontWeight: FontWeight.bold },
  concoursCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  concoursHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  concoursName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  statutBadge: { borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  statutText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  concoursDate: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
  concoursDetail: { fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.md },
  concoursStats: { flexDirection: 'row', gap: Spacing.sm },
  statBadge: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  statValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl },
});
