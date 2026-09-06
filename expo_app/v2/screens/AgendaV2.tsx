// ─────────────────────────────────────────────────────────────────────────────
// AgendaV2 — onglet 📅. UN SEUL agenda par personne (F3 : données réelles).
//   Filtres VISUELS : Tous · Cavalier · Coach · Organisation
//   (les chips ne changent NI l'identité NI les droits — juste l'affichage)
//   Un chip n'apparaît que si la capacité correspondante est détenue.
//
// Source : v2/adapters/agenda (hooks V1 agrégés par user id, LECTURE SEULE) —
// repli sur un jeu de démo si aucune donnée réelle (non connecté / compte vide).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, H1, Chip, Card, Placeholder } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { useV2Agenda } from '../adapters/agenda';

export function AgendaV2() {
  const caps = useCapabilities();
  const { days, demo } = useV2Agenda();
  const [filter, setFilter] = useState<'tous' | 'cavalier' | 'coach' | 'organisateur'>('tous');

  const chips = [
    { key: 'tous', label: 'Tous' },
    ...(caps.has('cavalier') ? [{ key: 'cavalier', label: 'Cavalier' }] : []),
    ...(caps.has('coach') ? [{ key: 'coach', label: 'Coach' }] : []),
    ...(caps.has('organisateur') ? [{ key: 'organisateur', label: 'Organisation' }] : []),
  ];
  const showChips = chips.length > 2;

  const shownDays = useMemo(() => {
    return days
      .map((d) => ({
        ...d,
        events: d.events.filter((e) => {
          if (filter === 'tous') return e.cap === 'concours' || caps.has(e.cap as any);
          if (filter === 'organisateur') return e.cap === 'organisateur';
          if (filter === 'cavalier') return e.cap === 'cavalier' || e.cap === 'concours';
          return e.cap === filter; // coach
        }),
      }))
      .filter((d) => d.events.length > 0);
  }, [days, filter, caps]);

  const badge = (c: string) => (c === 'cavalier' ? 'CAV' : c === 'coach' ? 'COA' : c === 'organisateur' ? 'ORG' : c === 'concours' ? 'CONCOURS' : '');

  return (
    <Screen>
      <H1>Agenda</H1>
      {showChips && (
        <View style={s.chips}>
          {chips.map((c) => <Chip key={c.key} label={c.label} on={filter === c.key} onPress={() => setFilter(c.key as any)} />)}
        </View>
      )}

      {shownDays.length === 0 && (
        <Text style={s.empty}>Rien de prévu {filter !== 'tous' ? 'pour ce filtre' : 'pour le moment'}.</Text>
      )}

      {shownDays.map((d) => (
        <View key={d.key} style={s.day}>
          <Text style={s.dayTitle}>{d.label.toUpperCase()}</Text>
          <Card pad={false}>
            {d.events.map((e, i) => (
              <View key={e.id} style={[s.event, i > 0 && s.eventDiv]}>
                <Text style={s.time}>{e.time}</Text>
                <Text style={s.eIcon}>{e.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.eLabel} numberOfLines={1}>{e.label}</Text>
                  {e.sub ? <Text style={s.eSub} numberOfLines={1}>{e.sub}</Text> : null}
                </View>
                {badge(e.cap) ? <View style={s.tag}><Text style={s.tagTxt}>{badge(e.cap)}</Text></View> : null}
              </View>
            ))}
          </Card>
        </View>
      ))}

      {demo
        ? <Placeholder note="agenda de démonstration — connecte-toi pour voir tes vraies réservations & séances" v1Path="/(tabs)/cavalier-agenda" v1Label="agenda actuel" />
        : <Placeholder note="réservations · coachings · dates de concours agrégés en lecture seule" />}
    </Screen>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  empty: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', marginTop: Spacing.md },
  day: { gap: Spacing.xs, marginTop: Spacing.lg },
  dayTitle: { fontSize: 11, fontWeight: FontWeight.extrabold, color: Colors.textTertiary, letterSpacing: 0.8 },
  event: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  eventDiv: { borderTopWidth: 1, borderTopColor: '#ECEBE7' },
  time: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, width: 54 },
  eIcon: { fontSize: 15 },
  eLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  eSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  tag: { backgroundColor: Colors.surfaceVariant, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  tagTxt: { fontSize: 9, fontWeight: FontWeight.extrabold, color: Colors.textTertiary, letterSpacing: 0.3 },
});
