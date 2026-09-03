import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

export function DatePickerModal({ visible, value, onConfirm, onClose, title = 'Sélectionner une date', minDate, maxDate }: {
  visible: boolean;
  value?: Date;
  onConfirm: (date: Date) => void;
  onClose: () => void;
  title?: string;
  minDate?: Date;
  maxDate?: Date;
}) {
  // Helper : début de jour (sans heure) pour comparer date à date
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const inRange = (d: Date): boolean => {
    const t = startOfDay(d).getTime();
    if (minDate && t < startOfDay(minDate).getTime()) return false;
    if (maxDate && t > startOfDay(maxDate).getTime()) return false;
    return true;
  };

  // Robuste : `value` peut arriver en string/number (dates issues du JSON
  // Supabase). On coerce en `Date` valide, sinon on l'ignore — sans quoi
  // `initRaw.getDate()` plus bas lève « undefined is not a function ».
  const safeValue: Date | undefined = (() => {
    if (value == null) return undefined;
    const d = value instanceof Date ? value : new Date(value as unknown as string);
    return Number.isNaN(d.getTime()) ? undefined : d;
  })();

  // Init : si value fournie et dans la plage, l'utiliser. Sinon clamp à minDate (ou today).
  const initRaw = safeValue ?? minDate ?? new Date();
  const init = inRange(initRaw) ? initRaw : (minDate ?? initRaw);
  const [day, setDay] = useState(init.getDate());
  const [month, setMonth] = useState(init.getMonth() + 1);
  const [year, setYear] = useState(init.getFullYear());

  const maxDay = daysInMonth(month, year);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  // Si minDate/maxDate sont fournis, restreindre la plage d'années aux années dans la plage.
  // Sinon, comportement historique (20 années glissantes vers le passé).
  const years = (minDate || maxDate)
    ? (() => {
        const minY = minDate ? minDate.getFullYear() : new Date().getFullYear();
        const maxY = maxDate ? maxDate.getFullYear() : new Date().getFullYear() + 5;
        return Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i);
      })()
    : Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i);

  // Désactivation visuelle des items hors plage
  const isDayDisabled = (d: number) => !inRange(new Date(year, month - 1, d));
  const isMonthDisabled = (m: number) => {
    // Un mois est désactivé si TOUS ses jours sont hors plage, c'est-à-dire
    // soit le mois entier est avant minDate, soit entièrement après maxDate.
    const last = daysInMonth(m, year);
    const firstDay = new Date(year, m - 1, 1);
    const lastDay = new Date(year, m - 1, last);
    const beforeMin = !!minDate && lastDay.getTime() < startOfDay(minDate).getTime();
    const afterMax = !!maxDate && firstDay.getTime() > startOfDay(maxDate).getTime();
    return beforeMin || afterMax;
  };

  function confirm() {
    let d = day > maxDay ? maxDay : day;
    let candidate = new Date(year, month - 1, d);
    // Clamp final : si hors plage, ramener à la borne la plus proche.
    if (minDate && candidate < startOfDay(minDate)) candidate = startOfDay(minDate);
    if (maxDate && candidate > startOfDay(maxDate)) candidate = startOfDay(maxDate);
    onConfirm(candidate);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.card}>
          <Text style={s.title}>{title}</Text>

          <View style={s.columns}>
            {/* Jour */}
            <View style={s.col}>
              <Text style={s.colLabel}>Jour</Text>
              <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
                {days.map((d) => {
                  const disabled = isDayDisabled(d);
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[s.item, day === d && s.itemActive, disabled && s.itemDisabled]}
                      onPress={() => { if (!disabled) setDay(d); }}
                      disabled={disabled}
                    >
                      <Text style={[s.itemText, day === d && s.itemTextActive, disabled && s.itemTextDisabled]}>
                        {String(d).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Mois */}
            <View style={[s.col, { flex: 2 }]}>
              <Text style={s.colLabel}>Mois</Text>
              <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
                {MOIS.map((m, i) => {
                  const disabled = isMonthDisabled(i + 1);
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[s.item, month === i + 1 && s.itemActive, disabled && s.itemDisabled]}
                      onPress={() => { if (!disabled) setMonth(i + 1); }}
                      disabled={disabled}
                    >
                      <Text style={[s.itemText, month === i + 1 && s.itemTextActive, disabled && s.itemTextDisabled]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Année */}
            <View style={s.col}>
              <Text style={s.colLabel}>Année</Text>
              <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
                {years.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[s.item, year === y && s.itemActive]}
                    onPress={() => setYear(y)}
                  >
                    <Text style={[s.itemText, year === y && s.itemTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={confirm}>
              <Text style={s.confirmText}>Valider</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function formatDate(d?: Date | string | number | null): string {
  if (!d) return '';
  // Robuste : les dates issues du JSON Supabase arrivent en string, pas en Date.
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function DateButton({ label, value, onPress }: {
  label: string;
  value?: Date;
  onPress: () => void;
}) {
  const filled = !!value;
  return (
    <TouchableOpacity
      style={[db.trigger, filled && db.triggerFilled]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={db.icon}>📅</Text>
      <Text style={[db.text, !filled && db.placeholder]}>
        {filled ? formatDate(value) : label}
      </Text>
      {filled && <Text style={db.filled}>✓</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, width: '100%', maxWidth: 360, padding: Spacing.xl, ...Shadow.modal },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.lg, textAlign: 'center' },
  columns: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  col: { flex: 1 },
  colLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs, textAlign: 'center' },
  scroll: { maxHeight: 200, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  item: { paddingVertical: Spacing.sm, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemActive: { backgroundColor: Colors.primaryLight },
  itemDisabled: { backgroundColor: Colors.surfaceVariant, opacity: 0.5 },
  itemText: { fontSize: FontSize.base, color: Colors.textPrimary },
  itemTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  itemTextDisabled: { color: Colors.textTertiary, textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  confirmBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  confirmText: { color: Colors.textInverse, fontWeight: FontWeight.bold },
});

const db = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, backgroundColor: Colors.surface },
  triggerFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  icon: { fontSize: 16 },
  text: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  placeholder: { color: Colors.textTertiary, fontWeight: FontWeight.regular },
  filled: { color: Colors.primary, fontWeight: FontWeight.bold },
});

// Multi-Date Picker for selecting multiple dates (for availability)
export function MultiDatePickerModal({ visible, selectedDates, availableDates, onConfirm, onClose, title = 'Sélectionner les dates disponibles' }: {
  visible: boolean;
  selectedDates: Date[];
  availableDates?: Date[]; // Dates disponibles pour la location
  onConfirm: (dates: Date[]) => void;
  onClose: () => void;
  title?: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [selected, setSelected] = useState<Set<string>>(
    new Set(selectedDates.map(d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`))
  );

  // Créer un set des dates disponibles pour vérification rapide
  const availableSet = new Set((availableDates || []).map(d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`));

  const maxDay = daysInMonth(month, year);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() + i);

  function toggleDay(day: number) {
    const key = `${year}-${month - 1}-${day}`;

    // Vérifier si la date est disponible (si availableDates est fourni)
    if (availableSet.size > 0 && !availableSet.has(key)) {
      return; // Ne pas permettre la sélection de dates non disponibles
    }

    const newSelected = new Set(selected);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelected(newSelected);
  }

  function confirm() {
    const dates = Array.from(selected).map(key => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m, d);
    });
    onConfirm(dates);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={md.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={md.card}>
          <Text style={md.title}>{title}</Text>

          <View style={md.monthSelector}>
            <View style={md.monthCol}>
              <Text style={md.colLabel}>Mois</Text>
              <ScrollView style={md.scroll} showsVerticalScrollIndicator={false}>
                {MOIS.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={[md.item, month === i + 1 && md.itemActive]}
                    onPress={() => setMonth(i + 1)}
                  >
                    <Text style={[md.itemText, month === i + 1 && md.itemTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={md.yearCol}>
              <Text style={md.colLabel}>Année</Text>
              <ScrollView style={md.scroll} showsVerticalScrollIndicator={false}>
                {years.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[md.item, year === y && md.itemActive]}
                    onPress={() => setYear(y)}
                  >
                    <Text style={[md.itemText, year === y && md.itemTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={md.calendar}>
            <Text style={md.calendarTitle}>
              {MOIS[month - 1]} {year}
            </Text>
            <View style={md.daysGrid}>
              {days.map((d) => {
                const dateObj = new Date(year, month - 1, d);
                const dateObj2 = new Date();
                dateObj2.setHours(0, 0, 0, 0);
                const key = `${year}-${month - 1}-${d}`;
                const isSelected = selected.has(key);

                // Vérifier si la date est disponible
                let isDisabled = dateObj < dateObj2; // Passée
                if (availableSet.size > 0) {
                  isDisabled = isDisabled || !availableSet.has(key); // Pas dans les disponibilités
                }

                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      md.dayBtn,
                      isSelected && md.dayBtnSelected,
                      isDisabled && md.dayBtnDisabled,
                    ]}
                    onPress={() => !isDisabled && toggleDay(d)}
                    disabled={isDisabled}
                  >
                    <Text
                      style={[
                        md.dayText,
                        isSelected && md.dayTextSelected,
                        isDisabled && md.dayTextDisabled,
                      ]}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={md.actions}>
            <TouchableOpacity style={md.cancelBtn} onPress={onClose}>
              <Text style={md.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={md.confirmBtn} onPress={confirm}>
              <Text style={md.confirmText}>Valider ({selected.size})</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const md = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, width: '100%', maxWidth: 400, maxHeight: '90%', padding: Spacing.xl, ...Shadow.modal },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.lg, textAlign: 'center' },
  monthSelector: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  monthCol: { flex: 2 },
  yearCol: { flex: 1 },
  colLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.xs, textAlign: 'center' },
  scroll: { maxHeight: 100, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  item: { paddingVertical: Spacing.sm, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemActive: { backgroundColor: Colors.primaryLight },
  itemText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  itemTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  calendar: { marginBottom: Spacing.lg },
  calendarTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  dayBtn: { width: '14%', aspectRatio: 1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  dayBtnSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayBtnDisabled: { backgroundColor: Colors.surfaceVariant, borderColor: Colors.border },
  dayText: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  dayTextSelected: { color: Colors.textInverse },
  dayTextDisabled: { color: Colors.textTertiary },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  confirmBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  confirmText: { color: Colors.textInverse, fontWeight: FontWeight.bold },
});
