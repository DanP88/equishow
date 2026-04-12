import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';

const CONCOURS = [
  {
    id: 'c1', nom: 'Grand Prix de Lyon', date: '14-16 avr 2026', lieu: 'Haras de Lyon — 69',
    disciplines: ['CSO', 'Dressage'], inscrits: 42, capacity: 60,
    statut: 'ouvert',
  },
  {
    id: 'c2', nom: 'Trophée CCE Automne', date: '10-12 mai 2026', lieu: 'Domaine du Verdon — 04',
    disciplines: ['CCE'], inscrits: 18, capacity: 30,
    statut: 'brouillon',
  },
];

const NOTIFICATIONS_SENT = [
  { type: 'coach', count: 14, discipline: 'CSO' },
  { type: 'cavalier', count: 87, discipline: 'CSO, Dressage' },
];

const SERVICES = [
  { type: 'Box', annonces: 3, reservees: 11, libres: 9 },
  { type: 'Transport', annonces: 2, reservees: 4, libres: 2 },
];

const PAIEMENTS = [
  { label: 'Inscriptions Grand Prix Lyon', montant: 2100, statut: 'reçu' },
  { label: 'Location boxes (8 nuits)', montant: 280, statut: 'reçu' },
  { label: 'Commission plateforme (9%)', montant: -214, statut: 'prélevé' },
];

