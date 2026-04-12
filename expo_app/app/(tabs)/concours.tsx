import { useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles, Shadow } from '../../constants/theme';
import { MON_PALMARES } from '../../data/mockConcours';
import { Concours, StatutConcours, Epreuve } from '../../types/concours';
import { concoursStore } from '../../data/store';

type MainTab = 'prochains' | 'live' | 'palmares';

const STATUT_CONFIG: Record<StatutConcours, { label: string; color: string; bg: string }> = {
  ouvert: { label: 'Ouvert', color: Colors.success, bg: Colors.successBg },
  complet: { label: 'Complet', color: Colors.warning, bg: Colors.warningBg },
  ferme: { label: 'Fermé', color: Colors.textTertiary, bg: Colors.surfaceVariant },
  termine: { label: 'Terminé', color: Colors.textTertiary, bg: Colors.surfaceVariant },
  brouillon: { label: 'Brouillon', color: Colors.textTertiary, bg: Colors.surfaceVariant },
};

const DISC_COLORS: Record<string, string> = {
  CSO: Colors.cso,
  Dressage: Colors.dressage,
  CCE: Colors.cce,
  Hunter: Colors.hunter,
};

export default function ConcoursScreen() {
  const [tab, setTab] = useState<MainTab>('prochains');
  const [prochains, setProchains] = useState<Concours[]>([]);
  const [liveConc, setLiveConc] = useState<Concours | undefined>();

  useFocusEffect(useCallback(() => {
    const live = concoursStore.list.find((c) => c.enLive && c.statut !== 'brouillon');
    const future = concoursStore.list.filter((c) => !c.enLive && c.statut !== 'brouillon');
    setLiveConc(live);
    setProchains(future);
  }, []));

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Concours</Text>
        <Text style={s.headerSub}>{concoursStore.list.filter(c => c.statut !== 'brouillon').length} événements</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        <TabBtn label="📅 À venir" active={tab === 'prochains'} onPress={() => setTab('prochains')} />
        <TabBtn
          label="🔴 En direct"
          active={tab === 'live'}
          onPress={() => setTab('live')}
          live
        />
        <TabBtn label="🏅 Palmarès" active={tab === 'palmares'} onPress={() => setTab('palmares')} />
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {tab === 'prochains' && prochains.map((c) => <ConcoursCard key={c.id} concours={c} />)}
        {tab === 'live' && <LivePanel concours={liveConc} />}
        {tab === 'palmares' && <PalmaresPanel />}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Tab button ─────────────────────────────────────────────────── */
function TabBtn({ label, active, onPress, live }: {
  label: string; active: boolean; onPress: () => void; live?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.tabBtn, active && s.tabBtnActive, live && active && s.tabBtnLive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[s.tabLabel, active && s.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ─── Concours card ──────────────────────────────────────────────── */
function ConcoursCard({ concours }: { concours: Concours }) {
  const [expanded, setExpanded] = useState(false);
  const statut = STATUT_CONFIG[concours.statut];
  const discColor = DISC_COLORS[concours.discipline] ?? Colors.primary;
  const pct = Math.round((concours.nbInscrits / concours.nbPlaces) * 100);

  return (
    <View style={s.card}>
      <View style={[s.discBand, { backgroundColor: discColor }]}>
        <Text style={s.discText}>{concours.discipline}</Text>
        {concours.meteo && <Text style={s.meteo}>{concours.meteo}</Text>}
      </View>

      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <Text style={s.nom}>{concours.nom}</Text>
          <View style={[s.statutBadge, { backgroundColor: statut.bg }]}>
            <Text style={[s.statutText, { color: statut.color }]}>{statut.label}</Text>
          </View>
        </View>

        <View style={s.infoGrid}>
          <Text style={s.infoText}>📅 {concours.dateDebut.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })} - {concours.dateFin.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          <Text style={s.infoText}>📍 {concours.lieu}</Text>
          {concours.horaireDebut && <Text style={s.infoText}>🕐 {concours.horaireDebut} - {concours.horaireFin}</Text>}
          <Text style={s.infoText}>👤 {concours.organisateurNom}</Text>
          {concours.region && <Text style={s.infoText}>🗺 {concours.region}</Text>}
        </View>

        {expanded && (
          <View style={s.expandedSection}>
            {concours.typesCavaliers.length > 0 && <Text style={s.detailText}>🏇 Types: {concours.typesCavaliers.join(', ')}</Text>}
            {concours.epreuves && concours.epreuves.length > 0 && <Text style={s.detailText}>🎯 Épreuves: {concours.epreuves.join(', ')}</Text>}
            {concours.description && <Text style={s.description}>{concours.description}</Text>}
            {concours.infosComplementaires && (
              <View style={s.infosComp}>
                {concours.infosComplementaires.restauration && <Text style={s.infoLine}>🍽 {concours.infosComplementaires.restauration}</Text>}
                {concours.infosComplementaires.parking && <Text style={s.infoLine}>🅿️ {concours.infosComplementaires.parking}</Text>}
                {concours.infosComplementaires.veterinaire && <Text style={s.infoLine}>⚕️ Vétérinaire disponible</Text>}
                {concours.infosComplementaires.coaching && <Text style={s.infoLine}>🎓 Coaching disponible</Text>}
                {concours.infosComplementaires.douches && <Text style={s.infoLine}>🚿 Douches</Text>}
                {concours.infosComplementaires.wifi && <Text style={s.infoLine}>📡 Wi-Fi</Text>}
                {concours.infosComplementaires.securite && <Text style={s.infoLine}>🚨 {concours.infosComplementaires.securite}</Text>}
                {concours.infosComplementaires.autre && <Text style={s.infoLine}>ℹ️ {concours.infosComplementaires.autre}</Text>}
              </View>
            )}
          </View>
        )}

        <View style={s.jauge}>
          <View style={s.jaugeBg}>
            <View style={[s.jaugeFill, { width: `${pct}%` as any, backgroundColor: discColor }]} />
          </View>
          <Text style={s.jaugeText}>{concours.nbInscrits}/{concours.nbPlaces} inscrits · {pct}%</Text>
        </View>

        <View style={s.cardActions}>
          <TouchableOpacity style={s.detailBtn} onPress={() => setExpanded(!expanded)}>
            <Text style={s.detailBtnText}>{expanded ? 'Moins' : 'Détails'}</Text>
          </TouchableOpacity>
          {concours.statut === 'ouvert' && (
            <TouchableOpacity style={[s.inscBtn, { backgroundColor: discColor }]} activeOpacity={0.85}>
              <Text style={s.inscBtnText}>S'inscrire{concours.prix ? ` · ${concours.prix}€` : ''}</Text>
            </TouchableOpacity>
          )}
          {concours.statut === 'complet' && (
            <View style={[s.inscBtn, { backgroundColor: Colors.surfaceVariant }]}>
              <Text style={[s.inscBtnText, { color: Colors.textTertiary }]}>Complet</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/* ─── Live panel ─────────────────────────────────────────────────── */
function LivePanel({ concours }: { concours?: Concours }) {
  const [selEpreuve, setSelEpreuve] = useState<string | null>(null);

  if (!concours) {
    return (
      <View style={s.emptyState}>
        <Text style={s.emptyIcon}>📡</Text>
        <Text style={s.emptyTitle}>Aucun concours en direct</Text>
        <Text style={s.emptyText}>Les résultats en temps réel apparaissent ici dès qu'un concours est en cours.</Text>
      </View>
    );
  }

  const discColor = DISC_COLORS[concours.discipline] ?? Colors.primary;
  const epreuves = concours.epreuves ?? [];
  const activeEp = epreuves.find((e: string) => e === selEpreuve) ?? epreuves[0];

  return (
    <>
      {/* Live header */}
      <View style={s.liveHeader}>
        <View style={s.livePulse}>
          <View style={s.liveDot} />
          <Text style={s.liveLabel}>EN DIRECT</Text>
        </View>
        <Text style={s.liveNom}>{concours.nom}</Text>
        <Text style={s.liveInfo}>📍 {concours.lieu} · {concours.meteo}</Text>
        <View style={s.apiNotice}>
          <Text style={s.apiNoticeText}>🔗 Résultats via API Winjump & Horses & Competitions</Text>
        </View>
      </View>

      {/* Sélecteur épreuve */}
      {epreuves.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.epreuveScroll}>
          {epreuves.map((ep: string, idx: number) => (
            <TouchableOpacity
              key={idx}
              style={[s.epreuveTab, selEpreuve === ep && s.epreuveTabActive]}
              onPress={() => setSelEpreuve(ep)}
            >
              <Text style={s.epreuveNom}>{ep}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Résultats placeholder */}
      <View style={s.noResult}>
        <Text style={s.noResultText}>⏳ Les résultats en direct arrivent bientôt</Text>
      </View>

      {/* Notification info */}
      <View style={s.notifInfo}>
        <Text style={s.notifInfoIcon}>🔔</Text>
        <Text style={s.notifInfoText}>Vous serez notifié de vos résultats et de votre heure de passage en temps réel.</Text>
      </View>
    </>
  );
}

/* ─── Palmarès panel ─────────────────────────────────────────────── */
function PalmaresPanel() {
  return (
    <>
      <View style={s.palmaresHero}>
        <Text style={s.palmaresTitle}>Mon Palmarès</Text>
        <Text style={s.palmaresSubtitle}>Éclipse du Vent · Tous sports</Text>
        <View style={s.palmaresStats}>
          <StatMini label="Concours" value="12" />
          <StatMini label="Victoires" value="3" color={Colors.gold} />
          <StatMini label="Top 3" value="7" color={Colors.primary} />
        </View>
      </View>

      {MON_PALMARES.map((r, i) => {
        const discColor = DISC_COLORS[r.discipline] ?? Colors.primary;
        const medal = r.rang === 1 ? '🥇' : r.rang === 2 ? '🥈' : r.rang === 3 ? '🥉' : null;
        return (
          <View key={i} style={s.palmaresCard}>
            <View style={[s.palmaresDiscBand, { backgroundColor: discColor }]}>
              <Text style={s.palmaresDiscText}>{r.discipline}</Text>
            </View>
            <View style={s.palmaresBody}>
              <View style={s.palmaresTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.palmaresConc}>{r.concoursNom}</Text>
                  <Text style={s.palmaresEp}>{r.epreuve} · {r.cheval}</Text>
                  <Text style={s.palmaresDate}>📅 {r.date} · 📍 {r.lieu}</Text>
                </View>
                <View style={s.rangWrap}>
                  {medal ? (
                    <Text style={s.medalEmoji}>{medal}</Text>
                  ) : (
                    <View style={s.rangBadgeAlt}>
                      <Text style={s.rangBadgeText}>{r.rang}e</Text>
                    </View>
                  )}
                  <Text style={s.totalText}>/{r.total}</Text>
                </View>
              </View>
              {r.score !== '0 pt' && (
                <View style={s.scoreRow}>
                  <Text style={s.scoreText}>Score : {r.score}</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}

      <View style={s.apiNotice}>
        <Text style={s.apiNoticeText}>🔗 Résultats synchronisés via API Equistra — profil cheval mis à jour automatiquement</Text>
      </View>
    </>
  );
}

function StatMini({ label, value, color = Colors.textPrimary }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.statMini}>
      <Text style={[s.statMiniValue, { color }]}>{value}</Text>
      <Text style={s.statMiniLabel}>{label}</Text>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  tabBar: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, paddingBottom: Spacing.md },
  tabBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnLive: { backgroundColor: Colors.urgent, borderColor: Colors.urgent },
  tabLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  tabLabelActive: { color: Colors.textInverse },

  list: { padding: Spacing.lg, paddingTop: 0, gap: Spacing.md, paddingBottom: 100 },

  // Concours card
  card: { ...CommonStyles.card, overflow: 'hidden' },
  discBand: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs + 2 },
  discText: { color: Colors.textInverse, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  meteo: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.xs },
  cardBody: { padding: Spacing.lg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  nom: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginRight: Spacing.sm },
  statutBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.xs },
  statutText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  infoGrid: { gap: 4, marginBottom: Spacing.md },
  infoText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  description: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  jauge: { marginBottom: Spacing.md },
  jaugeBg: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: Spacing.xs },
  jaugeFill: { height: 6, borderRadius: 3 },
  jaugeText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  cardActions: { flexDirection: 'row', gap: Spacing.sm },
  expandedSection: { marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  detailText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold, marginBottom: Spacing.xs },
  infosComp: { gap: Spacing.xs, marginTop: Spacing.md },
  infoLine: { fontSize: FontSize.sm, color: Colors.textSecondary },
  detailBtn: { borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  detailBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  inscBtn: { flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  inscBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },

  // Live
  liveHeader: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.xs },
  livePulse: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.urgent },
  liveLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.urgent, letterSpacing: 1 },
  liveNom: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  liveInfo: { fontSize: FontSize.sm, color: Colors.textSecondary },
  apiNotice: { backgroundColor: Colors.infoBg, borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.infoBorder, marginTop: Spacing.xs },
  apiNoticeText: { fontSize: 11, color: Colors.info },

  epreuveScroll: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  epreuveTab: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, minWidth: 120 },
  epreuveTabActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  epreuveTabLive: { borderColor: Colors.urgent, backgroundColor: Colors.urgentBg },
  epreuveHeure: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  epreuveNom: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  epreuveStatut: { fontSize: 10, color: Colors.textTertiary, marginTop: 2 },

  resultCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, overflow: 'hidden' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  resultNom: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  enCoursBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.urgentBg, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: Colors.urgentBorder },
  enCoursDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.urgent },
  enCoursText: { fontSize: 10, color: Colors.urgent, fontWeight: FontWeight.bold },

  resultTableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surfaceVariant },
  resultCol: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase' },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  resultRowMe: { backgroundColor: Colors.primaryLight },
  rangBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  rangText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary },
  resultCavalier: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  resultCheval: { fontSize: FontSize.xs, color: Colors.textTertiary },
  resultScore: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.primary, width: 60, textAlign: 'right' },

  noResult: { padding: Spacing.lg, alignItems: 'center' },
  noResultText: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center' },

  notifInfo: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.goldBg, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.goldBorder, alignItems: 'flex-start' },
  notifInfoIcon: { fontSize: 16 },
  notifInfoText: { fontSize: FontSize.sm, color: Colors.gold, flex: 1, lineHeight: 20 },

  emptyState: { alignItems: 'center', padding: Spacing.xxxl, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Palmarès
  palmaresHero: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, alignItems: 'center', gap: Spacing.sm },
  palmaresTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  palmaresSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
  palmaresStats: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.sm },
  statMini: { alignItems: 'center' },
  statMiniValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold },
  statMiniLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },

  palmaresCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, overflow: 'hidden' },
  palmaresDiscBand: { paddingHorizontal: Spacing.lg, paddingVertical: 4 },
  palmaresDiscText: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  palmaresBody: { padding: Spacing.lg },
  palmaresTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  palmaresConc: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  palmaresEp: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  palmaresDate: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  rangWrap: { alignItems: 'center' },
  medalEmoji: { fontSize: 28 },
  rangBadgeAlt: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  rangBadgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  totalText: { fontSize: FontSize.xs, color: Colors.textTertiary },
  scoreRow: { marginTop: Spacing.xs },
  scoreText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
});
