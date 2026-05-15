import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles } from '../../constants/theme';
import { AuthGuard } from '../../components/AuthGuard';
import { supabase } from '../../lib/supabase';
import { useScreenTracking } from '../../hooks/useScreenTracking';

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
interface FunnelStep {
  action: string;
  steps: number;
  unique_users: number;
  unique_sessions: number;
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
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [errors, setErrors] = useState<RecentError[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [kpiRes, activeRes, screensRes, ctasRes, funnelRes, errorsRes] = await Promise.all([
        supabase.from('v_analytics_kpi_7d').select('*').maybeSingle(),
        supabase.from('v_analytics_active_sessions').select('active_sessions_1h').maybeSingle(),
        supabase.from('v_analytics_top_screens').select('*').limit(15),
        supabase.from('v_analytics_top_ctas').select('*').limit(15),
        supabase.from('v_analytics_funnel_payment').select('*'),
        supabase.from('v_analytics_recent_errors').select('*'),
      ]);
      if (kpiRes.error) throw kpiRes.error;
      if (activeRes.error) throw activeRes.error;
      if (screensRes.error) throw screensRes.error;
      if (ctasRes.error) throw ctasRes.error;
      if (funnelRes.error) throw funnelRes.error;
      if (errorsRes.error) throw errorsRes.error;
      setKpi(kpiRes.data as Kpi7d | null);
      setActive((activeRes.data as { active_sessions_1h: number } | null)?.active_sessions_1h ?? 0);
      setTopScreens((screensRes.data ?? []) as TopScreen[]);
      setTopCtas((ctasRes.data ?? []) as TopCta[]);
      setFunnel((funnelRes.data ?? []) as FunnelStep[]);
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
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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

        {/* Funnel paiement */}
        <Section title="Funnel paiement (30j)">
          {funnel.length === 0 ? (
            <EmptyHint text="Aucune étape funnel enregistrée." />
          ) : (
            funnel.map((f) => (
              <Row
                key={f.action}
                left={prettyFunnelStep(f.action)}
                middle={`${f.unique_users} users`}
                right={`${f.steps} actions · ${f.unique_sessions} sessions`}
              />
            ))
          )}
        </Section>

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
    </SafeAreaView>
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

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s - m * 60);
  return rest === 0 ? `${m}min` : `${m}min ${rest}s`;
}

function prettyFunnelStep(action: string): string {
  switch (action) {
    case 'open_listing':   return '1. Ouvrir annonce';
    case 'open_reserve':   return '2. Ouvrir réservation';
    case 'submit_reserve': return '3. Valider réservation';
    case 'open_checkout':  return '4. Aller au paiement';
    case 'payment_success':return '5. ✅ Paiement réussi';
    case 'payment_error':  return '❌ Erreur paiement';
    default: return action;
  }
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
