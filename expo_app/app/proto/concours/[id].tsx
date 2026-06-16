import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../../constants/theme';
import { getProtoConcours } from '../../../data/mockProto';

type Variant = 'A' | 'B';

/**
 * PROTOTYPE — Étape 5 : fiche concours.
 * Variante A = compteurs visibles. Variante B = aucun compteur.
 * Concours « mince » (0 offre) → bascule auto en mode anti cold-start.
 */
export default function ProtoConcoursFiche() {
  const params = useLocalSearchParams<{ id: string; variant?: string }>();
  const concours = getProtoConcours(params.id);
  const [variant, setVariant] = useState<Variant>(params.variant === 'B' ? 'B' : 'A');
  const [followed, setFollowed] = useState(false);

  if (!concours) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
          <Text style={s.title}>Concours introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const services = [
    { icon: '📦', label: 'Box', count: concours.nbBoxes },
    { icon: '🚐', label: 'Transport', count: concours.nbTransports },
    { icon: '🎓', label: 'Coachs présents', count: concours.nbCoachs },
  ];

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{concours.nom}</Text>
      </View>

      {/* A/B switch (proto only) */}
      <View style={s.abBar}>
        <Text style={s.abLabel}>🧪 Variante :</Text>
        <TouchableOpacity style={[s.abBtn, variant === 'A' && s.abBtnActive]} onPress={() => setVariant('A')}>
          <Text style={[s.abTxt, variant === 'A' && s.abTxtActive]}>A · avec compteurs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.abBtn, variant === 'B' && s.abBtnActive]} onPress={() => setVariant('B')}>
          <Text style={[s.abTxt, variant === 'B' && s.abTxtActive]}>B · sans compteur</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {/* Hero */}
        <View style={[s.band, { backgroundColor: concours.couleur }]}>
          <Text style={s.bandTxt}>{concours.discipline} · Dépt {concours.departement}</Text>
        </View>
        <Text style={s.nom}>{concours.emoji} {concours.nom}</Text>
        <Text style={s.meta}>📅 {concours.dateLabel}</Text>
        <Text style={s.meta}>📍 {concours.lieu}</Text>
        <Text style={s.metaDim}>N° FFE {concours.numeroFFE} · 👁 {concours.vues} vues · ⭐ {concours.followers} abonnés</Text>

        {/* FFE clic-out */}
        <TouchableOpacity style={s.ffeBtn} activeOpacity={0.85}>
          <Text style={s.ffeTxt}>🔗 S'inscrire sur la FFE  ↗</Text>
        </TouchableOpacity>
        <Text style={s.ffeNote}>Les inscriptions restent sur la FFE. Equishow t'aide à organiser le déplacement.</Text>

        {/* Services autour */}
        <Text style={s.sectionTitle}>Organise ton déplacement</Text>
        <View style={s.servicesCard}>
          {services.map((sv) => {
            const empty = sv.count === 0;
            return (
              <TouchableOpacity
                key={sv.label}
                style={s.serviceRow}
                activeOpacity={0.8}
                onPress={() => router.push('/proto/cross-sell' as any)}
              >
                <Text style={s.serviceIcon}>{sv.icon}</Text>
                <Text style={s.serviceLabel}>{sv.label}</Text>
                <View style={{ flex: 1 }} />
                {/* Variante A : compteur si dispo ; Variante B : jamais de compteur */}
                {variant === 'A' && !empty && (
                  <View style={s.countPill}>
                    <Text style={s.countDot}>🟢</Text>
                    <Text style={s.countTxt}>{sv.count} dispo</Text>
                  </View>
                )}
                {variant === 'A' && empty && (
                  <Text style={s.soonTxt}>Bientôt</Text>
                )}
                <Text style={s.chev}>›</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Anti cold-start : concours mince */}
        {concours.nbBoxes + concours.nbTransports + concours.nbCoachs === 0 && (
          <View style={s.coldStart}>
            <Text style={s.coldTitle}>🪙 Sois le premier prévenu</Text>
            <Text style={s.coldTxt}>
              Aucune offre publiée pour l'instant. Suis ce concours : tu seras notifié dès qu'un box,
              un transport ou un coach est disponible.
            </Text>
          </View>
        )}

        {/* Suivre */}
        <TouchableOpacity
          style={[s.followBtn, followed && s.followBtnOn]}
          activeOpacity={0.85}
          onPress={() => setFollowed((v) => !v)}
        >
          <Text style={[s.followTxt, followed && s.followTxtOn]}>
            {followed ? '⭐ Concours suivi ✓' : '⭐ Suivre ce concours'}
          </Text>
        </TouchableOpacity>
        <Text style={s.followNote}>Capteur de demande : indique aux vendeurs où poser leur offre.</Text>

        {/* Démo : réserver → cross-sell */}
        <TouchableOpacity style={s.demoBtn} activeOpacity={0.85} onPress={() => router.push('/proto/cross-sell' as any)}>
          <Text style={s.demoTxt}>▶︎ Démo : je réserve un box ici</Text>
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
  title: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },

  abBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.infoBg, borderBottomWidth: 1, borderBottomColor: Colors.infoBorder },
  abLabel: { fontSize: FontSize.xs, color: Colors.info, fontWeight: FontWeight.bold },
  abBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.infoBorder },
  abBtnActive: { backgroundColor: Colors.info, borderColor: Colors.info },
  abTxt: { fontSize: FontSize.xs, color: Colors.info, fontWeight: FontWeight.semibold },
  abTxtActive: { color: Colors.textInverse },

  list: { padding: Spacing.lg, paddingBottom: 100 },
  band: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.xs, alignSelf: 'flex-start', marginBottom: Spacing.sm },
  bandTxt: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  nom: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginBottom: 6 },
  meta: { fontSize: FontSize.base, color: Colors.textSecondary, marginBottom: 2 },
  metaDim: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 4, marginBottom: Spacing.md },

  ffeBtn: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  ffeTxt: { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  ffeNote: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 6, marginBottom: Spacing.lg },

  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  servicesCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.card },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  serviceIcon: { fontSize: 18 },
  serviceLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  countPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.successBg, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  countDot: { fontSize: 9 },
  countTxt: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.bold },
  soonTxt: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },
  chev: { fontSize: 22, color: Colors.textTertiary },

  coldStart: { backgroundColor: Colors.goldBg, borderWidth: 1, borderColor: Colors.goldBorder, borderRadius: Radius.md, padding: Spacing.lg, marginTop: Spacing.md },
  coldTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.gold, marginBottom: 4 },
  coldTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  followBtn: { backgroundColor: Colors.primaryLight, borderWidth: 1.5, borderColor: Colors.primaryBorder, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.lg },
  followBtnOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  followTxt: { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  followTxtOn: { color: Colors.textInverse },
  followNote: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 6 },

  demoBtn: { marginTop: Spacing.xl, backgroundColor: Colors.textPrimary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  demoTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