export default function PreviewOrganisateurScreen() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Interface Organisateur</Text>
          <Text style={s.headerSub}>Aperçu de votre tableau de bord</Text>
        </View>
        <View style={s.previewBadge}>
          <Text style={s.previewBadgeText}>APERÇU</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.container}>

        {/* Stats */}
        <View style={s.statsRow}>
          <StatCard icon="🏟️" value="2" label="Concours" color="#0369A1" />
          <StatCard icon="👥" value="42" label="Inscrits" color={Colors.primary} />
          <StatCard icon="💰" value="2 380€" label="Revenus" color={Colors.success} />
        </View>

        {/* Mes concours */}
        <SectionTitle title="Mes concours" icon="🏆" action="+ Créer" />
        {CONCOURS.map((c) => (
          <View key={c.id} style={s.concoursCard}>
            <View style={s.concoursTop}>
              <View style={[s.statutBadge, { backgroundColor: c.statut === 'ouvert' ? Colors.successBg : Colors.surfaceVariant, borderColor: c.statut === 'ouvert' ? Colors.successBorder : Colors.border }]}>
                <Text style={[s.statutText, { color: c.statut === 'ouvert' ? Colors.success : Colors.textTertiary }]}>
                  {c.statut === 'ouvert' ? '● Ouvert aux inscriptions' : '○ Brouillon'}
                </Text>
              </View>
            </View>
            <Text style={s.concoursNom}>{c.nom}</Text>
            <Text style={s.concoursInfo}>📅 {c.date}</Text>
            <Text style={s.concoursInfo}>📍 {c.lieu}</Text>
            <View style={s.disciplineRow}>
              {c.disciplines.map((d) => (
                <View key={d} style={s.disciplineChip}>
                  <Text style={s.disciplineText}>{d}</Text>
                </View>
              ))}
            </View>
            {/* Jauge inscriptions */}
            <View style={s.jauge}>
              <View style={s.jaugeBar}>
                <View style={[s.jaugeFill, { width: `${(c.inscrits / c.capacity) * 100}%` as any }]} />
              </View>
              <Text style={s.jaugeLabel}>{c.inscrits}/{c.capacity} inscrits</Text>
            </View>
            <View style={s.concoursActions}>
              <TouchableOpacity style={s.actionBtn} onPress={() => Alert.alert('Modifier', `Modification de "${c.nom}" — formulaire d'édition disponible dans la version finale.`)}>
                <Text style={s.actionBtnText}>✏️ Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={() => Alert.alert('Inscrits', `${c.inscrits} cavaliers inscrits sur ${c.capacity} places.\n\nListe complète disponible dans la version finale.`)}>
                <Text style={s.actionBtnText}>👥 Inscrits</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]} onPress={() => Alert.alert('Notification envoyée 📣', `${NOTIFICATIONS_SENT.reduce((a, n) => a + n.count, 0)} participants notifiés pour "${c.nom}".`)}>
                <Text style={s.actionBtnPrimaryText}>📣 Notifier</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Notifications envoyées */}
        <SectionTitle title="Notifications envoyées" icon="🔔" />
        <View style={s.notifCard}>
          {NOTIFICATIONS_SENT.map((n, i) => (
            <View key={i} style={[s.notifRow, i < NOTIFICATIONS_SENT.length - 1 && s.notifRowBorder]}>
              <Text style={s.notifIcon}>{n.type === 'coach' ? '🎓' : '🏇'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.notifText}>
                  <Text style={s.notifCount}>{n.count} {n.type === 'coach' ? 'coachs' : 'cavaliers'}</Text> notifiés
                </Text>
                <Text style={s.notifDisc}>{n.discipline}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Services sur site */}
        <SectionTitle title="Services sur site" icon="🤝" />
        <View style={s.servicesGrid}>
          {SERVICES.map((sv) => (
            <View key={sv.type} style={s.serviceCard}>
              <Text style={s.serviceType}>{sv.type === 'Box' ? '🏠' : '🚐'} {sv.type}</Text>
              <Text style={s.serviceNum}>{sv.reservees} réservées</Text>
              <Text style={s.serviceLibres}>{sv.libres} libres</Text>
            </View>
          ))}
        </View>

        {/* Paiements */}
        <SectionTitle title="Suivi financier" icon="💳" />
        <View style={s.paiementsCard}>
          {PAIEMENTS.map((p, i) => (
            <View key={i} style={[s.paiementRow, i < PAIEMENTS.length - 1 && s.paiementBorder]}>
              <Text style={s.paiementLabel}>{p.label}</Text>
              <Text style={[s.paiementMontant, p.montant < 0 && { color: Colors.urgent }]}>
                {p.montant > 0 ? '+' : ''}{p.montant.toLocaleString('fr-FR')}€
              </Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Net organisateur</Text>
            <Text style={s.totalMontant}>+2 166€</Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity style={s.switchBtn} onPress={() => router.back()}>
          <Text style={s.switchBtnText}>Passer en compte Organisateur</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title, icon, action }: { title: string; icon: string; action?: string }) {
  return (
    <View style={s.sectionTitle}>
      <Text style={s.sectionIcon}>{icon}</Text>
      <Text style={s.sectionTitleText}>{title}</Text>
      {action && <TouchableOpacity style={s.sectionAction}><Text style={s.sectionActionText}>{action}</Text></TouchableOpacity>}
    </View>
  );
}

function StatCard({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <View style={[s.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.xs, color: Colors.textTertiary },
  previewBadge: { backgroundColor: '#0369A122', borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: '#0369A166' },
  previewBadgeText: { fontSize: 10, color: '#0369A1', fontWeight: FontWeight.bold, letterSpacing: 0.5 },

  container: { padding: Spacing.lg, gap: Spacing.md },

  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },

  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  sectionIcon: { fontSize: 16 },
  sectionTitleText: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sectionAction: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  sectionActionText: { fontSize: FontSize.xs, color: Colors.textInverse, fontWeight: FontWeight.bold },

  concoursCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.xs },
  concoursTop: { flexDirection: 'row' },
  statutBadge: { borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1 },
  statutText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  concoursNom: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.xs },
  concoursInfo: { fontSize: FontSize.sm, color: Colors.textSecondary },
  disciplineRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  disciplineChip: { backgroundColor: Colors.primaryLight, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: Colors.primary + '44' },
  disciplineText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  jauge: { gap: 4 },
  jaugeBar: { height: 6, backgroundColor: Colors.surfaceVariant, borderRadius: 3, overflow: 'hidden' },
  jaugeFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  jaugeLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  concoursActions: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  actionBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingVertical: Spacing.xs + 2, alignItems: 'center', backgroundColor: Colors.surfaceVariant },
  actionBtnText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  actionBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  actionBtnPrimaryText: { fontSize: FontSize.xs, color: Colors.textInverse, fontWeight: FontWeight.bold },

  notifCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, overflow: 'hidden' },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  notifRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  notifIcon: { fontSize: 20 },
  notifText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  notifCount: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
  notifDisc: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },

  servicesGrid: { flexDirection: 'row', gap: Spacing.sm },
  serviceCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: 3 },
  serviceType: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  serviceNum: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  serviceLibres: { fontSize: FontSize.xs, color: Colors.success },

  paiementsCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, overflow: 'hidden' },
  paiementRow: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.lg, alignItems: 'center' },
  paiementBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  paiementLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  paiementMontant: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.success },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.lg, borderTopWidth: 2, borderTopColor: Colors.primary + '44', backgroundColor: Colors.primaryLight },
  totalLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  totalMontant: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.primary },

  switchBtn: { backgroundColor: '#0369A1', borderRadius: Radius.lg, paddingVertical: Spacing.md + 2, alignItems: 'center', marginTop: Spacing.md },
  switchBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});
