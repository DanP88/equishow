import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { concoursStore } from '../../data/store';
import { Concours } from '../../types/concours';

export default function CoachConcoursScreen() {
  const [concours, setConcours] = useState<Concours[]>(
    concoursStore.list.filter(c => c.statut !== 'brouillon')
  );

  useFocusEffect(useCallback(() => {
    setConcours(concoursStore.list.filter(c => c.statut !== 'brouillon'));
  }, []));

  const handleCreateAnnouncement = () => {
    router.push('/proposer-coach-annonce');
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Concours disponibles</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {concours.length === 0 ? (
          <Text style={s.emptyText}>Aucun concours disponible pour le moment</Text>
        ) : (
          concours.map((c) => {
            const dateStr = `${c.dateDebut.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}-${c.dateFin.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`;
            return (
              <View key={c.id} style={s.concoursCard}>
                <View style={s.concoursHeader}>
                  <Text style={s.concoursName}>{c.nom}</Text>
                  <View style={[s.statutBadge, { backgroundColor: Colors.successBg }]}>
                    <Text style={[s.statutText, { color: Colors.success }]}>
                      ● Ouvert
                    </Text>
                  </View>
                </View>
                <Text style={s.concoursDate}>📅 {dateStr} — {c.lieu}</Text>
                <Text style={s.concoursDetail}>{c.disciplines.join(', ')} • {c.typesCavaliers.join(', ')}</Text>

                {c.horaireDebut && (
                  <Text style={s.concoursHoraire}>🕐 {c.horaireDebut} - {c.horaireFin || '?'}</Text>
                )}

                <View style={s.concoursStats}>
                  <StatBadge label="Inscrits" value={`${c.nbInscrits}/${c.nbPlaces}`} />
                  {c.prix && <StatBadge label="Prix" value={`${c.prix}€`} />}
                </View>

                <TouchableOpacity
                  style={s.createBtn}
                  onPress={handleCreateAnnouncement}
                  activeOpacity={0.8}
                >
                  <Text style={s.createBtnText}>Créer une annonce pour ce concours</Text>
                  <Text style={s.createArrow}>→</Text>
                </TouchableOpacity>
              </View>
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
  concoursCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  concoursHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  concoursName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  statutBadge: { borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  statutText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  concoursDate: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
  concoursDetail: { fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.md },
  concoursHoraire: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  concoursStats: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statBadge: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  statValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryBorder, gap: Spacing.md, justifyContent: 'space-between' },
  createBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary, flex: 1 },
  createArrow: { fontSize: 18, color: Colors.primary, fontWeight: FontWeight.bold },
  emptyText: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl },
});
