// ─────────────────────────────────────────────────────────────────────────────
// ParametresV2 — écran « Paramètres » (Profil → Compte → Paramètres).
//
// « Modifier mon profil » (prénom/nom/téléphone) = écriture RÉELLE via
// lib/supabase.updateUserProfile (même fonction que l'avatar V2, SHARED,
// 0 nouvel objet backend) — uniquement sur une session réelle.
// Notifications / Sécurité / Offres Pro renvoient vers les écrans V1 déjà
// complets et fonctionnels (routes racine, pas (tabs) — pas de redirection V2).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { BL, FONT } from '../ui/blush';
import { Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Screen, H1, Section, Card, RowGroup, Row } from '../ui/kit';
import { useV2Session } from '../auth';
import { updateUserProfile } from '../../lib/supabase';

export function ParametresV2() {
  const { identity, kind, realUserId, refreshProfile } = useV2Session();
  const isReal = kind === 'real' && !!realUserId;

  const [editing, setEditing] = useState(false);
  const [prenom, setPrenom] = useState(identity?.prenom ?? '');
  const [nom, setNom] = useState(identity?.nom ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function startEdit() {
    setPrenom(identity?.prenom ?? '');
    setNom(identity?.nom ?? '');
    setError(null);
    setSaved(false);
    setEditing(true);
  }

  async function save() {
    if (!isReal || !realUserId) return;
    if (!prenom.trim() || !nom.trim()) {
      setError('Prénom et nom sont obligatoires.');
      return;
    }
    setSaving(true);
    setError(null);
    // NB : `users` n'a pas de colonne téléphone en base (vérifié en prod) —
    // uniquement prénom/nom éditables ici.
    const { error: err } = await updateUserProfile(realUserId, {
      prenom: prenom.trim(),
      nom: nom.trim(),
    } as any);
    setSaving(false);
    if (err) {
      setError((err as any)?.message ?? 'Enregistrement échoué.');
      return;
    }
    await refreshProfile();
    setEditing(false);
    setSaved(true);
  }

  return (
    <Screen>
      <H1>Paramètres</H1>

      <Section title="Mon profil">
        {!isReal ? (
          <Card>
            <Text style={s.hint}>Édition du profil disponible sur un compte connecté.</Text>
          </Card>
        ) : editing ? (
          <Card>
            <Field label="Prénom" value={prenom} onChangeText={setPrenom} />
            <Field label="Nom" value={nom} onChangeText={setNom} />
            {!!error && <Text style={s.error}>⚠ {error}</Text>}
            <View style={s.editActions}>
              <TouchableOpacity style={s.btnGhost} onPress={() => setEditing(false)} disabled={saving}>
                <Text style={s.btnGhostTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, saving && s.btnOff]} onPress={save} disabled={saving}>
                <Text style={s.btnTxt}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          <RowGroup>
            <Row icon="account-outline" label={`${identity?.prenom ?? ''} ${identity?.nom ?? ''}`.trim() || '—'} sub={identity?.email} onPress={startEdit} />
            {saved && <Row icon="check-circle-outline" label="✓ Profil mis à jour" />}
          </RowGroup>
        )}
      </Section>

      <Section title="Compte">
        <RowGroup>
          <Row icon="bell-outline" label="Notifications" onPress={() => router.push('/parametres-notifications' as any)} />
          <Row icon="lock-outline" label="Sécurité" onPress={() => router.push('/securite' as any)} />
          <Row icon="star-outline" label="Offres Pro" onPress={() => router.push('/tarification' as any)} />
        </RowGroup>
      </Section>
    </Screen>
  );
}

function Field({ label, value, onChangeText, keyboardType }: {
  label: string; value: string; onChangeText: (v: string) => void; keyboardType?: 'phone-pad';
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={BL.faint}
      />
    </View>
  );
}

const s = StyleSheet.create({
  hint: { fontSize: FontSize.sm, color: BL.sub, fontStyle: 'italic' },
  field: { gap: 4, marginBottom: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, color: BL.sub, fontWeight: FontWeight.semibold, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: BL.line, borderRadius: 10, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: BL.ink, backgroundColor: BL.bg },
  error: { fontSize: FontSize.xs, color: BL.berry, marginTop: 2 },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  btn: { flex: 1, backgroundColor: BL.accent, borderRadius: 999, paddingVertical: Spacing.sm + 4, alignItems: 'center' },
  btnOff: { opacity: 0.6 },
  btnTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  btnGhost: { flex: 1, backgroundColor: BL.card, borderWidth: 1, borderColor: BL.line, borderRadius: 999, paddingVertical: Spacing.sm + 4, alignItems: 'center' },
  btnGhostTxt: { color: BL.sub, fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
});
