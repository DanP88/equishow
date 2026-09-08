// ─────────────────────────────────────────────────────────────────────────────
// OrganisateurV2 — espace organisateur DANS le compte omni (LOT F10).
//
//   OrganisateurV2  : mes concours (brouillon / publié / archivé) + accès Radar.
//   OrgRadarV2      : Radar d'un concours — agrégats RGPD-aware (masquage < 5,
//                     jamais de nominatif). LECTURE SEULE (RPC fn_org_concours_radar).
//
// Aucun sélecteur de rôle : l'espace est visible dès que la capacité
// « organisateur » est détenue, en plus des activités cavalier / coach.
// Aucune écriture PROD.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Chip, Row, RowGroup, Section, PrimaryButton, GhostButton, EmptyState, Placeholder } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { useConcours } from '../../hooks/useConcours';
import { useV2OrgSpace, useV2OrgRadar } from '../adapters/org';

const STATUT_LABEL: Record<string, string> = { publie: 'Publiés', brouillon: 'Brouillons', archive: 'Archivés' };

// ═══════════════════════ ESPACE ORGANISATEUR ═══════════════════════
export function OrganisateurV2() {
  const caps = useCapabilities();
  const org = useV2OrgSpace();
  const [f, setF] = useState<'publie' | 'brouillon' | 'archive'>('publie');
  const pending = caps.isPending('organisateur');

  const shown = org.concours.filter((c) => c.statut === f);

  return (
    <Screen>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/profil' as any))} hitSlop={8}>
        <Text style={s.back}>← Retour</Text>
      </TouchableOpacity>
      <Text style={s.h1}>🏟 Espace organisateur</Text>
      <Text style={s.sub}>
        En plus de vos activités cavalier / coach — aucun changement de compte.
        {org.demo ? '  ·  aperçu (non connecté)' : ''}
      </Text>

      {pending && (
        <Card hero>
          <Text style={s.pendingTitle}>⏳ Validation en attente</Text>
          <Text style={s.pendingBody}>Votre demande d'activité organisateur est en cours de vérification (simulée en prototype). Vous pouvez déjà préparer vos concours en brouillon.</Text>
        </Card>
      )}

      <View style={s.filterRow}>
        {(['publie', 'brouillon', 'archive'] as const).map((k) => (
          <Chip key={k} label={`${STATUT_LABEL[k]} · ${org.counts[k]}`} on={f === k} onPress={() => setF(k)} />
        ))}
      </View>

      {shown.length === 0 ? (
        <EmptyState icon="🏟" title={`Aucun concours ${STATUT_LABEL[f].toLowerCase()}`}
          body="Vos concours créés apparaîtront ici." ctaLabel="Créer un concours"
          onCta={() => router.push('/(v2)/concours/creer' as any)} />
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {shown.map((c) => (
            <Card key={c.id} onPress={() => router.push(`/(v2)/organisateur/${c.id}` as any)}>
              <Text style={s.orgName}>🏟 {c.nom}</Text>
              <Text style={s.orgMeta}>{c.dateLabel}{c.lieu ? ` · ${c.lieu}` : ''} · {c.statut}</Text>
              <Text style={s.orgCta}>📊 Voir le Radar ›</Text>
            </Card>
          ))}
        </View>
      )}

      <PrimaryButton label="＋ Créer un concours" onPress={() => router.push('/(v2)/concours/creer' as any)} />

      <Section title="Outils">
        <RowGroup>
          <Row icon="✏️" label="Créer / éditer / publier" onPress={() => router.push('/(tabs)/org-concours' as any)} />
          <Row icon="📊" label="Radar (tous concours)" onPress={() => router.push('/(tabs)/org-radar' as any)} />
          <Row icon="🏆" label="Voir mes concours dans la liste" onPress={() => router.push('/(v2)/concours?tab=organises' as any)} />
        </RowGroup>
      </Section>

      <Placeholder note="création / édition / publication détaillées reprises de la V1 (dual-mode creer-concours) ; Radar V2 = agrégats RGPD, masquage < 5, jamais de nominatif" v1Path="/(tabs)/org-concours" v1Label="gestion concours (V1)" />
    </Screen>
  );
}

// ═══════════════════════ RADAR D'UN CONCOURS ═══════════════════════
function Stat({ label, value, sub, masked }: { label: string; value: string; sub?: string; masked?: boolean }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{masked ? '•••' : value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
      {masked ? <Text style={s.statMask}>masqué (moins de 5)</Text> : null}
    </View>
  );
}

