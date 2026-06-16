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
  const [justification, setJustification] = useState('');
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

  async function submit() {
    if (submitting || !selected) return;
    setSubmitting(true);
    const orgNom = `${profile?.prenom ?? ''} ${profile?.nom ?? ''}`.trim() || (profile?.email ?? null);
    const { error } = await submitConcoursClaim({
      concoursId: selected.id,
      concoursNom: selected.nom,
      justification: justification.trim() || null,
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
            <Text style={s.fieldLabel}>Justification (rôle, structure…)</Text>
            <TextInput
              style={s.justifyInput}
              value={justification}
              onChangeText={setJustification}
              placeholder="Ex : organisateur terrain — Étrier de Deauville, SIRET…"
              placeholderTextColor={Colors.textTertiary}
              multiline
            />
            <TouchableOpacity style={[s.primaryBtn, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={submit} activeOpacity={0.85}>
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
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  justifyInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary, height: 90, textAlignVertical: 'top' },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  primaryTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.md },
  successIcon: { fontSize: 56 },
  successTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  successTxt: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
