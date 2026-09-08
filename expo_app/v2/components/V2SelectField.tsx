// ─────────────────────────────────────────────────────────────────────────────
// v2/components/V2SelectField — sélecteur à choix (liste) réutilisable V2.
//
// Remplace les `<TextInput>` là où une valeur doit venir d'une liste fermée
// (race, robe, année, taille…). Cross-platform : RN Modal + ScrollView, aucun
// élément HTML spécifique au Web, pas de clavier (sauf option « Autre »).
//
//   tap sur le champ → feuille de choix → sélection → fermeture + valeur affichée
//
// `allowOther` : ajoute une ligne « Autre (préciser…) » → mini-saisie libre
// dans la feuille ; la valeur libre est stockée telle quelle dans `value`.
//
// Réutilisable partout dans la V2 (F9+).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { BL } from '../ui/blush';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';

export type V2SelectOption = string | { value: string; label: string };

function norm(o: V2SelectOption): { value: string; label: string } {
  return typeof o === 'string' ? { value: o, label: o } : o;
}

export function V2SelectField({
  label, value, onChange, options, placeholder = 'Choisir…',
  clearable = true, allowOther = false, otherLabel = 'Autre (préciser…)', style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: V2SelectOption[];
  placeholder?: string;
  clearable?: boolean;
  allowOther?: boolean;
  otherLabel?: string;
  style?: any;
}) {
  const [open, setOpen] = useState(false);
  const [otherMode, setOtherMode] = useState(false);
  const [otherText, setOtherText] = useState('');

  const opts = options.map(norm);
  const filled = !!value;
  const known = opts.find((o) => o.value === value);
  const shown = filled ? (known?.label ?? value) : placeholder;

  const close = () => { setOpen(false); setOtherMode(false); setOtherText(''); };
  const pick = (v: string) => { onChange(v); close(); };
  const openSheet = () => {
    setOtherMode(allowOther && filled && !known);
    setOtherText(allowOther && filled && !known ? value : '');
    setOpen(true);
  };

  return (
    <View style={[s.field, style]}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity style={[s.trigger, filled && s.triggerFilled]} activeOpacity={0.8} onPress={openSheet}>
        <Text style={[s.value, !filled && s.placeholder]} numberOfLines={1}>{shown}</Text>
        <Text style={s.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={close}>
          <TouchableOpacity activeOpacity={1} style={s.sheet}>
            <Text style={s.sheetTitle}>{label}</Text>

            {otherMode ? (
              <View style={s.otherBox}>
                <TextInput
                  style={s.otherInput}
                  value={otherText}
                  onChangeText={setOtherText}
                  placeholder="Saisir la valeur"
                  placeholderTextColor={Colors.textTertiary}
                  autoFocus
                />
                <View style={s.otherBtns}>
                  <TouchableOpacity onPress={() => setOtherMode(false)}><Text style={s.otherCancel}>Retour à la liste</Text></TouchableOpacity>
                  <TouchableOpacity
                    style={[s.otherOk, !otherText.trim() && s.otherOkOff]}
                    disabled={!otherText.trim()}
                    onPress={() => pick(otherText.trim())}
                  >
                    <Text style={s.otherOkTxt}>Valider</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
                {clearable && filled && (
                  <TouchableOpacity style={s.item} onPress={() => pick('')}>
                    <Text style={[s.itemText, s.clearText]}>— Effacer</Text>
                  </TouchableOpacity>
                )}
                {opts.map((o) => (
                  <TouchableOpacity key={o.value} style={[s.item, value === o.value && s.itemActive]} onPress={() => pick(o.value)}>
                    <Text style={[s.itemText, value === o.value && s.itemTextActive]}>{o.label}</Text>
                    {value === o.value && <Text style={s.check}>✓</Text>}
                  </TouchableOpacity>
                ))}
                {allowOther && (
                  <TouchableOpacity style={s.item} onPress={() => { setOtherMode(true); setOtherText(known ? '' : value); }}>
                    <Text style={[s.itemText, !known && filled && s.itemTextActive]}>✏️  {otherLabel}</Text>
                    {!known && filled && <Text style={s.check}>✓</Text>}
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  field: { gap: 4, marginTop: Spacing.sm },
  label: { fontSize: 11, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 3,
    backgroundColor: Colors.surface,
  },
  triggerFilled: { borderColor: BL.accentLine, backgroundColor: BL.accentSoft },
  value: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  placeholder: { color: Colors.textTertiary, fontWeight: FontWeight.regular },
  arrow: { fontSize: 12, color: Colors.textTertiary },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: Colors.surface, borderRadius: 16, width: '100%', maxWidth: 380, maxHeight: '80%', padding: Spacing.lg },
  sheetTitle: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center', textTransform: 'capitalize' },
  list: { maxHeight: 380 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemActive: { backgroundColor: BL.accentSoft, borderRadius: 8 },
  itemText: { fontSize: FontSize.base, color: Colors.textPrimary },
  itemTextActive: { color: BL.accent, fontWeight: FontWeight.bold },
  clearText: { color: Colors.textTertiary, fontStyle: 'italic' },
  check: { fontSize: FontSize.base, color: BL.accent, fontWeight: FontWeight.bold },

  otherBox: { gap: Spacing.md, paddingTop: Spacing.sm },
  otherInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 3, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  otherBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  otherCancel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  otherOk: { backgroundColor: BL.accent, borderRadius: 10, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2 },
  otherOkOff: { backgroundColor: '#E7E5E1' },
  otherOkTxt: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.sm },
});
