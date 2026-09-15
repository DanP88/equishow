// ─────────────────────────────────────────────────────────────────────────────
// AdminAnalyticsV2 — reskin Blush de app/(tabs)/admin-analytics.tsx.
// Mêmes sources : useMarketplaceAnalytics (mig 070) + useFunnelAnalytics
// (mig 071) + v2/adapters/admin.useV2AdminBehavior (vues comportement,
// lecture seule). 0 nouvel objet backend.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Screen, H1, Section, Card, Segment } from '../../ui/kit';
import { BL, FONT } from '../../ui/blush';
import { Spacing, FontSize, FontWeight } from '../../../constants/theme';
import { useMarketplaceAnalytics } from '../../../hooks/useMarketplaceAnalytics';
import { useFunnelAnalytics } from '../../../hooks/useFunnelAnalytics';
import { useV2AdminBehavior } from '../../adapters/admin';
import { ScrollView } from 'react-native';

const MODULE_LABELS: Record<string, string> = { box: 'Box', transport: 'Transport', course: 'Coach', stage: 'Stage' };

function eur(cents?: number | null): string {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';
}
function pct(ratio?: number | null): string {
  if (ratio == null) return '—';
  return (ratio * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';
}
function secs(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return r === 0 ? `${m}min` : `${m}min ${r}s`;
}
function stepLabel(step: string): string {
  switch (step) {
    case 'open_listing': return '1. Annonce ouverte';
    case 'open_reserve': return '2. Écran réservation';
    case 'submit_reserve': return '3. Demande envoyée';
    case 'open_checkout': return '4. Paiement lancé';
    case 'payment_success': return '5. ✅ Payé';
    default: return step;
  }
}

function Kpi({ label, value, urgent, good }: { label: string; value: string; urgent?: boolean; good?: boolean }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, urgent && { color: BL.berry }, good && { color: BL.sage }]}>{value}</Text>
    </View>
  );
}

