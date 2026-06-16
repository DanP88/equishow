// ─────────────────────────────────────────────────────────────────────────────
// org-revendiquer — LOT Organisateur P0 (réel, remplace le proto).
// L'organisateur recherche un concours (table concours réelle), le sélectionne,
// saisit une justification, et soumet une revendication (concours_claims).
// Validation par un admin ensuite. Aucune écriture sur concours.organisateur_id.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { AlertModal } from '../components/AlertModal';
import { useConcoursList } from '../hooks/useConcours';
import { submitConcoursClaim, useMyConcoursClaims } from '../hooks/useConcoursClaims';
import { useAuth } from '../hooks/useAuth';

export default function OrgRevendiquerScreen() {
  const { profile } = useAuth();
  const { concours, isLoading } = useConcoursList();
  const { claims, reload } = useMyConcoursClaims();

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // PART 4 — preuves structurées (stockées dans `justification` en texte lisible).
  const [fStructure, setFStructure] = useState('');
  const [fRole, setFRole] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fTel, setFTel] = useState('');
  const [fSiret, setFSiret] = useState('');
  const [fLien, setFLien] = useState('');
  const [fMessage, setFMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [alertState, setAlertState] = useState<{ title: string; message: string; variant: 'info' | 'error' } | null>(null);

  // Concours déjà revendiqués (pending/approved) → on évite les doublons.
  const claimedIds = useMemo(
    () => new Set(claims.filter((c) => c.status !== 'rejected').map((c) => c.concoursId)),
    [claims],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return concours.slice(0, 30);
    return concours.filter((c) =>
      c.nom.toLowerCase().includes(q)
      || (c.lieu ?? '').toLowerCase().includes(q)
      || (c.numero_ffe ?? '').toLowerCase().includes(q)
      || (c.departement ?? '').toLowerCase().includes(q),
    ).slice(0, 30);
  }, [concours, query]);

  const selected = concours.find((c) => c.id === selectedId) ?? null;

  // Champs minimaux exigés pour qu'un admin puisse vérifier sérieusement.
  const canSubmit = !!selected
    && fStructure.trim().length > 1
    && fRole.trim().length > 1
    && /\S+@\S+\.\S+/.test(fEmail.trim());

  // Compose les preuves en bloc texte lisible (la table n'a qu'un champ `justification`).
  function buildJustification(): string {
    const rows: [string, string][] = [
      ['Structure', fStructure],
      ['Rôle', fRole],
      ['Email pro', fEmail],
      ['Téléphone', fTel],
      ['SIRET / Club / Licence FFE', fSiret],
      ['Lien officiel', fLien],
      ['Message', fMessage],
    ];
    return rows
      .map(([k, v]) => [k, v.trim()] as [string, string])
      .filter(([, v]) => v.length > 0)
      .map(([k, v]) => `${k} : ${v}`)
      .join('\n');
  }

  async function submit() {
    if (submitting || !canSubmit || !selected) return;
    setSubmitting(true);
    const orgNom = `${profile?.prenom ?? ''} ${profile?.nom ?? ''}`.trim() || (profile?.email ?? null);
    const { error } = await submitConcoursClaim({
      concoursId: selected.id,
      concoursNom: selected.nom,
      justification: buildJustification() || null,
      organisateurNom: orgNom,
    });
    setSubmitting(false);
    if (error) {
      const dup = /duplicate key|unique/i.test(error);
      setAlertState({
        title: dup ? 'Déjà revendiqué' : 'Erreur',
        message: dup ? 'Tu as déjà une demande en cours pour ce concours.' : error,
        variant: 'error',
      });
      return;
    }
    await reload();
    setSent(true);
  }

  if (sent) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
          <Text style={s.title}>Revendication envoyée</Text>
        </View>
        <View style={s.successWrap}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Demande envoyée</Text>
          <Text style={s.successTxt}>
            Ta revendication de « {selected?.nom} » est en cours de validation par un administrateur Equishow.
            Tu seras notifié de la décision.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/(tabs)/org-concours' as any)}>
            <Text style={s.primaryTxt}>Voir mes concours</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/org-concours')} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title}>Revendiquer un concours</Text>
      </View>

      <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
        <Text style={s.intro}>
          Recherche le concours que tu organises pour le revendiquer. Après validation par un admin,
          tu accéderas à son Radar de demande.
        </Text>

        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Nom, lieu, département ou N° FFE…"
          placeholderTextColor={Colors.textTertiary}
        />

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
        ) : filtered.length === 0 ? (
          <Text style={s.empty}>Aucun concours trouvé.</Text>
        ) : (
          filtered.map((c) => {
            const already = claimedIds.has(c.id);
            const isSel = selectedId === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[s.row, isSel && s.rowSel, already && s.rowDisabled]}
                activeOpacity={already ? 1 : 0.8}
                onPress={() => { if (!already) setSelectedId(c.id); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName}>{c.nom}</Text>
                  <Text style={s.rowMeta}>{[c.dateLabel, c.lieu].filter(Boolean).join(' · ')}</Text>
                </View>
                {already ? (
                  <Text style={s.alreadyTag}>déjà demandé</Text>
                ) : isSel ? (
                  <Text style={s.check}>✓</Text>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}

        {selected && (
          <View style={s.justifyBox}>
            <Text style={s.formTitle}>Éléments de vérification</Text>
            <Text style={s.formHint}>Ces informations permettent à l'équipe Equishow de vérifier que tu représentes bien l'organisation officielle du concours.</Text>

            <Field label="Nom de la structure organisatrice *" value={fStructure} onChange={setFStructure} placeholder="Ex : Étrier de Deauville" />
            <Field label="Rôle du demandeur *" value={fRole} onChange={setFRole} placeholder="Ex : Organisateur terrain, président du club…" />
            <Field label="Email professionnel *" value={fEmail} onChange={setFEmail} placeholder="contact@structure.fr" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Téléphone" value={fTel} onChange={setFTel} placeholder="06 12 34 56 78" keyboardType="phone-pad" />
            <Field label="SIRET / identifiant club / licence FFE" value={fSiret} onChange={setFSiret} placeholder="Si disponible" />
            <Field label="Lien officiel du concours ou site structure" value={fLien} onChange={setFLien} placeholder="https://…" autoCapitalize="none" />
            <Field label="Message complémentaire" value={fMessage} onChange={setFMessage} placeholder="Précisions utiles à la vérification" multiline />

            {!canSubmit && <Text style={s.reqHint}>Renseigne au minimum la structure, ton rôle et un email professionnel valide.</Text>}
            <TouchableOpacity style={[s.primaryBtn, (!canSubmit || submitting) && { opacity: 0.5 }]} disabled={!canSubmit || submitting} onPress={submit} activeOpacity={0.85}>
              {submitting ? <ActivityIndicator color={Colors.textInverse} /> : <Text style={s.primaryTxt}>Envoyer la demande</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <AlertModal
        visible={!!alertState}
        title={alertState?.title ?? ''}
        message={alertState?.message}
        variant={alertState?.variant ?? 'info'}
        onClose={() => setAlertState(null)}
      />
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, multiline, keyboardType, autoCapitalize }: {
  label: string; value: string; onChange: (t: string) => void; placeholder?: string;
  multiline?: boolean; keyboardType?: 'default' | 'email-address' | 'phone-pad'; autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, multiline && s.fieldInputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceVariant },
  backTxt: { fontSize: 20, color: Colors.textPrimary },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  intro: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  search: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary, marginBottom: Spacing.md },
  empty: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  rowSel: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  rowDisabled: { opacity: 0.5 },
  rowName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  rowMeta: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  check: { fontSize: FontSize.lg, color: Colors.primary, fontWeight: FontWeight.bold },
  alreadyTag: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },
  justifyBox: { marginTop: Spacing.lg, gap: Spacing.sm },
  formTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  formHint: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17, marginBottom: Spacing.sm },
  field: { gap: 4, marginBottom: Spacing.xs },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  fieldInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary },
  fieldInputMulti: { height: 90, textAlignVertical: 'top' },
  reqHint: { fontSize: FontSize.xs, color: '#B45309', marginTop: Spacing.xs },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  primaryTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.md },
  successIcon: { fontSize: 56 },
  successTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  successTxt: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
