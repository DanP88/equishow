import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { PROTO_CONCOURS } from '../../data/mockProto';

/** PROTOTYPE — Étape 4 : liste des concours (contexte, jamais obligatoire). */
export default function ProtoConcoursList() {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🏆 Concours</Text>
          <Text style={s.sub}>Prépare ton déplacement</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/proto' as any)} style={s.protoBtn}>
          <Text style={s.protoBtnTxt}>🧪 Proto</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {PROTO_CONCOURS.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={s.card}
            activeOpacity={0.85}
            onPress={() => router.push(`/proto/concours/${c.id}?variant=A` as any)}
          >
            <View style={[s.band, { backgroundColor: c.couleur }]}>
              <Text style={s.bandTxt}>{c.discipline}</Text>
            </View>
            <View style={s.body}>
              <Text style={s.nom}>{c.emoji} {c.nom}</Text>
              <Text style={s.meta}>📅 {c.dateLabel}</Text>
              <Text style={s.meta}>📍 {c.lieu} ({c.departement})</Text>
              <View style={s.footer}>
                <Text style={s.followers}>⭐ {c.followers} abonnés · 👁 {c.vues} vues</Text>
                <View style={s.voirBtn}><Text style={s.voirTxt}>Voir →</Text></View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
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
  protoBtn: { backgroundColor: Colors.infoBg, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderWidth: 1, borderColor: Colors.infoBorder },
  protoBtnTxt: { fontSize: FontSize.xs, color: Colors.info, fontWeight: FontWeight.bold },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 100 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.card },
  band: { paddingHorizontal: Spacing.lg, paddingVertical: 4 },
  bandTxt: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  body: { padding: Spacing.lg },
  nom: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: 6 },
  meta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md },
  followers: { fontSize: FontSize.xs, color: Colors.textTertiary },
  voirBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  voirTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