export function AdminAnalyticsV2() {
  const { data: mkt, error: mktError, refresh: refreshMkt } = useMarketplaceAnalytics();
  const { overview, byModule, error: funnelError, refresh: refreshFunnel } = useFunnelAnalytics();
  const { data: beh, loading: behLoading, error: behError, refresh: refreshBeh } = useV2AdminBehavior();
  const [funnelModule, setFunnelModule] = useState<'all' | 'box' | 'transport' | 'course' | 'stage'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const funnelRows = funnelModule === 'all' ? overview : byModule.filter((r) => r.module === funnelModule);
  const firstVolume = funnelRows[0]?.volume ?? 0;

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refreshMkt(), refreshFunnel(), refreshBeh()]);
    setRefreshing(false);
  }

  if (!mkt && behLoading) {
    return <Screen scroll={false}><View style={s.center}><ActivityIndicator color={BL.accent} size="large" /></View></Screen>;
  }

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={s.pad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BL.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <H1>Analytics</H1>
        <Text style={s.sub}>Marketplace · comportement · funnel — 7/30 derniers jours</Text>

        {mktError && <ErrorBanner text={`Marketplace : ${mktError}`} />}

        <Section title="Marketplace">
          <View style={s.grid}>
            <Kpi label="GMV net total" value={eur(mkt.revenue?.gmv_net_total_cents)} good />
            <Kpi label="GMV net 30j" value={eur(mkt.revenue?.gmv_net_30d_cents)} />
            <Kpi label="Commissions total" value={eur(mkt.revenue?.commissions_total_cents)} />
            <Kpi label="Remboursé total" value={eur(mkt.revenue?.refunded_total_cents)} urgent={!!mkt.revenue?.refunded_total_cents} />
            <Kpi label="Réservations total" value={String(mkt.reservations?.reservations_total ?? 0)} />
            <Kpi label="Réservations 30j" value={String(mkt.reservations?.reservations_30d ?? 0)} />
          </View>
        </Section>

        <Section title="Par module (payées)">
          <Card>
            {mkt.byType.length === 0 ? (
              <Text style={s.empty}>Aucune réservation payée pour l'instant.</Text>
            ) : mkt.byType.map((t, i) => (
              <View key={t.type} style={[s.row, i > 0 && s.rowDiv]}>
                <Text style={s.rowLeft}>{MODULE_LABELS[t.type] ?? t.type}</Text>
                <Text style={s.rowMid}>{t.bookings} payées</Text>
                <Text style={s.rowRight}>{eur(t.gmv_net_cents)} · {eur(t.commissions_cents)} comm.</Text>
              </View>
            ))}
          </Card>
        </Section>

        <Section title="Paiements">
          <View style={s.grid}>
            <Kpi label="Réussis" value={String(mkt.payments?.payments_succeeded ?? 0)} good />
            <Kpi label="Échoués" value={String(mkt.payments?.payments_failed ?? 0)} urgent={!!mkt.payments?.payments_failed} />
            <Kpi label="Taux réussite" value={pct(mkt.payments?.success_rate)} />
            <Kpi label="Panier moyen" value={eur(mkt.payments?.avg_basket_cents)} />
          </View>
        </Section>

        <Section title="Vendeurs & escrow">
          <View style={s.grid}>
            <Kpi label="Vendeurs actifs" value={String(mkt.sellers?.active_sellers ?? 0)} />
            <Kpi label="Non onboardés" value={String(mkt.sellers?.active_not_onboarded ?? 0)} urgent={!!mkt.sellers?.active_not_onboarded} />
            <Kpi label="Séquestré" value={eur(mkt.escrow?.held_seller_cents)} />
            <Kpi label="En attente release" value={eur(mkt.escrow?.pending_release_seller_cents)} urgent={!!mkt.escrow?.pending_release_seller_cents} />
          </View>
        </Section>

        <Section title="Litiges">
          <View style={s.grid}>
            <Kpi label="Ouverts" value={String(mkt.disputes?.disputes_open ?? 0)} urgent={!!mkt.disputes?.disputes_open} />
            <Kpi label="Taux de litige" value={pct(mkt.disputes?.dispute_rate)} />
            <Kpi label="Montant concerné" value={eur(mkt.disputes?.disputed_amount_cents)} />
            <Kpi label="Total" value={String(mkt.disputes?.disputes_total ?? 0)} />
          </View>
        </Section>

        {behError && <ErrorBanner text={behError} />}

        <Section title="Comportement utilisateurs">
          <View style={s.grid}>
            <Kpi label="Sessions actives (1h)" value={String(beh?.activeSessions ?? 0)} good />
            <Kpi label="DAU 7j" value={String(beh?.kpi?.dau_7d ?? 0)} />
            <Kpi label="Sessions 7j" value={String(beh?.kpi?.sessions_7d ?? 0)} />
            <Kpi label="Erreurs 7j" value={String(beh?.kpi?.errors_7d ?? 0)} urgent={!!beh?.kpi?.errors_7d} />
            <Kpi label="Durée moy." value={beh?.kpi?.avg_session_seconds ? secs(beh.kpi.avg_session_seconds) : '—'} />
            <Kpi label="Clics CTA 7j" value={String(beh?.kpi?.cta_clicks_7d ?? 0)} />
          </View>
        </Section>

        <Section title="Top écrans (30j)">
          <Card>
            {(beh?.topScreens.length ?? 0) === 0 ? (
              <Text style={s.empty}>Aucune donnée.</Text>
            ) : beh!.topScreens.map((sc, i) => (
              <View key={sc.screen} style={[s.row, i > 0 && s.rowDiv]}>
                <Text style={s.rowLeft} numberOfLines={1}>{sc.screen}</Text>
                <Text style={s.rowMid}>{sc.unique_users} users</Text>
                <Text style={s.rowRight}>{sc.views} vues</Text>
              </View>
            ))}
          </Card>
        </Section>

        {funnelError && <ErrorBanner text={`Funnel : ${funnelError}`} />}

        <Section title="Funnel de conversion (30j)">
          <Segment
            options={[
              { key: 'all', label: 'Tous' }, { key: 'box', label: 'Box' },
              { key: 'transport', label: 'Transport' }, { key: 'course', label: 'Coach' }, { key: 'stage', label: 'Stage' },
            ]}
            value={funnelModule}
            onChange={(v) => setFunnelModule(v as typeof funnelModule)}
          />
          <Card pad>
            {funnelRows.length === 0 || firstVolume === 0 ? (
              <Text style={s.empty}>Aucune donnée funnel pour ce module.</Text>
            ) : funnelRows.map((f) => {
              const w = Math.max(4, Math.round((f.volume / firstVolume) * 100));
              return (
                <View key={f.step} style={{ gap: 4, marginBottom: Spacing.sm }}>
                  <View style={s.funnelHead}>
                    <Text style={s.funnelStep} numberOfLines={1}>{stepLabel(f.step)}</Text>
                    <Text style={s.funnelVol}>{f.volume}</Text>
                  </View>
                  <View style={s.funnelTrack}><View style={[s.funnelFill, { width: `${w}%` }]} /></View>
                  <Text style={s.funnelRate}>
                    {f.passage_rate == null ? "point d'entrée" : `passage ${(f.passage_rate * 100).toFixed(1)} %`}
                    {f.drop_off != null ? ` · abandon ${(f.drop_off * 100).toFixed(1)} %` : ''}
                  </Text>
                </View>
              );
            })}
          </Card>
        </Section>

        <Section title="Erreurs récentes">
          <Card>
            {(beh?.recentErrors.length ?? 0) === 0 ? (
              <Text style={s.empty}>Aucune erreur récente. 🎉</Text>
            ) : beh!.recentErrors.slice(0, 10).map((e, i) => (
              <View key={e.id} style={[s.errCard, i > 0 && { marginTop: Spacing.xs }]}>
                <Text style={s.errScreen}>{e.screen ?? '—'} · {new Date(e.created_at).toLocaleString('fr-FR')}</Text>
                <Text style={s.errMsg} numberOfLines={3}>{e.metadata?.message ?? '(sans message)'}</Text>
              </View>
            ))}
          </Card>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return <View style={s.errBanner}><Text style={s.errBannerTxt}>⚠️ {text}</Text></View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BL.bg },
  pad: { padding: Spacing.lg, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sub: { fontSize: FontSize.sm, color: BL.sub, marginTop: 2, marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kpi: { flexGrow: 1, minWidth: '45%', backgroundColor: BL.card, borderRadius: 14, borderWidth: 1, borderColor: BL.line, padding: Spacing.md },
  kpiLabel: { fontSize: 10.5, color: BL.faint, textTransform: 'uppercase', fontWeight: FontWeight.semibold, marginBottom: 4 },
  kpiValue: { fontFamily: FONT.head, fontSize: 21, fontWeight: '700', color: BL.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  rowDiv: { borderTopWidth: 1, borderTopColor: BL.line },
  rowLeft: { flex: 1, fontSize: FontSize.sm, color: BL.ink, fontWeight: FontWeight.semibold },
  rowMid: { flex: 1, fontSize: FontSize.xs, color: BL.sub, textAlign: 'center' },
  rowRight: { flex: 1, fontSize: FontSize.xs, color: BL.sub, textAlign: 'right' },
  empty: { fontSize: FontSize.sm, color: BL.faint, padding: Spacing.md, textAlign: 'center', fontStyle: 'italic' },
  errBanner: { backgroundColor: '#FCE9EC', borderLeftWidth: 4, borderLeftColor: BL.berry, padding: Spacing.md, borderRadius: 10, marginTop: Spacing.sm },
  errBannerTxt: { color: BL.berry, fontSize: FontSize.sm },
  funnelHead: { flexDirection: 'row', justifyContent: 'space-between' },
  funnelStep: { flex: 1, fontSize: FontSize.sm, color: BL.ink, fontWeight: FontWeight.semibold },
  funnelVol: { fontSize: FontSize.base, color: BL.ink, fontWeight: FontWeight.bold },
  funnelTrack: { height: 8, borderRadius: 4, backgroundColor: BL.line, overflow: 'hidden' },
  funnelFill: { height: 8, borderRadius: 4, backgroundColor: BL.accent },
  funnelRate: { fontSize: FontSize.xs, color: BL.sub },
  errCard: { padding: Spacing.sm, borderRadius: 10, backgroundColor: '#FCE9EC' },
  errScreen: { fontSize: FontSize.xs, color: BL.berry, fontWeight: FontWeight.bold },
  errMsg: { fontSize: FontSize.sm, color: BL.ink, fontFamily: 'Courier New' },
});