export function OrgRadarV2() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { concours } = useConcours(id?.startsWith('demo-') ? undefined : id);
  const { radar, ready, demo } = useV2OrgRadar(id);

  const title = concours?.nom ?? (id?.startsWith('demo-') ? 'Concours (démonstration)' : 'Concours');

  return (
    <Screen>
      <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/organisateur' as any))} hitSlop={8}>
        <Text style={s.back}>← Espace organisateur</Text>
      </TouchableOpacity>
      <Text style={s.h1}>📊 Radar</Text>
      <Text style={s.sub}>{title}{demo ? '  ·  données de démonstration' : ''}</Text>

      {!ready && !radar ? (
        <View style={s.center}><ActivityIndicator color={BL.accent} /></View>
      ) : !radar ? (
        <EmptyState icon="📊" title="Radar indisponible" body="Ce concours n'a pas encore de données de visibilité, ou le Radar n'est pas activé." />
      ) : (
        <>
          <Section title={`Visibilité · ${radar.days} j`}>
            <View style={s.statGrid}>
              <Stat label="Vues fiche" value={String(radar.visibility.views)} sub={`${radar.visibility.views_prev} période préc.`} />
              <Stat label="Visiteurs uniques" value={String(radar.visibility.unique_visitors ?? '—')} masked={radar.visibility.unique_visitors_masked} />
              <Stat label="Clics « S'inscrire FFE »" value={String(radar.visibility.ffe_clicks)} />
            </View>
          </Section>

          <Section title="Intérêt & engagement">
            <View style={s.statGrid}>
              <Stat label="Followers" value={String(radar.interest.followers)} sub={`+${radar.interest.followers_new} nouveaux`} masked={radar.interest.followers_masked} />
              <Stat label="Cavaliers engagés" value={String(radar.engagement.cavaliers_engaged ?? '—')} masked={radar.engagement.masked} />
            </View>
          </Section>

          <Section title="Clics sur les modules">
            <View style={s.statGrid}>
              <Stat label="🏠 Box" value={String(radar.module_clicks.box)} />
              <Stat label="🚚 Transport" value={String(radar.module_clicks.transport)} />
              <Stat label="🎓 Coach" value={String(radar.module_clicks.coach)} />
              <Stat label="Total" value={String(radar.module_clicks.total)} />
            </View>
          </Section>

          <Section title="Réservations générées">
            <View style={s.statGrid}>
              <Stat label="🏠 Box" value={String(radar.reservations.box)} />
              <Stat label="🚚 Transport" value={String(radar.reservations.transport)} />
              <Stat label="🎓 Coach" value={String(radar.reservations.coach)} />
              <Stat label="📅 Stage" value={String(radar.reservations.stage)} />
              <Stat label="Total" value={String(radar.reservations.total)} />
              <Stat label="Cavaliers distincts" value={String(radar.reservations.cavaliers_distinct ?? '—')} masked={radar.reservations.cavaliers_distinct_masked} />
            </View>
          </Section>

          <Section title="Chiffre d'affaires généré">
            <View style={s.statGrid}>
              <Stat label="GMV" value={radar.revenue.gmv_eur != null ? `${radar.revenue.gmv_eur} €` : '—'} masked={radar.revenue.masked} />
              <Stat label="Commissions" value={radar.revenue.commission_eur != null ? `${radar.revenue.commission_eur} €` : '—'} masked={radar.revenue.masked} />
              <Stat label="Paiements" value={String(radar.revenue.paid_reservations)} />
            </View>
          </Section>

          <Card>
            <Text style={s.funnelTitle}>Entonnoir</Text>
            <Text style={s.funnelLine}>👁 {radar.funnel.views} vues → ⭐ {radar.funnel.followers} followers → 🖱 {radar.funnel.module_clicks} clics modules → 🎟 {radar.funnel.reservations_total} réservations → 💶 {radar.funnel.paid} payées</Text>
          </Card>
        </>
      )}

      <Placeholder note="RGPD : agrégats uniquement, masquage sous 5, jamais de donnée nominative. Source = RPC fn_org_concours_radar (lecture seule)." v1Path="/(tabs)/org-radar" v1Label="Radar V1" />
    </Screen>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl },
  back: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.bold, marginBottom: 4 },
  h1: { fontSize: 22, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, letterSpacing: -0.3 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },

  pendingTitle: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: BL.accent },
  pendingBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  filterRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: Spacing.sm },
  orgName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  orgMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  orgCta: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.bold, marginTop: 2 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: Spacing.md, minWidth: 100, flexGrow: 1, gap: 2 },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  statSub: { fontSize: 10, color: Colors.textTertiary },
  statMask: { fontSize: 10, color: Colors.warning, fontWeight: FontWeight.bold },

  funnelTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 },
  funnelLine: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});
