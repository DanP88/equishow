import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';

const MOCK = {
  nom: 'Émilie Laurent',
  pseudo: 'EmilieLaurent_Pro',
  disciplines: ['CSO', 'Hunter'],
  region: 'Auvergne-Rhône-Alpes',
  tarifHeure: 65,
  note: 4.9,
  nbAvis: 47,
  disponible: true,
};

const DEMANDES = [
  { id: '1', cavalier: 'SarahL_CSO', cheval: 'Éclipse du Vent', date: '15 avr', lieu: 'Grand Prix de Lyon', discipline: 'CSO', statut: 'nouveau' },
  { id: '2', cavalier: 'ThomasR_CCE', cheval: 'Mistral', date: '22 avr', lieu: 'Championnat Dressage', discipline: 'Hunter', statut: 'confirme' },
  { id: '3', cavalier: 'Lucie_CSO_Pro', cheval: 'Diamant Noir', date: '10 mai', lieu: 'Trophée CCE', discipline: 'CSO', statut: 'confirme' },
];

const AGENDA = [
  { jour: 'Mer 15 avr', creneaux: ['09h00 - SarahL_CSO · Éclipse', '14h30 - Libre', '16h00 - Libre'] },
  { jour: 'Sam 22 avr', creneaux: ['08h00 - ThomasR · Mistral', '10h00 - Libre'] },
];

