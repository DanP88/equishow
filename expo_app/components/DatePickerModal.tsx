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

export function DatePickerModal({ visible, value, onConfirm, onClose, title = 'Sélectionner une date' }: {
  visible: boolean;
  value?: Date;
  onConfirm: (date: Date) => void;
  onClose: () => void;
  title?: string;
}) {
  const init = value ?? new Date();
  const [day, setDay] = useState(init.getDate());
  const [month, setMonth] = useState(init.getMonth() + 1);
  const [year, setYear] = useState(init.getFullYear());

  const maxDay = daysInMonth(month, year);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  const years = Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - i);

  function confirm() {
    const d = day > maxDay ? maxDay : day;
    onConfirm(new Date(year, month - 1, d));
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
                {days.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[s.item, day === d && s.itemActive]}
                    onPress={() => setDay(d)}
                  >
                    <Text style={[s.itemText, day === d && s.itemTextActive]}>
                      {String(d).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Mois */}
            <View style={[s.col, { flex: 2 }]}>
              <Text style={s.colLabel}>Mois</Text>
              <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
                {MOIS.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={[s.item, month === i + 1 && s.itemActive]}
                    onPress={() => setMonth(i + 1)}
                  >
                    <Text style={[s.itemText, month === i + 1 && s.itemTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
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

export function formatDate(d?: Date): string {
  if (!d) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
  itemText: { fontSize: FontSize.base, color: Colors.textPrimary },
  itemTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
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
