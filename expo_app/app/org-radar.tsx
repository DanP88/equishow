// ─────────────────────────────────────────────────────────────────────────────
// org-radar — LOT Organisateur P0. « Radar de demande » d'UN concours revendiqué.
// Données 100% RÉELLES via fn_org_concours_radar (SECURITY DEFINER, ownership +
// masquage RGPD < 5 côté serveur). Aucune donnée nominative. No-fake-KPI.
// Accès : organisateur propriétaire (claim approuvé) ou admin. Sinon 42501.
// ─────────────────────────────────────────────────────────────────────────────

import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { useScreenTracking } from '../hooks/useScreenTracking';
import { useOrgRadar } from '../hooks/useOrgRadar';

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const maskedNum = (v: number | null) => (v == null ? '< 5' : String(v));

export default function OrgRadarScreen() {
  const { concoursId, nom } = useLocalSearchParams<{ concoursId?: string; nom?: string }>();
  useScreenTracking('org-radar');
  const { radar, isLoading, error, reload } = useOrgRadar(concoursId, 30);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/org-concours')} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>Radar de demande</Text>
          {!!nom && <Text style={s.sub} numberOfLines={1}>{nom}</Text>}
        </View>
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : error === 'not_authorized' ? (
        <View style={s.center}>
          <Text style={s.lockIcon}>🔒</Text>
          <Text style={s.lockTitle}>Accès réservé</Text>
          <Text style={s.lockTxt}>Tu dois être l'organisateur validé de ce concours pour voir son Radar.</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.lockTitle}>Erreur</Text>
          <Text style={s.lockTxt}>{error}</Text>
          <TouchableOpacity style={s.retry} onPress={reload}><Text style={s.retryTxt}>Réessayer</Text></TouchableOpacity>
        </View>
      ) : radar ? (
        <ScrollView contentContainerStyle={s.list}>
          <Text style={s.period}>30 derniers jours · activité observée dans Equishow</Text>

          {/* KPI principal — Préparations détectées (signal le plus fiable) */}
          <View style={s.hero}>
            <Text style={s.heroValue}>{maskedNum(radar.engagement.cavaliers_engaged)}</Text>
            <Text style={s.heroLabel}>Cavaliers préparant leur venue</Text>
            <Text style={s.heroHint}>Préparations détectées : cavaliers distincts ayant réservé un service (box, transport, coach ou stage) lié à ce concours.</Text>
          </View>

          {/* Texte d'aide — périmètre exact de la mesure */}
          <View style={s.help}>
            <Text style={s.helpTxt}>Les statistiques affichées proviennent uniquement des interactions observées dans Equishow. Les inscriptions officielles FFE ne sont pas accessibles à Equishow.</Text>
          </View>

          {/* Signaux par ordre de fiabilité croissante */}

          {/* Signal faible — Vues */}
          <Section title="👁️ Vues du concours" level="Signal faible">
            <Row label="Vues de la fiche" value={String(radar.visibility.views)} hint={trend(radar.visibility.views, radar.visibility.views_prev)} />
            <Row label="Visiteurs uniques" value={maskedNum(radar.visibility.unique_visitors)} masked={radar.visibility.unique_visitors_masked} />
            <Text style={s.note}>Le cavalier consulte simplement la fiche.</Text>
          </Section>

          {/* Signal moyen — Followers */}
          <Section title="⭐ Followers du concours" level="Signal moyen">
            <Row label="Cavaliers qui suivent" value={String(radar.interest.followers)} />
            <Row label="Nouveaux suivis (30j)" value={`+${radar.interest.followers_new}`} />
            <Text style={s.note}>Le cavalier choisit volontairement de suivre le concours.</Text>
          </Section>

          {/* Signal fort — Clic FFE */}
          <Section title="🔗 Clics vers la FFE" level="Signal fort">
            <Row label="Clics vers la page officielle FFE" value={String(radar.visibility.ffe_clicks)} />
            <Text style={s.note}>Le cavalier quitte Equishow vers la FFE. Intérêt fort — ne prouve pas une inscription.</Text>
          </Section>

          {/* Signal très fort — Préparation des cavaliers */}
          <Section title="🐎 Préparation des cavaliers" level="Signal très fort">
            <Row label="Cavaliers ayant réservé un service" value={maskedNum(radar.engagement.cavaliers_engaged)} masked={radar.engagement.masked} />
            <Text style={s.note}>Réservation d'un service (box, transport, coach, stage) lié au concours. Démontre une préparation active de la venue — pas une inscription FFE.</Text>
          </Section>

          {/* Funnel — chemin observé dans Equishow */}
          <Section title="🔻 Parcours observé">
            <FunnelRow step="Vues" value={radar.funnel.views} rate={null} />
            <FunnelRow step="Suivis" value={radar.funnel.followers} rate={pct(radar.funnel.views_to_followers)} />
            <FunnelRow step="Réservations" value={radar.funnel.reservations} rate={pct(radar.funnel.followers_to_reservations)} />
            <Text style={s.note}>Vues → réservations : {pct(radar.funnel.views_to_reservations)}</Text>
          </Section>

          <View style={s.rgpd}>
            <Text style={s.rgpdTxt}>🔒 Données agrégées et anonymisées. Les indicateurs de moins de 5 personnes sont masqués (RGPD). Aucune information individuelle n'est exposée.</Text>
          </View>
        </ScrollView>
      ) : (
        <View style={s.center}><Text style={s.lockTxt}>Aucune donnée.</Text></View>
      )}
    </SafeAreaView>
  );
}

