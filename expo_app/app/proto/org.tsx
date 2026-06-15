import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { PROTO_ORG_CONCOURS } from '../../data/mockProto';

/**
 * PROTOTYPE — Étape 7 : espace organisateur (onglet Concours uniquement).
 * Services / Messages / Notifications / Communauté / Profil restent mutualisés (non touchés).
 */
export default function ProtoOrg() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <View>
          <Text style={s.title}>🏆 Concours</Text>
          <Text style={s.sub}>Espace organisateur</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        <Text style={s.sectionTitle}>Mes concours</Text>

        {PROTO_ORG_CONCOURS.map((c) => {
          const valide = c.statut === 'valide';
          return (
            <View key={c.id} style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.nom}>🏆 {c.nom}</Text>
                <View style={[s.badge, valide ? s.badgeOk : s.badgeWait]}>
                  <Text style={[s.badgeTxt, valide ? s.badgeTxtOk : s.badgeTxtWait]}>
                    {valide ? '✅ Validé' : '⏳ En attente'}
                  </Text>
                </View>
              </View>
              <Text style={s.meta}>📅 {c.dateLabel} · 📍 {c.lieu}</Text>

              {valide ? (
                <>
                  <View style={s.statsRow}>
                    <Text style={s.stat}>👁 {c.vues} vues</Text>
                    <Text style={s.stat}>📦 {c.nbBoxes}</Text>
                    <Text style={s.stat}>🚐 {c.nbTransports}</Text>
                    <Text style={s.stat}>🎓 {c.nbCoachs}</Text>
                  </View>
                  <TouchableOpacity style={s.gererBtn} activeOpacity={0.85}>
                    <Text style={s.gererTxt}>Gérer →</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={s.waitBox}>
                  <Text style={s.waitTxt}>Validation par un administrateur Equishow (24-48h).</Text>
                </View>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={s.claimBtn} activeOpacity={0.85} onPress={() => router.push('/proto/org-revendiquer' as any)}>
          <Text style={s.claimTxt}>➕ Revendiquer un concours</Text>
        </TouchableOpacity>

        <Text style={s.footNote}>
          Toute la logique organisateur est concentrée ici. Les autres écrans (Services, Messages,
          Notifications, Communauté, Profil) restent identiques aux autres rôles.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceVariant },
  backTxt: { fontSize: 20, color: Colors.textPrimary },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, ...Shadow.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  nom: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginRight: Spacing.sm },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.xs },
  badgeOk: { backgroundColor: Colors.successBg },
  badgeWait: { backgroundColor: Colors.warningBg },
  badgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  badgeTxtOk: { color: Colors.success },
  badgeTxtWait: { color: Colors.warning },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm, flexWrap: 'wrap' },
  stat: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  gererBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.md },
  gererTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  waitBox: { backgroundColor: Colors.warningBg, borderRadius: Radius.sm, padding: Spacing.sm, marginTop: Spacing.sm },
  waitTxt: { fontSize: FontSize.xs, color: Colors.warning },

  claimBtn: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  claimTxt: { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  footNote: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.md, lineHeight: 17 },
});
