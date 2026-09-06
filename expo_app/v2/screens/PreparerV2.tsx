// ─────────────────────────────────────────────────────────────────────────────
// PreparerV2 — « Préparer mon concours » (skippable). Après « J'y serai ».
// Cheval · Épreuves · besoins Transport / Box / Coach.
// F2 : tout est enregistré LOCALEMENT (useConcoursLocal). AUCUNE écriture PROD.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Section, Chip, PrimaryButton, GhostButton } from '../ui/kit';
import { useConcours } from '../../hooks/useConcours';
import { useMyChevaux } from '../../hooks/useChevaux';
import { useConcoursLocal, NeedChoice } from '../state/concoursLocal';

const NEED_OPTS: { key: NeedChoice; label: string }[] = [
  { key: 'done', label: 'Déjà organisé' },
  { key: 'searching', label: 'Je cherche' },
  { key: 'none', label: 'Pas nécessaire' },
];

export function PreparerV2() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { concours } = useConcours(id);
  const { chevaux } = useMyChevaux();
  const { entry, update, prepScore } = useConcoursLocal(id);
  const [epreuve, setEpreuve] = useState('');

  const NeedBlock = ({ icon, title, field }: { icon: string; title: string; field: 'needTransport' | 'needBox' | 'needCoach' }) => (
    <Section title={`${icon}  ${title}`}>
      <View style={s.opts}>
        {NEED_OPTS.map((o) => (
          <Chip key={o.key} label={o.label} on={entry[field] === o.key} onPress={() => update({ [field]: o.key } as any)} />
        ))}
      </View>
    </Section>
  );

  return (
    <Screen>
      <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← {concours?.nom ?? 'Concours'}</Text></TouchableOpacity>
      <Text style={s.h1}>Préparer mon concours</Text>
      <Text style={s.sub}>Facultatif — tu peux compléter plus tard. Préparation ◕ {prepScore}/5</Text>

      <Section title="Avec quel cheval ?">
        <View style={s.opts}>
          {chevaux.map((c) => (
            <Chip key={c.id} label={c.nom} on={entry.chevalId === c.id} onPress={() => update({ chevalId: entry.chevalId === c.id ? null : c.id })} />
          ))}
          <Chip label="＋ Ajouter" onPress={() => router.push('/(v2)/chevaux' as any)} />
        </View>
        {chevaux.length === 0 && <Text style={s.hint}>Aucun cheval. Ajoute-en un depuis l’onglet Chevaux.</Text>}
      </Section>

      <Section title="Épreuve(s) — facultatif">
        <View style={s.opts}>
          {entry.epreuves.map((e) => (
            <Chip key={e} label={`${e}  ✕`} on onPress={() => update({ epreuves: entry.epreuves.filter((x) => x !== e) })} />
          ))}
        </View>
        <View style={s.addRow}>
          <TextInput style={s.input} value={epreuve} onChangeText={setEpreuve} placeholder="Ex. Amateur 1" placeholderTextColor={Colors.textTertiary} />
          <GhostButton label="Ajouter" onPress={() => { if (epreuve.trim()) { update({ epreuves: [...entry.epreuves, epreuve.trim()] }); setEpreuve(''); } }} />
        </View>
      </Section>

      <Text style={s.section}>Ai-je besoin de… ?</Text>
      <NeedBlock icon="🚚" title="Transport" field="needTransport" />
      <NeedBlock icon="🏠" title="Box" field="needBox" />
      <NeedBlock icon="🎓" title="Coach" field="needCoach" />

      <PrimaryButton label="Enregistrer ma préparation" onPress={() => router.replace(`/(v2)/concours/${id}` as any)} />
      <TouchableOpacity onPress={() => router.replace(`/(v2)/concours/${id}` as any)}><Text style={s.later}>Plus tard</Text></TouchableOpacity>
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  h1: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  section: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.lg },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  hint: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },
  addRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  later: { textAlign: 'center', color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.sm, paddingVertical: Spacing.sm },
});
