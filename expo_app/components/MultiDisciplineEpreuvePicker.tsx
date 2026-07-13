import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import {
  EPREUVES_PAR_DISCIPLINE,
  DISCIPLINES_EPREUVES,
  disciplineOfEpreuve,
} from '../lib/epreuves';

interface Props {
  selected: string[];
  onChange: (s: string[]) => void;
}

/**
 * Sélecteur d'épreuves multidisciplinaire pour le formulaire concours.
 *
 * - Onglets horizontaux par discipline (badge = nombre d'épreuves déjà choisies).
 * - Chips épreuves de l'onglet actif (toggle sans doublon).
 * - Récapitulatif de toutes les épreuves sélectionnées avec tag × supprimable.
 * - Labels "inconnus" (FFE importés, anciens labels hors catalogue) : préservés
 *   dans `selected`, visibles dans le récapitulatif, non affichés dans les onglets.
 * - Changer d'onglet ou de discipline principale (externe) n'efface jamais `selected`.
 */
export function MultiDisciplineEpreuvePicker({ selected, onChange }: Props) {
  const [activeDisc, setActiveDisc] = useState<string>(DISCIPLINES_EPREUVES[0]);

  function toggle(label: string) {
    if (selected.includes(label)) {
      onChange(selected.filter(x => x !== label));
    } else {
      onChange([...selected, label]);
    }
  }

  function remove(label: string) {
    onChange(selected.filter(x => x !== label));
  }

  const activeEpreuves = EPREUVES_PAR_DISCIPLINE[activeDisc] ?? [];

  // Labels hors catalogue (FFE, anciens) : préservés mais sans onglet dédié.
  const unknownSelected = selected.filter(ep => disciplineOfEpreuve(ep) === null);

  return (
    <View>
      {/* ── Onglets discipline ─────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsScroll}
        contentContainerStyle={s.tabsContent}
      >
        {DISCIPLINES_EPREUVES.map((disc) => {
          const count = (EPREUVES_PAR_DISCIPLINE[disc] as readonly string[])
            .filter(ep => selected.includes(ep)).length;
          const active = disc === activeDisc;
          return (
            <TouchableOpacity
              key={disc}
              style={[s.tab, active && s.tabActive]}
              onPress={() => setActiveDisc(disc)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabTxt, active && s.tabTxtActive]}>
                {disc}{count > 0 ? ` (${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Chips épreuves de l'onglet actif ──────────────────────────── */}
      <View style={s.chipsWrap}>
        {(activeEpreuves as readonly string[]).map((ep) => {
          const checked = selected.includes(ep);
          return (
            <TouchableOpacity
              key={ep}
              style={[s.chip, checked && s.chipActive]}
              onPress={() => toggle(ep)}
              activeOpacity={0.8}
            >
              <Text style={[s.chipTxt, checked && s.chipTxtActive]}>{ep}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Récapitulatif ─────────────────────────────────────────────── */}
      {selected.length > 0 && (
        <View style={s.recap}>
          <Text style={s.recapLabel}>
            {selected.length} épreuve{selected.length > 1 ? 's' : ''} sélectionnée{selected.length > 1 ? 's' : ''}
          </Text>
          <View style={s.recapTags}>
            {selected.map((ep) => (
              <TouchableOpacity
                key={ep}
                style={s.recapTag}
                onPress={() => remove(ep)}
                activeOpacity={0.8}
              >
                <Text style={s.recapTagTxt} numberOfLines={1}>{ep}</Text>
                <Text style={s.recapTagX}>×</Text>
              </TouchableOpacity>
            ))}
            {unknownSelected.length > 0 && (
              <Text style={s.recapHint}>
                {unknownSelected.length} épreuve{unknownSelected.length > 1 ? 's' : ''} importée{unknownSelected.length > 1 ? 's' : ''} préservée{unknownSelected.length > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  tabsScroll: { marginBottom: Spacing.sm },
  tabsContent: { gap: Spacing.xs, paddingBottom: 2 },
  tab: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabTxt: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  tabTxtActive: {
    color: Colors.textInverse,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipTxt: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  chipTxtActive: {
    color: Colors.textInverse,
  },
  recap: {
    backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  recapLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recapTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  recapTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    gap: 4,
    maxWidth: 200,
  },
  recapTagTxt: {
    fontSize: FontSize.xs,
    color: Colors.textInverse,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  recapTagX: {
    fontSize: FontSize.sm,
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    lineHeight: 16,
  },
  recapHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    alignSelf: 'center',
  },
});
