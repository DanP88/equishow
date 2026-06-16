import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { concoursStore, userStore } from '../../data/store';
import { useMyConcoursClaims } from '../../hooks/useConcoursClaims';

export default function OrgConcoursScreen() {
  const [concours, setConcours] = useState(concoursStore.list.filter(c => c.organisateurId === userStore.id));
  // LOT P0 — concours réels revendiqués (claims). Additif : ne remplace pas le mock.
  const { claims, reload: reloadClaims } = useMyConcoursClaims();
  // PART 3 — l'organisateur voit TOUS les statuts (en attente / approuvé / refusé).
  const revendiques = claims;

  useFocusEffect(useCallback(() => {
    setConcours(concoursStore.list.filter(c => c.organisateurId === userStore.id));
    reloadClaims();
  }, [reloadClaims]));
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

        {/* LOT P0 — Revendiquer un concours FFE existant + Radar de demande */}
        <TouchableOpacity style={s.claimBtn} onPress={() => router.push('/org-revendiquer' as any)} activeOpacity={0.85}>
          <Text style={s.createIcon}>📡</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.claimTitle}>Revendiquer un concours</Text>
            <Text style={s.createHint}>Accède au Radar de demande de ton concours</Text>
          </View>
          <Text style={s.createArrow}>→</Text>
        </TouchableOpacity>

        {/* PART 4 — Démo locale : visualiser le Radar même sans migration 076. */}
        {__DEV__ && (
          <TouchableOpacity
            style={s.demoBtn}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/org-radar', params: { concoursId: 'demo', nom: 'CSO de Deauville' } } as any)}
          >
            <Text style={s.createIcon}>🧪</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.claimTitle}>Voir un exemple de Radar</Text>
              <Text style={s.createHint}>Mode démonstration (local) — données d'exemple</Text>
            </View>
            <Text style={s.createArrow}>→</Text>
          </TouchableOpacity>
        )}

        {revendiques.length > 0 && (
          <View style={s.claimsSection}>
            <Text style={s.claimsTitle}>Mes concours revendiqués</Text>
            {revendiques.map((c) => {
              const approved = c.status === 'approved';
              const meta =
                c.status === 'approved' ? { label: '✅ Approuvé · 📊 Voir le Radar de demande', bg: '#ECFDF5', fg: '#10B981' }
                : c.status === 'rejected' ? { label: '❌ Refusé', bg: '#FEE2E2', fg: '#EF4444' }
                : { label: '⏳ En attente de validation', bg: '#FFF7ED', fg: '#F59E0B' };
              return (
                <TouchableOpacity
                  key={c.id}
                  style={s.claimCard}
                  activeOpacity={approved ? 0.8 : 1}
                  onPress={() => approved && router.push({ pathname: '/org-radar', params: { concoursId: c.concoursId, nom: c.concoursNom ?? '' } } as any)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.claimName} numberOfLines={1}>{c.concoursNom ?? c.concoursId}</Text>
                    <View style={[s.claimBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[s.claimBadgeTxt, { color: meta.fg }]}>{meta.label}</Text>
                    </View>
                  </View>
                  {approved && <Text style={s.createArrow}>→</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

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
  claimBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1.5, borderColor: Colors.primaryBorder, gap: Spacing.md },
  claimTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  claimsSection: { gap: Spacing.sm },
  claimsTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.sm },
  claimCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md, ...Shadow.card },
  claimName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  claimStatus: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  claimBadge: { alignSelf: 'flex-start', borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 3, marginTop: 6 },
  claimBadgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  demoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: '#FCD34D', gap: Spacing.md },
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
