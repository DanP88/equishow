// ─────────────────────────────────────────────────────────────────────────────
// CommunauteV2 — fil PUBLIC général. PAS dans la bottom bar : atteint depuis
// l'aperçu Accueil (« Voir toute la communauté »).
// Fils selon capacités (Cavaliers / Coachs / Organisateurs) — jamais masqué
// par un « mode ». Séparation : Communauté (public) ≠ Discussion concours
// (contextuelle) ≠ Messagerie (privée).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Segment, Card, Placeholder } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { MOCK_COMMUNITY } from '../mocks/f2';

export function CommunauteV2() {
  const caps = useCapabilities();
  const fils = [
    { key: 'cavaliers', label: 'Cavaliers' },
    ...(caps.has('coach') ? [{ key: 'coachs', label: 'Coachs' }] : []),
    ...(caps.has('organisateur') ? [{ key: 'organisateurs', label: 'Organisateurs' }] : []),
  ];
  const [fil, setFil] = useState(fils[0].key);

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <View style={s.head}>
        <Text style={s.h1}>Communauté</Text>
        <Text style={s.publier}>＋ Publier</Text>
      </View>

      {fils.length > 1 && <Segment options={fils} value={fil} onChange={setFil} />}

      {MOCK_COMMUNITY.map((p) => (
        <Card key={p.id}>
          <Text style={s.author}>{p.author} · <Text style={s.when}>{p.when}</Text></Text>
          <Text style={s.text}>{p.text}</Text>
          <Text style={s.actions}>♥ 4   💬 2</Text>
        </Card>
      ))}

      <View style={s.sepNote}>
        <Text style={s.sepTitle}>Où poster quoi ?</Text>
        <Text style={s.sepLine}>• <Text style={s.b}>Communauté</Text> = questions générales, entraide, infos pratiques.</Text>
        <Text style={s.sepLine}>• <Text style={s.b}>Discussion du concours</Text> = échanges autour d’un concours précis (dans sa fiche).</Text>
        <Text style={s.sepLine}>• <Text style={s.b}>Messagerie</Text> = conversations privées 1:1.</Text>
      </View>

      <Placeholder note="Communauté réelle = useCommunautePosts (V1, 3 fils par rôle, photos mig 108). Ici : aperçu simulé. Wrap V2 (fils selon capacités, pas selon un mode) = LOT F10." v1Path="/(tabs)/communaute" v1Label="Communauté V1" />
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h1: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  publier: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  author: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  when: { fontWeight: FontWeight.regular, color: Colors.textTertiary },
  text: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  actions: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  sepNote: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, gap: 4, marginTop: Spacing.md },
  sepTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  sepLine: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  b: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
});
