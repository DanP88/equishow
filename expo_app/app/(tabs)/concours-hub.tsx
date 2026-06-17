import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useConcoursList } from '../../hooks/useConcours';
import { useScreenTracking } from '../../hooks/useScreenTracking';

const DISC_COLORS: Record<string, string> = {
  CSO: Colors.cso, Dressage: Colors.dressage, CCE: Colors.cce, Hunter: Colors.hunter,
};

/**
 * LOT 1 — Liste concours (hub découverte). Source = table public.concours
 * (hook useConcoursList, fallback mock en __DEV__ tant que 074 non appliquée).
 */
// Concours passé = date de fin (ou début) antérieure à aujourd'hui.
function isPastConcours(c: { date_fin: string | null; date_debut: string | null }): boolean {
  const d = c.date_fin ?? c.date_debut;
  if (!d) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(`${d}T00:00:00`) < today;
}

export default function ConcoursHubScreen() {
  useScreenTracking('concours-hub');
  const { concours, isLoading, usingMock } = useConcoursList();
  const [tab, setTab] = useState<'avenir' | 'passes'>('avenir');

  const { avenir, passes } = useMemo(() => {
    const av: typeof concours = [];
    const pa: typeof concours = [];
    for (const c of concours) (isPastConcours(c) ? pa : av).push(c);
    // À venir : date la plus proche d'abord (liste déjà triée date_debut ASC).
    // Passés : le plus récent passé d'abord (ordre inverse).
    pa.reverse();
    return { avenir: av, passes: pa };
  }, [concours]);

  const shown = tab === 'passes' ? passes : avenir;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/services' as any); }} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🏆 Concours</Text>
          <Text style={s.sub}>Prépare ton déplacement</Text>
        </View>
      </View>

      {usingMock && (
        <View style={s.mockBanner}>
          <Text style={s.mockTxt}>⚙️ Données de démonstration (migration 074 non appliquée)</Text>
        </View>
      )}

      {/* Onglets À venir / Concours passés */}
      {!isLoading && concours.length > 0 && (
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, tab === 'avenir' && s.tabActive]} onPress={() => setTab('avenir')} activeOpacity={0.8}>
            <Text style={[s.tabTxt, tab === 'avenir' && s.tabTxtActive]}>À venir ({avenir.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, tab === 'passes' && s.tabActive]} onPress={() => setTab('passes')} activeOpacity={0.8}>
            <Text style={[s.tabTxt, tab === 'passes' && s.tabTxtActive]}>Concours passés ({passes.length})</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : concours.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🏆</Text>
          <Text style={s.emptyTitle}>Aucun concours pour l'instant</Text>
          <Text style={s.emptyTxt}>Les concours importés depuis la FFE apparaîtront ici.</Text>
        </View>
      ) : shown.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>{tab === 'passes' ? '🕓' : '🏆'}</Text>
          <Text style={s.emptyTitle}>{tab === 'passes' ? 'Aucun concours passé' : 'Aucun concours à venir'}</Text>
          <Text style={s.emptyTxt}>{tab === 'passes' ? 'Les concours terminés apparaîtront ici.' : 'Les prochains concours apparaîtront ici.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {shown.map((c) => {
            const color = DISC_COLORS[c.type_concours ?? ''] ?? Colors.primary;
            return (
              <TouchableOpacity
                key={c.id}
                style={s.card}
                activeOpacity={0.85}
                onPress={() => router.push(`/concours/${c.id}` as any)}
              >
                <View style={[s.band, { backgroundColor: color }]}>
                  <Text style={s.bandTxt}>{c.type_concours ?? 'Concours'}{c.departement ? ` · Dépt ${c.departement}` : ''}</Text>
                </View>
                <View style={s.body}>
                  <Text style={s.nom}>🏆 {c.nom}</Text>
                  {!!c.dateLabel && <Text style={s.meta}>📅 {c.dateLabel}</Text>}
                  {!!c.lieu && <Text style={s.meta}>📍 {c.lieu}</Text>}
                  <View style={s.footer}>
                    {c.followers_count > 0
                      ? <Text style={s.followers}>⭐ {c.followers_count} suivent</Text>
                      : <View />}
                    <View style={s.voirBtn}><Text style={s.voirTxt}>Voir →</Text></View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
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
  tabs: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.surfaceVariant, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryBorder },
  tabTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  tabTxtActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  mockBanner: { backgroundColor: Colors.warningBg, borderBottomWidth: 1, borderBottomColor: Colors.warningBorder, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  mockTxt: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyTxt: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center' },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.card },
  band: { paddingHorizontal: Spacing.lg, paddingVertical: 4 },
  bandTxt: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  body: { padding: Spacing.lg },
  nom: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 6 },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md },
  followers: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  voirBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  voirTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
