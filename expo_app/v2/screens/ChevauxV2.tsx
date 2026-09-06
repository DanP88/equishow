// ─────────────────────────────────────────────────────────────────────────────
// ChevauxV2 — onglet 🐴. STRUCTURE IDENTIQUE pour tous, CONTENU adaptatif :
//   - « Chevaux que je coache »  → si capacité coach (utile même sans cheval)
//   - « Mes chevaux »            → toujours, avec empty state informatif
// Onglet jamais renommé, jamais masqué. (cf. reco §17 des wireframes)
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, H1, Section, Card, Row, RowGroup, EmptyState, Placeholder } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { useMyChevaux } from '../../hooks/useChevaux';
import { MOCK_STUDENT_HORSES } from '../mocks/f2';

export function ChevauxV2() {
  const caps = useCapabilities();
  const { chevaux } = useMyChevaux();

  const emptyBody = caps.has('cavalier')
    ? 'Nécessaire pour réserver un box, un transport ou un coaching pour ton cheval.'
    : caps.has('coach')
      ? 'Ajoutez un cheval si vous montez aussi — nécessaire pour réserver box / transport / coaching.'
      : 'Les chevaux servent à préparer un concours : réserver un box, un transport ou un coaching pour votre cheval.';

  return (
    <Screen>
      <View style={s.head}><H1>Chevaux</H1>
        <TouchableOpacity onPress={() => router.push('/(v2)/chevaux/nouveau' as any)} hitSlop={8}><Text style={s.add}>＋</Text></TouchableOpacity>
      </View>

      {/* Section COACH — chevaux des élèves */}
      {caps.has('coach') && (
        <Section title={`Chevaux que je coache · ${MOCK_STUDENT_HORSES.length}`}>
          <RowGroup>
            {MOCK_STUDENT_HORSES.map((h) => (
              <Row key={h.id} icon="🐴" label={`${h.horse} — ${h.rider}`} value={h.discipline} onPress={() => {}} />
            ))}
          </RowGroup>
          <Placeholder note="chevaux des élèves rebranchés en F7" />
        </Section>
      )}

      {/* Section MES CHEVAUX */}
      <Section title="Mes chevaux">
        {chevaux.length === 0 ? (
          <EmptyState
            icon="🐴"
            title="Pas encore de cheval"
            body={emptyBody}
            ctaLabel="Ajouter un cheval"
            onCta={() => router.push('/(v2)/chevaux/nouveau' as any)}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {chevaux.map((c) => (
              <Card key={c.id} onPress={() => router.push(`/cheval/${c.id}` as any)}>
                <Text style={s.name}>{c.nom}</Text>
                <Text style={s.sub}>{[c.race, c.anneeNaissance ? `${new Date().getFullYear() - c.anneeNaissance} ans` : null, c.disciplines?.[0]].filter(Boolean).join(' · ')}</Text>
              </Card>
            ))}
          </View>
        )}
      </Section>

      {chevaux.length > 0 && (
        <Placeholder note="fiche cheval recentrée (Sport · Concours · Logistique) = F8" v1Path="/(tabs)/chevaux" v1Label="chevaux actuels" />
      )}

      {caps.has('organisateur') && !caps.has('cavalier') && !caps.has('coach') && (
        <Text style={s.orgHint}>En tant qu’organisateur, retrouvez vos concours dans l’onglet 🏆 Concours.</Text>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  add: { fontSize: 24, color: Colors.primary, fontWeight: FontWeight.bold, paddingHorizontal: Spacing.sm },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  orgHint: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.md },
});