function trend(cur: number, prev: number): string | undefined {
  if (prev <= 0) return undefined;
  const delta = Math.round(((cur - prev) / prev) * 100);
  if (delta === 0) return '→ stable';
  return delta > 0 ? `↑ +${delta}% vs période préc.` : `↓ ${delta}% vs période préc.`;
}

function Section({ title, level, children }: { title: string; level?: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        {!!level && <Text style={s.sectionLevel}>{level}</Text>}
      </View>
      <View style={s.card}>{children}</View>
    </View>
  );
}

function Row({ label, value, hint, masked }: { label: string; value: string; hint?: string; masked?: boolean }) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {!!hint && <Text style={s.rowHint}>{hint}</Text>}
      </View>
      <Text style={[s.rowValue, masked && s.rowValueMasked]}>{value}</Text>
    </View>
  );
}

function FunnelRow({ step, value, rate }: { step: string; value: number; rate: string | null }) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { flex: 1 }]}>{step}</Text>
      {rate != null && <Text style={s.funnelRate}>{rate}</Text>}
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceVariant },
  backTxt: { fontSize: 20, color: Colors.textPrimary },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  lockIcon: { fontSize: 48 },
  lockTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  lockTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  retry: { marginTop: Spacing.md, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
  retryTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  period: { fontSize: FontSize.xs, color: Colors.textTertiary, marginBottom: Spacing.md },
  hero: { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadow.card },
  heroValue: { fontSize: 40, fontWeight: FontWeight.extrabold, color: Colors.textInverse },
  heroLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textInverse, marginTop: 2 },
  heroHint: { fontSize: FontSize.xs, color: Colors.textInverse, opacity: 0.85, marginTop: Spacing.sm, lineHeight: 17 },
  help: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg },
  helpTxt: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17 },
  section: { marginBottom: Spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sectionLevel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLabel: { fontSize: FontSize.sm, color: Colors.textPrimary },
  rowHint: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  rowValue: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.primary },
  rowValueMasked: { color: Colors.textTertiary, fontSize: FontSize.base, fontStyle: 'italic' },
  funnelRate: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.bold },
  note: { fontSize: FontSize.xs, color: Colors.textTertiary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  rgpd: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  rgpdTxt: { fontSize: FontSize.xs, color: Colors.textTertiary, lineHeight: 17 },
});
