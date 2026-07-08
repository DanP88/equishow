import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../../constants/theme';
import { useConcours, useConcoursCounts, useConcoursFollow, useConcoursMyReservations } from '../../../hooks/useConcours';
import { useScreenTracking } from '../../../hooks/useScreenTracking';
import { trackCta } from '../../../lib/analytics';
import { ConcoursWeatherCard } from '../../../components/ConcoursWeatherCard';
import { ConcoursEpreuvesCard } from '../../../components/ConcoursEpreuvesCard';
import { ConcoursCategoriesCard } from '../../../components/ConcoursCategoriesCard';
import { ConcoursDiscussionEntry } from '../../../components/ConcoursDiscussionEntry';
import { PresenceButton } from '../../../components/PresenceButton';
import { ConcoursPresenceModule } from '../../../components/ConcoursPresenceModule';

/**
 * LOT 1 — Fiche concours (hub). Compteurs RÉELS masqués si 0 (anti cold-start).
 * Les boutons "Voir les …" naviguent vers Services filtré par le NOM du concours
 * (le filtre Services existant matche le champ texte `concours`, pas concours_id —
 * branchement non régressif sur la donnée actuelle).
 */
export default function ConcoursFicheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // metadata.concours_id : indispensable pour attribuer la vue au concours dans
  // le Radar organisateur (fn_org_concours_radar lit metadata->>'concours_id').
  useScreenTracking('concours-fiche', { concours_id: id });
  const { concours, isLoading } = useConcours(id);
  const { counts } = useConcoursCounts(id);
  const { mine } = useConcoursMyReservations(id);
  const { isFollowing, toggle, canFollow } = useConcoursFollow(id);

  // Retour fiable : en deep-link direct (URL /concours/[id]) il n'y a aucun
  // historique → router.back() est un no-op. Fallback vers le hub concours.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/concours-hub' as any);
  };

  if (isLoading) {
    return <SafeAreaView style={s.root}><View style={s.loader}><ActivityIndicator size="large" color={Colors.primary} /></View></SafeAreaView>;
  }
  if (!concours) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={goBack} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
          <Text style={s.title}>Concours introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const goServices = (tab: 'transport' | 'box' | 'coach') => {
    // LOT 2 — tracking clic module (alimente le Radar organisateur, KPI clics).
    // event_type='cta_click' + action dédiée (même convention que click_ffe ;
    // le CHECK user_events.event_type interdit un type custom). Pas d'historique.
    trackCta('concours-fiche', `concours_click_${tab}`, { concours_id: id });
    router.push({ pathname: '/(tabs)/services', params: { tab, concours: concours.nom } } as any);
  };

  const services: { key: 'box' | 'transport' | 'coach'; tab: 'box' | 'transport' | 'coach'; icon: string; label: string; count: number; reserved: boolean }[] = [
    { key: 'box', tab: 'box', icon: '📦', label: 'Box', count: counts.box, reserved: mine.box },
    { key: 'transport', tab: 'transport', icon: '🚐', label: 'Transport', count: counts.transport, reserved: mine.transport },
    { key: 'coach', tab: 'coach', icon: '🎓', label: 'Coachs présents', count: counts.coach, reserved: mine.coach },
  ];
  const totalOffers = counts.box + counts.transport + counts.coach;

  // Cross-sell « Mon déplacement » : ce qui est déjà réservé vs ce qu'il reste à
  // réserver (modules ayant des offres dispo). Affiché après un retour de paiement.
  const reservedLabels = services.filter((sv) => sv.reserved).map((sv) => sv.label);
  const remainingLabels = services.filter((sv) => !sv.reserved && sv.count > 0).map((sv) => sv.label);
  const anyReserved = reservedLabels.length > 0;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={goBack} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
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
            <TouchableOpacity style={s.ffeBtn} activeOpacity={0.85} onPress={() => { trackCta('concours-fiche', 'click_ffe', { concours_id: id }); Linking.openURL(concours.lien_ffe!); }}>
              <Text style={s.ffeTxt}>🔗 S'inscrire sur la FFE  ↗</Text>
            </TouchableOpacity>
            <Text style={s.ffeNote}>Les inscriptions restent sur la FFE. Equishow t'aide à organiser le déplacement.</Text>
          </>
        )}

        {/* Présence (PR2a, mig 089) — « J'y serai » + module Présence (compteurs,
            Vous, connaissances cheval-forward, « Tous les participants »). */}
        <PresenceButton concoursId={id} />
        <ConcoursPresenceModule concoursId={id} />

        {/* Météo V1 (Open-Meteo) — isolée, ne casse pas la fiche en cas d'échec. */}
        <ConcoursWeatherCard concours={concours} />

        {/* Catégories FFE importées (084) — lecture seule, masquée si rien d'importé. */}
        <ConcoursCategoriesCard concoursId={id} />

        {/* Épreuves importées (CSV FFE) — lecture seule, masquée si rien d'importé. */}
        <ConcoursEpreuvesCard concoursId={id} listeEpreuves={concours.liste_epreuves} />

        <Text style={s.sectionTitle}>{anyReserved ? 'Mon déplacement' : 'Organise ton déplacement'}</Text>
        {anyReserved && (
          <View style={s.nudge}>
            <Text style={s.nudgeTxt}>
              {remainingLabels.length > 0
                ? `✅ ${reservedLabels.join(', ')} réservé${reservedLabels.length > 1 ? 's' : ''} — pense aussi à ${remainingLabels.join(' et ')} pour ce concours.`
                : '🎉 Ton déplacement est complet pour ce concours !'}
            </Text>
          </View>
        )}
        <View style={s.servicesCard}>
          {services.map((sv) => (
            <TouchableOpacity key={sv.key} style={s.serviceRow} activeOpacity={0.8} onPress={() => goServices(sv.tab)}>
              <Text style={s.serviceIcon}>{sv.icon}</Text>
              <Text style={s.serviceLabel}>{sv.label}</Text>
              <View style={{ flex: 1 }} />
              {/* Réservé par moi → ✓ vert (cross-sell). Sinon compteur si > 0. */}
              {sv.reserved ? (
                <View style={s.reservedPill}><Text style={s.reservedTxt}>✓ Réservé</Text></View>
              ) : sv.count > 0 ? (
                <View style={s.countPill}><Text style={s.countDot}>🟢</Text><Text style={s.countTxt}>{sv.count}</Text></View>
              ) : null}
              <Text style={s.chev}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Discussion publique du concours (LOT 1) — entrée unique après services. */}
        <ConcoursDiscussionEntry concoursId={id} />

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
  reservedPill: { backgroundColor: Colors.success, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  reservedTxt: { fontSize: FontSize.xs, color: Colors.textInverse, fontWeight: FontWeight.bold },
  nudge: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryBorder, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  nudgeTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
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
