// ─────────────────────────────────────────────────────────────────────────────
// ChevalPicker — cellule « Cheval concerné » réutilisable (réservations V1).
// Optionnel : option « Aucun cheval sélectionné » toujours dispo, ne bloque jamais.
// Préremplit automatiquement si l'utilisateur n'a qu'un seul cheval.
// onChange(chevalId|null, chevalNom|null) — le nom sert au pré-remplissage coach.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { useMyChevaux } from '../hooks/useChevaux';

interface Props {
  value: string | null;
  onChange: (chevalId: string | null, chevalNom: string | null) => void;
  label?: string;
}

export function ChevalPicker({ value, onChange, label = 'Cheval concerné' }: Props) {
  const { chevaux: list, isLoading } = useMyChevaux();
  const [open, setOpen] = useState(false);
  const prefilled = useRef(false);

  // Préremplissage : exactement 1 cheval + aucune sélection encore faite.
  useEffect(() => {
    if (prefilled.current) return;
    if (!isLoading && value == null && list.length === 1) {
      prefilled.current = true;
      onChange(list[0].id, list[0].nom);
    }
  }, [isLoading, list, value, onChange]);

  const selected = list.find((c) => c.id === value) ?? null;
  const selectedLabel = selected ? `🐴 ${selected.nom}` : 'Aucun cheval sélectionné';

  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label} <Text style={s.opt}>(optionnel)</Text></Text>

      <TouchableOpacity style={s.cell} activeOpacity={0.8} onPress={() => setOpen((o) => !o)}>
        <Text style={[s.cellTxt, !selected && s.cellTxtMuted]} numberOfLines={1}>{selectedLabel}</Text>
        <Text style={s.chev}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={s.menu}>
          <TouchableOpacity
            style={s.item}
            activeOpacity={0.8}
            onPress={() => { onChange(null, null); setOpen(false); }}
          >
            <Text style={[s.itemTxt, s.cellTxtMuted]}>Aucun cheval sélectionné</Text>
            {value == null && <Text style={s.check}>✓</Text>}
          </TouchableOpacity>

          {isLoading ? (
            <Text style={s.empty}>Chargement…</Text>
          ) : list.length === 0 ? (
            <Text style={s.empty}>Aucun cheval enregistré.</Text>
          ) : (
            list.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={s.item}
                activeOpacity={0.8}
                onPress={() => { onChange(c.id, c.nom); setOpen(false); }}
              >
                <Text style={s.itemTxt} numberOfLines={1}>🐴 {c.nom}</Text>
                {value === c.id && <Text style={s.check}>✓</Text>}
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginVertical: Spacing.sm },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: 6 },
  opt: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.regular },
  cell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  cellTxt: { fontSize: FontSize.base, color: Colors.textPrimary, flex: 1 },
  cellTxtMuted: { color: Colors.textTertiary },
  chev: { fontSize: FontSize.xs, color: Colors.textSecondary, marginLeft: Spacing.sm },
  menu: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMedium, borderTopWidth: 0, borderBottomLeftRadius: Radius.md, borderBottomRightRadius: Radius.md, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  itemTxt: { fontSize: FontSize.base, color: Colors.textPrimary, flex: 1 },
  check: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.bold, marginLeft: Spacing.sm },
  empty: { fontSize: FontSize.sm, color: Colors.textTertiary, padding: Spacing.md, fontStyle: 'italic' },
});
