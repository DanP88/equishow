import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useConcours, useConcoursCounts, useConcoursFollow } from '../../hooks/useConcours';
import { useScreenTracking } from '../../hooks/useScreenTracking';

/**
 * LOT 1 — Fiche concours (hub). Compteurs RÉELS masqués si 0 (anti cold-start).
 * Les boutons "Voir les …" naviguent vers Services filtré par le NOM du concours
 * (le filtre Services existant matche le champ texte `concours`, pas concours_id —
 * branchement non régressif sur la donnée actuelle).
 */
export default function ConcoursFicheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useScreenTracking('concours-fiche');
  const { concours, isLoading } = useConcours(id);
  const { counts } = useConcoursCounts(id);
  const { isFollowing, toggle, canFollow } = useConcoursFollow(id);

  if (isLoading) {
    return <SafeAreaView style={s.root}><View style={s.loader}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  }
  if (!concours) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
          <Text style={s.title}>Concours introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const goServices = (tab: 'transport' | 'box' | 'coach') =>
    router.push({ pathname: '/(tabs)/services', params: { tab, concours: concours.nom } } as any);

  const services: { key: 'box' | 'transport' | 'coach'; tab: 'box' | 'transport' | 'coach'; icon: string; label: string; count: number }[] = [
    { key: 'box', tab: 'box', icon: '📦', label: 'Box', count: counts.box },
    { key: 'transport', tab: 'transport', icon: '🚐', label: 'Transport', count: counts.transport },
    { key: 'coach', tab: 'coach', icon: '🎓', label: 'Coachs présents', count: counts.coach },
  ];
  const totalOffers = counts.box + counts.transport + counts.coach;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{concours.nom}</Text>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        <View style={s.bandRow}>
          <View style={s.band}><Text style={s.bandTxt}>{concours.type_concours ?? 'Concours'}{concours.departement ? ` · Dépt ${concours.departement}` : ''}</Text></View>
        </View>
        <Text style={s.nom}>🏆 {concours.nom}</Text>
        {!!concours.dateLabel && <Text style={s.meta}>📅 {concours.dateLabel}</Text>}
        {!!concours.lieu && <Text style={s.meta}>📍 {concours.lieu}</Text>}
        <Text style={s.metaDim}>
          {concours.numero_ffe ? `N° FFE ${concours.numero_ffe}` : ''}
          {concours.followers_count > 0 ? `${concours.numero_ffe ? ' · ' : ''}⭐ ${concours.followers_count} suivent` : ''}
        </Text>

        {!!concours.lien_ffe && (
          <>
            <TouchableOpacity style={s.ffeBtn} activeOpacity={0.85} onPress={() => Linking.openURL(concours.lien_ffe!)}>
              <Text style={s.ffeTxt}>🔗 S'inscrire sur la FFE  ↗</Text>
            </TouchableOpacity>
            <Text style={s.ffeNote}>Les inscriptions restent sur la FFE. Equishow t'aide à organiser le déplacement.</Text>
          </>
        )}

        <Text style={s.sectionTitle}>Organise ton déplacement</Text>
        <View style={s.servicesCard}>
          {services.map((sv) => (
            <TouchableOpacity key={sv.key} style={s.serviceRow} activeOpacity={0.8} onPress={() => goServices(sv.tab)}>
              <Text style={s.serviceIcon}>{sv.icon}</Text>
              <Text style={s.serviceLabel}>{sv.label}</Text>
              <View style={{ flex: 1 }} />
              {/* Compteur affiché UNIQUEMENT si > 0 (anti cold-start) */}
              {sv.count > 0 && (
                <View style={s.countPill}><Text style={s.countDot}>🟢</Text><Text style={s.countTxt}>{sv.count}</Text></View>
              )}
              <Text style={s.chev}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {totalOffers === 0 && (
          <View style={s.coldStart}>
            <Text style={s.coldTitle}>🪙 Sois le premier prévenu</Text>
            <Text style={s.coldTxt}>Aucune offre publiée pour l'instant. Suis ce concours pour être notifié dès qu'un box, transport ou coach arrive.</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.followBtn, isFollowing && s.followBtnOn, !canFollow && s.followBtnDisabled]}
          activeOpacity={0.85}
          disabled={!canFollow}
          onPress={toggle}
        >
          <Text style={[s.followTxt, isFollowing && s.followTxtOn]}>
            {!canFollow ? '⭐ Connecte-toi pour suivre' : isFollowing ? '⭐ Concours suivi ✓' : '⭐ Suivre ce concours'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceVariant },
  backTxt: { fontSize: 20, color: Colors.textPrimary },
  title: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  bandRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  band: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.xs, backgroundColor: Colors.primary },
  bandTxt: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  nom: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginBottom: 6 },
  meta: { fontSize: FontSize.base, color: Colors.textSecondary, marginBottom: 2 },
  metaDim: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 4, marginBottom: Spacing.md },
  ffeBtn: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  ffeTxt: { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  ffeNote: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 6, marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.md },
  servicesCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.card },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  serviceIcon: { fontSize: 18 },
  serviceLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  countPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.successBg, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  countDot: { fontSize: 9 },
  countTxt: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.bold },
  chev: { fontSize: 22, color: Colors.textTertiary },
  coldStart: { backgroundColor: Colors.goldBg, borderWidth: 1, borderColor: Colors.goldBorder, borderRadius: Radius.md, padding: Spacing.lg, marginTop: Spacing.md },
  coldTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.gold, marginBottom: 4 },
  coldTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  followBtn: { backgroundColor: Colors.primaryLight, borderWidth: 1.5, borderColor: Colors.primaryBorder, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg },
  followBtnOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  followBtnDisabled: { opacity: 0.5 },
  followTxt: { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  followTxtOn: { color: Colors.textInverse },
});
