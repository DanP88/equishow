// ─────────────────────────────────────────────────────────────────────────────
// v2/components/V2DateField — sélecteur de date unifié pour TOUTE la V2.
//
// Plus aucune saisie manuelle de date au clavier dans la V2 : tap → calendrier.
// S'appuie sur le composant EXISTANT `components/DatePickerModal` (RN pur,
// cross-platform Web + iOS, ZÉRO dépendance nouvelle).
//
// Contrat : la V2 stocke les dates en chaîne `'YYYY-MM-DD'` (ou '' si vide).
// Ce composant expose `value` / `onChange` dans ce même format → aucun autre
// fichier V2 n'a besoin de manipuler des objets Date.
//
//   <V2DateField  label value onChange [minDate] [maxDate] [optional] />
//   <V2DateRange  startLabel endLabel start end onChangeStart onChangeEnd
//                 [minDate] [maxDate] [endOptional] />   ← garantit fin ≥ début
//
// Réutilisable tel quel par les lots suivants (F7, F8…).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { DatePickerModal } from '../../components/DatePickerModal';

// ── helpers date ↔ 'YYYY-MM-DD' ────────────────────────────────────────────
export function ymdToDate(s?: string | null): Date | undefined {
  if (!s) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}
export function dateToYmd(d?: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** Libellé lisible « 12 sept. 2026 » (ou '' si vide/invalide). */
export function frDate(s?: string | null): string {
  const d = ymdToDate(s ?? undefined);
  return d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}
export function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function defaultMax(): Date {
  return new Date(new Date().getFullYear() + 3, 11, 31);
}
/** Plancher par défaut : ~30 ans en arrière — sinon la colonne « Année » du
 *  DatePickerModal se réduit à l'année courante quand seul `maxDate` est fourni. */
function defaultMin(): Date {
  return new Date(new Date().getFullYear() - 30, 0, 1);
}

// ── champ date simple ─────────────────────────────────────────────────────
export function V2DateField({
  label, value, onChange, placeholder = 'Choisir une date',
  minDate, maxDate, optional = false, style,
}: {
  label: string;
  value: string;
  onChange: (ymd: string) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  optional?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const filled = !!value;
  const shown = filled ? frDate(value) : placeholder;

  return (
    <View style={[s.field, style]}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity style={[s.trigger, filled && s.triggerFilled]} activeOpacity={0.8} onPress={() => setOpen(true)}>
        <Text style={s.icon}>📅</Text>
        <Text style={[s.value, !filled && s.placeholder]} numberOfLines={1}>{shown}</Text>
        {optional && filled ? (
          <TouchableOpacity hitSlop={10} onPress={() => onChange('')}><Text style={s.clear}>✕</Text></TouchableOpacity>
        ) : (
          <Text style={s.chev}>›</Text>
        )}
      </TouchableOpacity>

      <DatePickerModal
        visible={open}
        value={ymdToDate(value)}
        minDate={minDate ?? defaultMin()}
        maxDate={maxDate ?? defaultMax()}
        title={label}
        onConfirm={(d) => onChange(dateToYmd(d))}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

// ── période (début → fin), garantit fin ≥ début ───────────────────────────
export function V2DateRange({
  startLabel, endLabel, start, end, onChangeStart, onChangeEnd,
  minDate, maxDate, endOptional = false,
}: {
  startLabel: string;
  endLabel: string;
  start: string;
  end: string;
  onChangeStart: (ymd: string) => void;
  onChangeEnd: (ymd: string) => void;
  minDate?: Date;
  maxDate?: Date;
  endOptional?: boolean;
}) {
  const handleStart = (ymd: string) => {
    onChangeStart(ymd);
    // Fin devenue antérieure au nouveau début → on la recale sur le début.
    if (ymd && end && end < ymd) onChangeEnd(ymd);
  };
  const endFloor = ymdToDate(start) ?? minDate;

  return (
    <View style={s.row}>
      <V2DateField label={startLabel} value={start} onChange={handleStart} minDate={minDate} maxDate={maxDate} style={s.rowItem} />
      <V2DateField label={endLabel} value={end} onChange={onChangeEnd} minDate={endFloor} maxDate={maxDate} optional={endOptional} style={s.rowItem} />
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
  triggerFilled: { borderColor: Colors.primaryBorder, backgroundColor: Colors.primaryLight },
  icon: { fontSize: 15 },
  value: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  placeholder: { color: Colors.textTertiary, fontWeight: FontWeight.regular },
  chev: { fontSize: 16, color: Colors.textTertiary },
  clear: { fontSize: 13, color: Colors.textSecondary, fontWeight: FontWeight.bold, paddingHorizontal: 2 },

  row: { flexDirection: 'row', gap: Spacing.md },
  rowItem: { flex: 1 },
});
