// ─────────────────────────────────────────────────────────────────────────────
// v2/components/V2MultiSelectField — menu déroulant MULTI-sélection (F14.1).
//
// Champ cliquable → feuille de choix (RN Modal + ScrollView, cross-platform).
// Les valeurs choisies s'affichent en chips retirables sous le champ.
//
//   <V2MultiSelectField label options value onChange />
//
// `value` / `onChange` = string[] (ordre de sélection préservé).
// Réutilisable dans toute la V2.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';

export function V2MultiSelectField({
  label, options, value, onChange, placeholder = 'Choisir…', emptyNote,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  emptyNote?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);

  const shown = value.length === 0
    ? placeholder
    : value.length === 1
      ? value[0]
      : `${value.length} sélectionnées`;

  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity style={[s.trigger, value.length > 0 && s.triggerFilled]} activeOpacity={0.8} onPress={() => setOpen(true)}>
        <Text style={[s.value, value.length === 0 && s.placeholder]} numberOfLines={1}>{shown}</Text>
        <Text style={s.arrow}>▾</Text>
      </TouchableOpacity>

      {value.length > 0 && (
        <View style={s.chips}>
          {value.map((v) => (
            <TouchableOpacity key={v} style={s.chip} onPress={() => toggle(v)}>
              <Text style={s.chipTxt}>{v}  ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <Text style={s.sheetTitle}>{label}</Text>
            {emptyNote ? <Text style={s.emptyNote}>{emptyNote}</Text> : null}
            <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
              {options.length === 0 && <Text style={s.noOpt}>Aucune option disponible.</Text>}
              {options.map((o) => {
                const on = value.includes(o);
                return (
                  <TouchableOpacity key={o} style={[s.item, on && s.itemOn]} onPress={() => toggle(o)}>
                    <Text style={s.check}>{on ? '☑' : '☐'}</Text>
                    <Text style={[s.itemTxt, on && s.itemTxtOn]}>{o}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={s.done} onPress={() => setOpen(false)}>
              <Text style={s.doneTxt}>Valider{value.length ? ` (${value.length})` : ''}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  field: { gap: 4, marginTop: Spacing.sm },
  label: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 3, backgroundColor: Colors.surface },
  triggerFilled: { borderColor: BL.accentLine, backgroundColor: BL.accentSoft },
  value: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  placeholder: { color: Colors.textTertiary, fontWeight: FontWeight.regular },
  arrow: { fontSize: 12, color: Colors.textTertiary },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 4 },
  chip: { paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: 999, borderWidth: 1, borderColor: BL.accentLine, backgroundColor: BL.accentSoft },
  chipTxt: { fontSize: FontSize.sm, color: BL.accent, fontWeight: FontWeight.semibold },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: Colors.surface, borderRadius: 16, width: '100%', maxWidth: 380, maxHeight: '80%', padding: Spacing.lg },
  sheetTitle: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, textAlign: 'center', textTransform: 'capitalize' },
  emptyNote: { fontSize: FontSize.xs, color: Colors.warning, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
  list: { maxHeight: 360, marginTop: Spacing.sm },
  noOpt: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemOn: { backgroundColor: BL.accentSoft, borderRadius: 8 },
  check: { fontSize: 18, color: BL.accent },
  itemTxt: { fontSize: FontSize.base, color: Colors.textPrimary, flex: 1 },
  itemTxtOn: { color: BL.accent, fontWeight: FontWeight.bold },
  done: { backgroundColor: BL.accent, borderRadius: 12, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  doneTxt: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.sm },
});