export default function PreviewCoachScreen() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Interface Coach</Text>
          <Text style={s.headerSub}>Aperçu de votre tableau de bord</Text>
        </View>
        <View style={[s.previewBadge]}>
          <Text style={s.previewBadgeText}>APERÇU</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.container}>

        {/* Profil Coach */}
        <View style={s.coachHero}>
          <View style={[s.avatar, { backgroundColor: '#7C3AED' }]}>
            <Text style={s.avatarText}>EL</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coachName}>{MOCK.nom}</Text>
            <Text style={s.coachPseudo}>@{MOCK.pseudo}</Text>
            <View style={s.ratingRow}>
              <Text style={s.stars}>★★★★★</Text>
              <Text style={s.rating}>{MOCK.note} ({MOCK.nbAvis} avis)</Text>
            </View>
          </View>
          <View style={s.disponibleBadge}>
            <Text style={s.disponibleDot}>●</Text>
            <Text style={s.disponibleText}>Disponible</Text>
          </View>
        </View>

        {/* Stats rapides */}
        <View style={s.statsRow}>
          <StatCard icon="📅" value="3" label="Demandes" color="#7C3AED" />
          <StatCard icon="💰" value="390€" label="Ce mois" color={Colors.success} />
          <StatCard icon="⭐" value="47" label="Avis" color={Colors.gold} />
        </View>

        {/* Demandes de coaching */}
        <SectionTitle title="Demandes reçues" icon="📬" />
        {DEMANDES.map((d) => (
          <View key={d.id} style={s.demandeCard}>
            <View style={s.demandeLeft}>
              <View style={[s.demandeStatut, { backgroundColor: d.statut === 'nouveau' ? Colors.primaryLight : Colors.successBg }]}>
                <Text style={[s.demandeStatutText, { color: d.statut === 'nouveau' ? Colors.primary : Colors.success }]}>
                  {d.statut === 'nouveau' ? '● Nouveau' : '✓ Confirmé'}
                </Text>
              </View>
              <Text style={s.demandeCavalier}>@{d.cavalier}</Text>
              <Text style={s.demandeDetail}>{d.cheval} · {d.discipline}</Text>
              <Text style={s.demandeDate}>📅 {d.date} — {d.lieu}</Text>
            </View>
            {d.statut === 'nouveau' && (
              <View style={s.demandeActions}>
                <TouchableOpacity style={s.refuseBtn} onPress={() => Alert.alert('Demande refusée', `Vous avez refusé la demande de @${d.cavalier}.`)}>
                  <Text style={s.refuseText}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.acceptBtn} onPress={() => Alert.alert('Demande acceptée ✓', `Coaching confirmé avec @${d.cavalier} le ${d.date} — ${d.lieu}.\n\nUn message a été envoyé au cavalier.`)}>
                  <Text style={s.acceptText}>✓</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {/* Agenda */}
        <SectionTitle title="Mon agenda" icon="🗓" />
        {AGENDA.map((a) => (
          <View key={a.jour} style={s.agendaDay}>
            <Text style={s.agendaJour}>{a.jour}</Text>
            {a.creneaux.map((c) => (
              <View key={c} style={[s.creneau, c.includes('Libre') && s.creneauLibre]}>
                <Text style={[s.creneauText, c.includes('Libre') && s.creneauLibreText]}>{c}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Mes services */}
        <SectionTitle title="Mes services" icon="🎓" />
        <View style={s.serviceCard}>
          <View style={s.serviceRow}>
            <Text style={s.serviceLabel}>Tarif horaire</Text>
            <Text style={s.serviceValue}>{MOCK.tarifHeure}€ HT / heure</Text>
          </View>
          <View style={s.serviceRow}>
            <Text style={s.serviceLabel}>Disciplines</Text>
            <Text style={s.serviceValue}>{MOCK.disciplines.join(', ')}</Text>
          </View>
          <View style={s.serviceRow}>
            <Text style={s.serviceLabel}>Région</Text>
            <Text style={s.serviceValue}>{MOCK.region}</Text>
          </View>
          <View style={[s.serviceRow, { borderBottomWidth: 0 }]}>
            <Text style={s.serviceLabel}>Commission plateforme</Text>
            <Text style={[s.serviceValue, { color: Colors.textTertiary }]}>9% par paiement</Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity style={s.switchBtn} onPress={() => { router.back(); }}>
          <Text style={s.switchBtnText}>Passer en compte Coach</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={s.sectionTitle}>
      <Text style={s.sectionIcon}>{icon}</Text>
      <Text style={s.sectionTitleText}>{title}</Text>
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
  previewBadge: { backgroundColor: '#7C3AED22', borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: '#7C3AED66' },
  previewBadgeText: { fontSize: 10, color: '#7C3AED', fontWeight: FontWeight.bold, letterSpacing: 0.5 },

  container: { padding: Spacing.lg, gap: Spacing.md },

  coachHero: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.textInverse, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  coachName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  coachPseudo: { fontSize: FontSize.xs, color: '#7C3AED', fontWeight: FontWeight.semibold },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  stars: { color: Colors.gold, fontSize: FontSize.sm },
  rating: { fontSize: FontSize.xs, color: Colors.textTertiary },
  disponibleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.successBg, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: Colors.successBorder },
  disponibleDot: { fontSize: 8, color: Colors.success },
  disponibleText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold },

  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },

  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  sectionIcon: { fontSize: 16 },
  sectionTitleText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  demandeCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  demandeLeft: { flex: 1, gap: 3 },
  demandeStatut: { alignSelf: 'flex-start', borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  demandeStatutText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  demandeCavalier: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  demandeDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  demandeDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
  demandeActions: { gap: Spacing.xs },
  refuseBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: Colors.urgentBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.urgentBg },
  refuseText: { color: Colors.urgent, fontWeight: FontWeight.bold },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: Colors.textInverse, fontWeight: FontWeight.bold },

  agendaDay: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.xs },
  agendaJour: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  creneau: { backgroundColor: '#7C3AED15', borderRadius: Radius.sm, padding: Spacing.sm, borderLeftWidth: 3, borderLeftColor: '#7C3AED' },
  creneauLibre: { backgroundColor: Colors.surfaceVariant, borderLeftColor: Colors.border },
  creneauText: { fontSize: FontSize.sm, color: '#7C3AED', fontWeight: FontWeight.semibold },
  creneauLibreText: { color: Colors.textTertiary, fontWeight: FontWeight.regular },

  serviceCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, overflow: 'hidden' },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  serviceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  serviceValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },

  switchBtn: { backgroundColor: '#7C3AED', borderRadius: Radius.lg, paddingVertical: Spacing.md + 2, alignItems: 'center', marginTop: Spacing.md },
  switchBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});
