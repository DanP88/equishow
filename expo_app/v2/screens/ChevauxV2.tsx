// ─────────────────────────────────────────────────────────────────────────────
// ChevauxV2 — onglet 🐴. STRUCTURE IDENTIQUE pour tous, CONTENU adaptatif :
//   - « Chevaux que je coache »  → si capacité coach (mock F7, lecture seule)
//   - « Mes chevaux »            → réels (Supabase, LECTURE SEULE) + locaux V2
// Onglet jamais renommé, jamais masqué.
// F8 : la fiche cheval et l'ajout se font en V2 (`/(v2)/chevaux/*`) — les
// chevaux réels restent en lecture seule, les chevaux V2 (`v2c-…`) sont locaux.
// ─────────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, H1, Section, Card, Row, RowGroup, EmptyState, Placeholder } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { useV2AllHorses, horseSubtitle } from '../state/contestHorses';
import { MOCK_STUDENT_HORSES } from '../mocks/f2';

export function ChevauxV2() {
  const caps = useCapabilities();
  const pool = useV2AllHorses();

  const emptyBody = caps.has('cavalier')
    ? 'Nécessaire pour préparer un concours : indiquer quels chevaux tu emmènes, réserver box / transport / coaching.'
    : caps.has('coach')
      ? 'Ajoutez un cheval si vous montez aussi — utile pour préparer vos propres concours.'
      : 'Les chevaux servent à préparer un concours : box, transport, coaching pour votre cheval.';

  return (
    <Screen>
      <View style={s.head}><H1>Chevaux</H1>
        <TouchableOpacity onPress={() => router.push('/(v2)/chevaux/nouveau' as any)} hitSlop={8}><Text style={s.add}>＋</Text></TouchableOpacity>
      </View>

      <Section title="Mes chevaux">
        {pool.all.length === 0 ? (
          <EmptyState
            icon="🐴"
            title="Pas encore de cheval"
            body={emptyBody}
            ctaLabel="Ajouter un cheval"
            onCta={() => router.push('/(v2)/chevaux/nouveau' as any)}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {pool.all.map((h) => (
              <Card key={h.id} onPress={() => router.push(`/(v2)/chevaux/${h.id}` as any)}>
                <View style={s.cardRow}>
                  <View style={[s.dot, { backgroundColor: h.couleur || Colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{h.nom}{h.src === 'local' ? '  · local V2' : ''}</Text>
                    {!!horseSubtitle(h) && <Text style={s.sub}>{horseSubtitle(h)}</Text>}
                  </View>
                  <Text style={s.chev}>›</Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </Section>

      {pool.local.length > 0 && (
        <Placeholder note="les chevaux « local V2 » sont stockés sur cet appareil (v2:chevaux) — aucune donnée Supabase" />
      )}
      {pool.real.length > 0 && (
        <Placeholder note="fiche cheval réelle = LECTURE SEULE en V2 ; modification via l'app actuelle" v1Path="/(tabs)/chevaux" v1Label="chevaux (V1)" />
      )}

      {caps.has('coach') && (
        <Section title={`Chevaux que je coache · ${MOCK_STUDENT_HORSES.length}`}>
          <RowGroup>
            {MOCK_STUDENT_HORSES.map((h) => (
              <Row key={h.id} icon="🐴" label={`${h.horse} — ${h.rider}`} value={h.discipline} />
            ))}
          </RowGroup>
          <Placeholder note="chevaux des élèves = démonstration (F7) — gestion réelle en Phase 2" />
        </Section>
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
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 30, height: 30, borderRadius: 15 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  chev: { fontSize: 18, color: Colors.textTertiary },
  orgHint: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.md },
});
