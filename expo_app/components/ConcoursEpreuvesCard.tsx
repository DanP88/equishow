// ─────────────────────────────────────────────────────────────────────────────
// ConcoursEpreuvesCard — affiche les épreuves DÉJÀ importées (concours.liste_epreuves).
// Read-only sur la donnée existante : aucun appel FFE, aucun scraping, aucune invention.
// Si > 10 épreuves : aperçu de 10 + bouton « Voir les N épreuves ▼ » (expand/collapse).
// Analytics : clic « Voir toutes » → cta_click action 'concours_epreuves_open'
// (event_type 'concours_epreuves_open' impossible : CHECK user_events.event_type ;
//  on respecte la convention existante click_ffe → action nommée, 0 migration).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { parseEpreuves, formatEpreuve } from '../lib/epreuves';
import { trackCta } from '../lib/analytics';

const PREVIEW_COUNT = 10;

interface Props {
  concoursId?: string;
  listeEpreuves?: string[] | null;
}

export function ConcoursEpreuvesCard({ concoursId, listeEpreuves }: Props) {
  const epreuves = useMemo(() => parseEpreuves(listeEpreuves), [listeEpreuves]);
  const [expanded, setExpanded] = useState(false);

  // Rien d'importé → on n'affiche pas la section (pas de bruit, pas d'invention).
  if (epreuves.length === 0) return null;

  const total = epreuves.length;
  const collapsible = total > PREVIEW_COUNT;
  const shown = expanded || !collapsible ? epreuves : epreuves.slice(0, PREVIEW_COUNT);

  const onToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      trackCta('concours-fiche', 'concours_epreuves_open', { concours_id: concoursId, epreuves_count: total });
    }
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>🏆 Épreuves du concours ({total})</Text>
      {shown.map((e, i) => (
        <View key={`${i}-${e}`} style={[s.row, i === shown.length - 1 && s.rowLast]}>
          <Text style={s.dot}>•</Text>
          <Text style={s.label}>{formatEpreuve(e)}</Text>
        </View>
      ))}
      {collapsible && (
        <TouchableOpacity style={s.more} activeOpacity={0.8} onPress={onToggle}>
          <Text style={s.moreTxt}>
            {expanded ? 'Réduire ▲' : `Voir les ${total} épreuves ▼`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginTop: Spacing.md, ...Shadow.card },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLast: { borderBottomWidth: 0 },
  dot: { fontSize: FontSize.base, color: Colors.primary, lineHeight: 20 },
  label: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  more: { marginTop: Spacing.sm, paddingVertical: Spacing.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border },
  moreTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
});
