// ─────────────────────────────────────────────────────────────────────────────
// AgendaV2 — onglet 📅. UN SEUL agenda par personne.
//   Filtres VISUELS : Tous · Cavalier · Coach · Organisation
//   (les chips ne changent NI l'identité NI les droits — juste l'affichage)
//   Un chip n'apparaît que si la capacité correspondante est détenue.
//
// F2 : timeline structurée depuis un mock. Le moteur d'agrégation réel
// (réservations + coachings animés + dates concours, déjà unifié dans
// cavalier-agenda.tsx V1) est rebranché en F3.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, H1, Chip, Card, Placeholder } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { MOCK_AGENDA } from '../mocks/f2';

export function AgendaV2() {
  const caps = useCapabilities();
  const [filter, setFilter] = useState<'tous' | 'cavalier' | 'coach' | 'organisateur'>('tous');

  const chips = [
    { key: 'tous', label: 'Tous' },
    ...(caps.has('cavalier') ? [{ key: 'cavalier', label: 'Cavalier' }] : []),
    ...(caps.has('coach') ? [{ key: 'coach', label: 'Coach' }] : []),
    ...(caps.has('organisateur') ? [{ key: 'organisateur', label: 'Organisation' }] : []),
  ];
  const showChips = chips.length > 2; // 1 seule capacité → pas de filtre

  const events = useMemo(() => {
    return MOCK_AGENDA.filter((e) => {
      if (filter === 'tous') return e.cap === 'concours' || caps.has(e.cap as any);
      return e.cap === filter;
    });
  }, [filter, caps]);

  const byDay = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) { const arr = map.get(e.day) ?? []; arr.push(e); map.set(e.day, arr); }
    return [...map.entries()];
  }, [events]);

  const capBadge = (c: string) => c === 'cavalier' ? 'CAV' : c === 'coach' ? 'COA' : c === 'organisateur' ? 'ORG' : '';

  return (
    <Screen>
      <H1>Agenda</H1>
      {showChips && (
        <View style={s.chips}>
          {chips.map((c) => <Chip key={c.key} label={c.label} on={filter === c.key} onPress={() => setFilter(c.key as any)} />)}
        </View>
      )}

      {byDay.length === 0 && <Text style={s.empty}>Rien de prévu pour ce filtre.</Text>}

      {byDay.map(([day, evs]) => (
        <View key={day} style={s.day}>
          <Text style={s.dayTitle}>{day.toUpperCase()}</Text>
          {evs.map((e) => (
            <View key={e.id} style={s.event}>
              <Text style={s.time}>{e.time}</Text>
              <Text style={s.eIcon}>{e.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.eLabel}>{e.label}</Text>
                {e.concours && <Text style={s.eSub}>🏆 {e.concours}</Text>}
              </View>
              {capBadge(e.cap) ? <View style={s.tag}><Text style={s.tagTxt}>{capBadge(e.cap)}</Text></View> : null}
            </View>
          ))}
        </View>
      ))}

      <Card>
        <Text style={s.wait}>⚠ EN ATTENTE</Text>
        <Text style={s.waitLine}>Paiement transport La Baule — à régler</Text>
      </Card>

      <Placeholder note="Timeline = mock F2. Moteur réel (cavalier-agenda.tsx V1, déjà agrégé par user id : réservations + coachings animés + dates concours) rebranché en F3, avec les chips de filtre par-dessus." v1Path="/(tabs)/cavalier-agenda" v1Label="Ouvrir l’agenda (V1)" />
    </Screen>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  empty: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  day: { gap: Spacing.xs, marginTop: Spacing.md },
  dayTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.textTertiary, letterSpacing: 0.6 },
  event: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm + 2 },
  time: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, width: 52 },
  eIcon: { fontSize: 15 },
  eLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  eSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  tag: { backgroundColor: Colors.surfaceVariant, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  tagTxt: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.textTertiary },
  wait: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.urgent },
  waitLine: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
});
