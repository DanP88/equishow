import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { PROTO_COACH } from '../../data/mockProto';

/**
 * PROTOTYPE — Étape 6 : fiche coach avec présence concours.
 * 🟢 confirmé = réservable sur le concours · 🟡 intéressé = aspirationnel (non réservable).
 */
export default function ProtoCoach() {
  const c = PROTO_COACH;
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title}>Profil coach</Text>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {/* Identité */}
        <View style={s.idCard}>
          <View style={[s.avatar, { backgroundColor: c.couleur }]}><Text style={s.avatarTxt}>{c.initiales}</Text></View>
          <View style={{ flex: 1 }}>
            <View style={s.nameRow}>
              <Text style={s.nom}>🎓 {c.nom}</Text>
              {c.certifie && <Text style={s.certifie}>✅</Text>}
            </View>
            <Text style={s.note}>⭐ {c.note} ({c.nbAvis} avis)</Text>
            <Text style={s.meta}>{c.disciplines.join(' · ')} · {c.niveau}</Text>
            <Text style={s.meta}>📍 {c.region}</Text>
          </View>
        </View>

        {/* Présence concours */}
        <Text style={s.sectionTitle}>Présente sur ces concours</Text>
        <View style={s.presCard}>
          {c.presences.map((p) => {
            const confirme = p.statut === 'confirme';
            return (
              <TouchableOpacity
                key={p.concoursId}
                style={s.presRow}
                activeOpacity={0.8}
                onPress={() => router.push(`/proto/concours/${p.concoursId}?variant=A` as any)}
              >
                <Text style={s.presDot}>{confirme ? '🟢' : '🟡'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.presNom}>🏆 {p.nom}</Text>
                  <Text style={s.presDate}>{p.dateLabel}</Text>
                </View>
                <View style={[s.statutPill, confirme ? s.pillOk : s.pillSoft]}>
                  <Text style={[s.statutTxt, confirme ? s.statutOk : s.statutSoft]}>
                    {confirme ? 'Confirmée' : 'Intéressée'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={s.note2}>
          Côté cavalier, seuls les concours <Text style={{ fontWeight: FontWeight.bold }}>🟢 confirmés</Text> apparaissent
          dans le filtre « coachs présents » — pas de dispo fantôme.
        </Text>

        {/* Réservation */}
        <View style={s.tarifRow}>
          <Text style={s.tarifLabel}>Tarif</Text>
          <Text style={s.tarifValue}>{c.tarif} € / séance</Text>
        </View>
        <TouchableOpacity style={s.bookBtn} activeOpacity={0.85}>
          <Text style={s.bookTxt}>Réserver un cours</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.contactBtn} activeOpacity={0.8}>
          <Text style={s.contactTxt}>💬 Contacter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceVariant },
  backTxt: { fontSize: 20, color: Colors.textPrimary },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  list: { padding: Spacing.lg, paddingBottom: 100 },

  idCard: { flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, ...Shadow.card },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.xl },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nom: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  certifie: { fontSize: 14 },
  note: { fontSize: FontSize.sm, color: Colors.gold, fontWeight: FontWeight.semibold, marginTop: 2 },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  presCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.card },
  presRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  presDot: { fontSize: 12 },
  presNom: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  presDate: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  statutPill: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.xs },
  pillOk: { backgroundColor: Colors.successBg },
  pillSoft: { backgroundColor: Colors.warningBg },
  statutTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  statutOk: { color: Colors.success },
  statutSoft: { color: Colors.warning },
  note2: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.sm, lineHeight: 17 },

  tarifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xl },
  tarifLabel: { fontSize: FontSize.base, color: Colors.textSecondary },
  tarifValue: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  bookBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  bookTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  contactBtn: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  contactTxt: { color: Colors.textPrimary, fontWeight: FontWeight.semibold, fontSize: FontSize.base },
});
