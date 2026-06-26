// ─────────────────────────────────────────────────────────────────────────────
// ConcoursCategoriesCard — affiche les catégories FFE d'un concours (table 084
// concours_categories). Read-only sur la donnée importée : aucune invention.
// Section masquée si aucune catégorie (table 084 non appliquée OU concours sans
// catégorie importée) → pas de bruit visuel.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { useConcoursCategories } from '../hooks/useConcours';
import { trackCta } from '../lib/analytics';

const PREVIEW_COUNT = 6;

interface Props {
  concoursId?: string;
}

export function ConcoursCategoriesCard({ concoursId }: Props) {
  const { categories } = useConcoursCategories(concoursId);
  const [expanded, setExpanded] = useState(false);

  if (categories.length === 0) return null;

  const total = categories.length;
  const collapsible = total > PREVIEW_COUNT;
  const shown = expanded || !collapsible ? categories : categories.slice(0, PREVIEW_COUNT);

  const onToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      trackCta('concours-fiche', 'concours_categories_open', { concours_id: concoursId, categories_count: total });
    }
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>🏷 Catégories ({total})</Text>
      <View style={s.chipsWrap}>
        {shown.map((c, i) => (
          <View key={`${i}-${c}`} style={s.chip}>
            <Text style={s.chipTxt}>{c}</Text>
          </View>
        ))}
      </View>
      {collapsible && (
        <TouchableOpacity style={s.more} activeOpacity={0.8} onPress={onToggle}>
          <Text style={s.moreTxt}>
            {expanded ? 'Réduire ▲' : `Voir les ${total} catégories ▼`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginTop: Spacing.md, ...Shadow.card },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  chipTxt: { fontSize: FontSize.sm, color: Colors.textSecondary },
  more: { marginTop: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border },
  moreTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary },
});
