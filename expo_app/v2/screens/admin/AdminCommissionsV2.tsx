// ─────────────────────────────────────────────────────────────────────────────
// AdminCommissionsV2 — reskin Blush de app/(tabs)/admin-commissions.tsx.
// Écriture RÉELLE (savePlatformCommissions) — mêmes réglages plateforme que V1.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { BL, FONT } from '../../ui/blush';
import { Spacing, FontSize, FontWeight } from '../../../constants/theme';
import { ServiceType, CommissionConfig } from '../../../types/service';
import { useCommissions } from '../../../hooks/useCommissions';
import { savePlatformCommissions } from '../../../hooks/usePlatformSettings';
import { AlertModal } from '../../../components/AlertModal';

const SERVICE_LABELS: Record<ServiceType, string> = { trajet: 'Trajets', location: 'Location de Van', cours: 'Cours de Coach', box: 'Location de Box' };
const SERVICE_DESC: Record<ServiceType, string> = {
  trajet: 'Commission sur les trajets classiques', location: 'Commission sur les locations de van',
  cours: 'Commission sur les cours de coaching', box: 'Commission sur les locations de box',
};
const SERVICE_TYPES: ServiceType[] = ['trajet', 'location', 'cours', 'box'];

export function AdminCommissionsV2() {
  const commissions = useCommissions();
  const [inputs, setInputs] = useState<Record<ServiceType, string>>({
    trajet: (commissions.trajet * 100).toFixed(1), location: (commissions.location * 100).toFixed(1),
    cours: (commissions.cours * 100).toFixed(1), box: (commissions.box * 100).toFixed(1),
  });
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null);

  const isValid = SERVICE_TYPES.every((t) => { const v = parseFloat(inputs[t]); return !isNaN(v) && v >= 0 && v <= 100; });

  async function onSave() {
    const next: Partial<CommissionConfig> = {};
    SERVICE_TYPES.forEach((t) => { next[t] = parseFloat(inputs[t]) / 100; });
    setSaving(true);
    const { error } = await savePlatformCommissions(next as CommissionConfig);
    setSaving(false);
    if (error) setAlert({ title: 'Erreur', message: `Impossible de sauvegarder : ${error}`, variant: 'error' });
    else setAlert({ title: '✓ Enregistré', message: 'Commissions mises à jour avec succès.', variant: 'success' });
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.pad}>
        <Text style={s.h1}>Commissions</Text>
        <Text style={s.sub}>Pourcentage prélevé par la plateforme sur chaque type de transaction. Sans TVA.</Text>

        <View style={{ gap: Spacing.md }}>
          {SERVICE_TYPES.map((t) => (
            <View key={t} style={s.card}>
              <Text style={s.cardTitle}>{SERVICE_LABELS[t]}</Text>
              <Text style={s.cardDesc}>{SERVICE_DESC[t]}</Text>
              <View style={s.currentBox}>
                <Text style={s.currentLabel}>Commission actuelle</Text>
                <Text style={s.currentValue}>{(commissions[t] * 100).toFixed(1)}%</Text>
              </View>
              <Text style={s.inputLabel}>Nouvelle commission (%)</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={inputs[t]}
                  onChangeText={(v) => setInputs((p) => ({ ...p, [t]: v }))}
                  placeholder="5.0"
                  placeholderTextColor={BL.faint}
                  keyboardType="decimal-pad"
                />
                <Text style={s.inputSuffix}>%</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[s.btn, (!isValid || saving) && s.btnOff]} onPress={onSave} disabled={!isValid || saving} activeOpacity={0.9}>
          <Text style={s.btnTxt}>{saving ? 'Enregistrement…' : 'Enregistrer toutes les commissions'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
      <AlertModal visible={!!alert} title={alert?.title ?? ''} message={alert?.message} variant={alert?.variant ?? 'info'} onClose={() => setAlert(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BL.bg },
  pad: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },
  h1: { fontFamily: FONT.head, fontSize: 25, fontWeight: '700', color: BL.ink },
  sub: { fontSize: FontSize.sm, color: BL.sub, marginTop: -Spacing.sm },
  card: { backgroundColor: BL.card, borderRadius: 16, borderWidth: 1, borderColor: BL.line, padding: Spacing.lg, gap: Spacing.sm },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: BL.ink },
  cardDesc: { fontSize: FontSize.xs, color: BL.faint },
  currentBox: { backgroundColor: BL.accentSoft, borderRadius: 10, padding: Spacing.md, alignItems: 'center' },
  currentLabel: { fontSize: FontSize.sm, color: BL.sub, marginBottom: 2 },
  currentValue: { fontFamily: FONT.head, fontSize: 26, fontWeight: '700', color: BL.accent },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: BL.ink },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: BL.line, borderRadius: 10, overflow: 'hidden' },
  input: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.base, color: BL.ink, backgroundColor: BL.card },
  inputSuffix: { paddingHorizontal: Spacing.md, fontSize: FontSize.base, color: BL.sub, fontWeight: FontWeight.semibold },
  btn: { backgroundColor: BL.accent, borderRadius: 999, paddingVertical: Spacing.md, alignItems: 'center' },
  btnOff: { opacity: 0.5 },
  btnTxt: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
