import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles } from '../../constants/theme';
import { AuthGuard } from '../../components/AuthGuard';
import { supabase } from '../../lib/supabase';
import { useScreenTracking } from '../../hooks/useScreenTracking';
import { useMarketplaceAnalytics } from '../../hooks/useMarketplaceAnalytics';
import { useFunnelAnalytics } from '../../hooks/useFunnelAnalytics';

interface Kpi7d {
  pageviews_7d: number | null;
  dau_7d: number | null;
  sessions_7d: number | null;
  cta_clicks_7d: number | null;
  errors_7d: number | null;
  avg_session_seconds: number | null;
}
interface TopScreen {
  screen: string;
  views: number;
  unique_users: number;
  avg_duration_seconds: number | null;
}
interface TopCta {
  screen: string | null;
  action: string;
  clicks: number;
  unique_users: number;
}
interface RecentError {
  id: string;
  user_id: string | null;
  screen: string | null;
  action: string | null;
  metadata: { message?: string; stack?: string };
  created_at: string;
}

export default function AdminAnalyticsScreen() {
  return (
    <AuthGuard requiredRole="admin">
      <AdminAnalyticsContent />
    </AuthGuard>
  );
}

function AdminAnalyticsContent() {
  useScreenTracking('admin-analytics');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpi, setKpi] = useState<Kpi7d | null>(null);
  const [active, setActive] = useState<number>(0);
  const [topScreens, setTopScreens] = useState<TopScreen[]>([]);
  const [topCtas, setTopCtas] = useState<TopCta[]>([]);
  const [errors, setErrors] = useState<RecentError[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lot 2 — Marketplace (vues mig 070, lecture seule, RLS admin via security_invoker).
  const { data: mkt, error: mktError, refresh: refreshMkt } = useMarketplaceAnalytics();
  // Lot 3 — Funnel de conversion (vues mig 071). Filtre module côté client.
  const { overview: funnelOverview, byModule: funnelByModule, error: funnelError, refresh: refreshFunnel } = useFunnelAnalytics();
  const [funnelModule, setFunnelModule] = useState<'all' | 'box' | 'transport' | 'course' | 'stage'>('all');

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [kpiRes, activeRes, screensRes, ctasRes, errorsRes] = await Promise.all([
        supabase.from('v_analytics_kpi_7d').select('*').maybeSingle(),
        supabase.from('v_analytics_active_sessions').select('active_sessions_1h').maybeSingle(),
        supabase.from('v_analytics_top_screens').select('*').limit(15),
        supabase.from('v_analytics_top_ctas').select('*').limit(15),
        supabase.from('v_analytics_recent_errors').select('*'),
      ]);
      if (kpiRes.error) throw kpiRes.error;
      if (activeRes.error) throw activeRes.error;
      if (screensRes.error) throw screensRes.error;
      if (ctasRes.error) throw ctasRes.error;
      if (errorsRes.error) throw errorsRes.error;
      setKpi(kpiRes.data as Kpi7d | null);
      setActive((activeRes.data as { active_sessions_1h: number } | null)?.active_sessions_1h ?? 0);
      setTopScreens((screensRes.data ?? []) as TopScreen[]);
      setTopCtas((ctasRes.data ?? []) as TopCta[]);
      setErrors((errorsRes.data ?? []) as RecentError[]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erreur chargement analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load();
    refreshMkt();
    refreshFunnel();
  }

  // Funnel affiché : "Tous" = overview ; sinon lignes du module sélectionné.
  const funnelRows = funnelModule === 'all'
    ? funnelOverview
    : funnelByModule.filter((r) => r.module === funnelModule);
  const funnelFirstVolume = funnelRows.length > 0 ? funnelRows[0].volume : 0;
  const funnelErrorCount = funnelRows.find((r) => r.step === 'payment_success')?.payment_error_count ?? 0;

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>📊 Analytics</Text>
          <Text style={styles.headerSub}>Comportement utilisateurs · 7 derniers jours</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {mktError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ Marketplace : {mktError}</Text>
          </View>
        )}

        {/* ════════ MARKETPLACE (Lot 2) ════════ */}

        {/* Revenus */}
        <Text style={styles.blockTitle}>💶 Marketplace</Text>
        <View style={styles.kpiGrid}>
          <KpiCard label="GMV net total" value={formatEuros(mkt.revenue?.gmv_net_total_cents)} accent={Colors.success} />
          <KpiCard label="GMV brut total" value={formatEuros(mkt.revenue?.gmv_brut_total_cents)} />
          <KpiCard label="GMV net 30j" value={formatEuros(mkt.revenue?.gmv_net_30d_cents)} />
          <KpiCard label="GMV net 7j" value={formatEuros(mkt.revenue?.gmv_net_7d_cents)} />
          <KpiCard label="Remboursé total" value={formatEuros(mkt.revenue?.refunded_total_cents)} accent={mkt.revenue?.refunded_total_cents ? Colors.urgent : undefined} />
          <KpiCard label="Commissions total" value={formatEuros(mkt.revenue?.commissions_total_cents)} accent={Colors.primary} />
          <KpiCard label="Commissions 30j" value={formatEuros(mkt.revenue?.commissions_30d_cents)} />
          <KpiCard label="Réservations total" value={String(mkt.reservations?.reservations_total ?? 0)} />
          <KpiCard label="Réservations 30j" value={String(mkt.reservations?.reservations_30d ?? 0)} />
        </View>

        {/* Réservations par module */}
        <Section title="Réservations par module (payées)">
          {mkt.byType.length === 0 ? (
            <EmptyHint text="Aucune réservation payée pour l'instant." />
          ) : (
            mkt.byType.map((t) => (
              <Row
                key={t.type}
                left={MODULE_LABELS[t.type] ?? t.type}
                middle={`${t.bookings} payées`}
                right={`${formatEuros(t.gmv_net_cents)} · ${formatEuros(t.commissions_cents)} comm.`}
              />
            ))
          )}
        </Section>

        {/* Paiements */}
        <Text style={styles.blockTitle}>💳 Paiements</Text>
        <View style={styles.kpiGrid}>
          <KpiCard label="Paiements réussis" value={String(mkt.payments?.payments_succeeded ?? 0)} accent={Colors.success} />
          <KpiCard label="Paiements échoués" value={String(mkt.payments?.payments_failed ?? 0)} accent={mkt.payments?.payments_failed ? Colors.urgent : undefined} />
          <KpiCard label="Taux de réussite" value={formatPct(mkt.payments?.success_rate)} />
          <KpiCard label="Panier moyen" value={formatEuros(mkt.payments?.avg_basket_cents)} />
        </View>

        {/* Vendeurs */}
        <Text style={styles.blockTitle}>🧑‍💼 Vendeurs</Text>
        <View style={styles.kpiGrid}>
          <KpiCard label="Vendeurs actifs" value={String(mkt.sellers?.active_sellers ?? 0)} />
          <KpiCard label="Dont onboardés" value={String(mkt.sellers?.active_onboarded ?? 0)} accent={Colors.success} />
          <KpiCard label="Dont non onboardés" value={String(mkt.sellers?.active_not_onboarded ?? 0)} accent={mkt.sellers?.active_not_onboarded ? Colors.urgent : undefined} />
        </View>

        {/* Escrow */}
        <Text style={styles.blockTitle}>🔒 Escrow (dû vendeur)</Text>
        <View style={styles.kpiGrid}>
          <KpiCard label="Séquestré" value={formatEuros(mkt.escrow?.held_seller_cents)} accent={Colors.primary} />
          <KpiCard label="Libéré" value={formatEuros(mkt.escrow?.released_seller_cents)} accent={Colors.success} />
          <KpiCard
            label="En attente de libération"
            value={formatEuros(mkt.escrow?.pending_release_seller_cents)}
            accent={mkt.escrow?.pending_release_seller_cents ? Colors.urgent : undefined}
          />
        </View>

        {/* Litiges */}
        <Text style={styles.blockTitle}>⚖️ Litiges</Text>
        <View style={styles.kpiGrid}>
          <KpiCard label="Litiges (total)" value={String(mkt.disputes?.disputes_total ?? 0)} />
          <KpiCard label="Litiges ouverts" value={String(mkt.disputes?.disputes_open ?? 0)} accent={mkt.disputes?.disputes_open ? Colors.urgent : undefined} />
          <KpiCard label="Taux de litige" value={formatPct(mkt.disputes?.dispute_rate)} />
          <KpiCard label="Montant concerné" value={formatEuros(mkt.disputes?.disputed_amount_cents)} />
        </View>

        {/* ════════ COMPORTEMENT (existant) ════════ */}
        <Text style={styles.blockTitle}>📈 Comportement utilisateurs</Text>

        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ {loadError}</Text>
          </View>
        )}

        {/* KPIs en cards */}
        <View style={styles.kpiGrid}>
          <KpiCard label="Sessions actives (1h)" value={String(active)} accent={Colors.success} />
          <KpiCard label="DAU 7j" value={String(kpi?.dau_7d ?? 0)} />
          <KpiCard label="Sessions 7j" value={String(kpi?.sessions_7d ?? 0)} />
          <KpiCard label="Pageviews 7j" value={String(kpi?.pageviews_7d ?? 0)} />
          <KpiCard label="Clics CTAs 7j" value={String(kpi?.cta_clicks_7d ?? 0)} />
          <KpiCard label="Erreurs 7j" value={String(kpi?.errors_7d ?? 0)} accent={kpi?.errors_7d ? Colors.urgent : undefined} />
          <KpiCard
            label="Durée session moy."
            value={kpi?.avg_session_seconds ? formatSeconds(kpi.avg_session_seconds) : '—'}
          />
        </View>

        {/* Top écrans */}
        <Section title="Top écrans (30j)">
          {topScreens.length === 0 ? (
            <EmptyHint text="Aucune donnée. Navigue dans l'app pour générer des events." />
          ) : (
            topScreens.map((s) => (
              <Row
                key={s.screen}
                left={s.screen}
                middle={`${s.unique_users} users`}
                right={`${s.views} vues${s.avg_duration_seconds ? ` · ${formatSeconds(s.avg_duration_seconds)}` : ''}`}
              />
            ))
          )}
        </Section>

        {/* Top CTAs */}
        <Section title="Top CTAs cliqués (30j)">
          {topCtas.length === 0 ? (
            <EmptyHint text="Aucun clic tracké pour l'instant." />
          ) : (
            topCtas.map((c, i) => (
              <Row
                key={`${c.screen}-${c.action}-${i}`}
                left={c.action}
                middle={c.screen ?? '—'}
                right={`${c.clicks} clics · ${c.unique_users} users`}
              />
            ))
          )}
        </Section>

        {/* 🪜 Funnel de conversion (Lot 3, mig 071) */}
        <Text style={styles.blockTitle}>🪜 Funnel de conversion (30j)</Text>
        {funnelError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ Funnel : {funnelError}</Text>
          </View>
        )}
        {/* Filtre module */}
        <View style={styles.funnelFilterRow}>
          {([['all', 'Tous'], ['box', 'Box'], ['transport', 'Transport'], ['course', 'Coach'], ['stage', 'Stage']] as const).map(([val, label]) => (
            <TouchableOpacity
              key={val}
              style={[styles.funnelChip, funnelModule === val && styles.funnelChipActive]}
              onPress={() => setFunnelModule(val)}
              activeOpacity={0.8}
            >
              <Text style={[styles.funnelChipText, funnelModule === val && styles.funnelChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.funnelHint}>Haut (annonce → demande) = sessions·annonces · Bas (demande → payé) = réservations · pivot reservation_id</Text>
          <View style={styles.sectionBody}>
            {funnelRows.length === 0 || funnelFirstVolume === 0 ? (
              <EmptyHint text="Aucune donnée funnel pour ce module (générée par les nouveaux parcours instrumentés)." />
            ) : (
              <>
                {funnelRows.map((f) => (
                  <FunnelRow
                    key={f.step}
                    step={f.step}
                    volume={f.volume}
                    passage={f.passage_rate}
                    dropOff={f.drop_off}
                    widthPct={funnelFirstVolume > 0 ? Math.max(4, Math.round((f.volume / funnelFirstVolume) * 100)) : 0}
                  />
                ))}
                {funnelErrorCount > 0 && (
                  <View style={styles.funnelErrorRow}>
                    <Text style={styles.funnelErrorText}>❌ Erreurs paiement : {funnelErrorCount}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Erreurs récentes */}
        <Section title="Erreurs récentes">
          {errors.length === 0 ? (
            <EmptyHint text="Aucune erreur récente. 🎉" />
          ) : (
            errors.slice(0, 10).map((e) => (
              <View key={e.id} style={styles.errorCard}>
                <Text style={styles.errorScreen}>{e.screen ?? '—'} · {new Date(e.created_at).toLocaleString('fr-FR')}</Text>
                <Text style={styles.errorMsg} numberOfLines={3}>{e.metadata?.message ?? '(sans message)'}</Text>
              </View>
            ))
          )}
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={[styles.kpiCard, accent ? { borderColor: accent } : null]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ left, middle, right }: { left: string; middle: string; right: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLeft} numberOfLines={1}>{left}</Text>
      <Text style={styles.rowMiddle} numberOfLines={1}>{middle}</Text>
      <Text style={styles.rowRight} numberOfLines={1}>{right}</Text>
    </View>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <Text style={styles.emptyHint}>{text}</Text>;
}

const MODULE_LABELS: Record<string, string> = {
  box: 'Box',
  transport: 'Transport',
  course: 'Coach',
  stage: 'Stage',
};

// Montants stockés en CENTIMES dans payments → division par 100 à l'affichage.
function formatEuros(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
}

function formatPct(ratio: number | null | undefined): string {
  if (ratio == null) return '—';
  return (ratio * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';
}

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s - m * 60);
  return rest === 0 ? `${m}min` : `${m}min ${rest}s`;
}

function funnelStepLabel(step: string): string {
  switch (step) {
    case 'open_listing':    return '1. Annonce ouverte';
    case 'open_reserve':    return '2. Écran réservation';
    case 'submit_reserve':  return '3. Demande envoyée';
    case 'open_checkout':   return '4. Paiement lancé';
    case 'payment_success': return '5. ✅ Payé';
    default: return step;
  }
}

function FunnelRow({ step, volume, passage, dropOff, widthPct }: {
  step: string; volume: number; passage: number | null; dropOff: number | null; widthPct: number;
}) {
  const dropHigh = dropOff != null && dropOff >= 0.5;
  return (
    <View style={styles.funnelRow}>
      <View style={styles.funnelRowHeader}>
        <Text style={styles.funnelStepLabel} numberOfLines={1}>{funnelStepLabel(step)}</Text>
        <Text style={styles.funnelVolume}>{volume}</Text>
      </View>
      <View style={styles.funnelBarTrack}>
        <View style={[styles.funnelBarFill, { width: `${widthPct}%` }]} />
      </View>
      <View style={styles.funnelRowFooter}>
        <Text style={styles.funnelRate}>
          {passage == null ? 'point d\'entrée' : `passage ${(passage * 100).toFixed(1)} %`}
        </Text>
        {dropOff != null && (
          <Text style={[styles.funnelDrop, dropHigh && styles.funnelDropHigh]}>
            abandon {(dropOff * 100).toFixed(1)} %
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryLight },
  backIcon: { fontSize: 20, color: Colors.primary, fontWeight: FontWeight.bold },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  content: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.lg },

  errorBanner: {
    backgroundColor: Colors.urgentBg, borderLeftWidth: 4, borderLeftColor: Colors.urgent,
    padding: Spacing.md, borderRadius: Radius.md,
  },
  errorBannerText: { color: Colors.urgent, fontSize: FontSize.sm },

  blockTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginTop: Spacing.sm, paddingHorizontal: Spacing.xs },

  // Funnel de conversion (Lot 3)
  funnelFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  funnelChip: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  funnelChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  funnelChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  funnelChipTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  funnelHint: { fontSize: FontSize.xs, color: Colors.textTertiary, paddingHorizontal: Spacing.xs, fontStyle: 'italic' },
  funnelRow: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, gap: 4 },
  funnelRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  funnelStepLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  funnelVolume: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.extrabold },
  funnelBarTrack: { height: 10, borderRadius: 5, backgroundColor: Colors.border, overflow: 'hidden' },
  funnelBarFill: { height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  funnelRowFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  funnelRate: { fontSize: FontSize.xs, color: Colors.textSecondary },
  funnelDrop: { fontSize: FontSize.xs, color: Colors.textTertiary },
  funnelDropHigh: { color: Colors.urgent, fontWeight: FontWeight.bold },
  funnelErrorRow: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xs },
  funnelErrorText: { fontSize: FontSize.sm, color: Colors.urgent, fontWeight: FontWeight.semibold },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kpiCard: {
    ...CommonStyles.card,
    flex: 1, minWidth: '45%',
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  kpiLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginBottom: Spacing.xs, textTransform: 'uppercase', fontWeight: FontWeight.semibold },
  kpiValue: { fontSize: FontSize.xxl, color: Colors.textPrimary, fontWeight: FontWeight.extrabold },

  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, paddingHorizontal: Spacing.xs },
  sectionBody: { ...CommonStyles.card, padding: Spacing.sm, gap: Spacing.xs },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  rowLeft: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  rowMiddle: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  rowRight: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right' },

  emptyHint: { fontSize: FontSize.sm, color: Colors.textTertiary, padding: Spacing.md, textAlign: 'center', fontStyle: 'italic' },

  errorCard: { padding: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.urgentBg, gap: 2 },
  errorScreen: { fontSize: FontSize.xs, color: Colors.urgent, fontWeight: FontWeight.bold },
  errorMsg: { fontSize: FontSize.sm, color: Colors.textPrimary, fontFamily: 'Courier New' },
});
