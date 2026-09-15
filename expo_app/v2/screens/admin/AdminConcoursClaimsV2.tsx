// ─────────────────────────────────────────────────────────────────────────────
// AdminConcoursClaimsV2 — reskin Blush de app/admin-concours-claims.tsx.
// Écriture RÉELLE (review → approved/rejected, RLS admin, anti-doublon 076).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { BL, FONT } from '../../ui/blush';
import { Spacing, FontSize, FontWeight } from '../../../constants/theme';
import { useAdminConcoursClaims, ConcoursClaim } from '../../../hooks/useConcoursClaims';
import { AlertModal } from '../../../components/AlertModal';

export function AdminConcoursClaimsV2() {
  const { claims, isLoading, review } = useAdminConcoursClaims();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const pending = claims.filter((c) => c.status === 'pending');
  const done = claims.filter((c) => c.status !== 'pending');

  async function act(id: string, status: 'approved' | 'rejected') {
    setBusyId(id);
    const { error } = await review(id, status);
    setBusyId(null);
    if (error) {
      const dup = /duplicate key|unique|ux_concours_claims_one_approved/i.test(error);
      setAlert({ title: dup ? 'Concours déjà attribué' : 'Erreur', message: dup ? 'Ce concours a déjà un organisateur propriétaire (un seul autorisé).' : error });
    }
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(v2)/admin/profil'))} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.h1}>Revendications de concours</Text>
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color={BL.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          <Text style={s.sectionTitle}>En attente ({pending.length})</Text>
          {pending.length === 0 ? (
            <Text style={s.empty}>Aucune demande en attente.</Text>
          ) : pending.map((c) => (
            <ClaimCard key={c.id} claim={c} busy={busyId === c.id} onApprove={() => act(c.id, 'approved')} onReject={() => act(c.id, 'rejected')} />
          ))}
          {done.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { marginTop: Spacing.xl }]}>Traitées ({done.length})</Text>
              {done.map((c) => <ClaimCard key={c.id} claim={c} />)}
            </>
          )}
        </ScrollView>
      )}

      <AlertModal visible={!!alert} title={alert?.title ?? ''} message={alert?.message} variant="error" onClose={() => setAlert(null)} />
    </View>
  );
}

function ClaimCard({ claim, busy, onApprove, onReject }: { claim: ConcoursClaim; busy?: boolean; onApprove?: () => void; onReject?: () => void }) {
  const badge = claim.status === 'approved' ? { txt: '● Approuvée', bg: '#EAF3EC', fg: BL.sage }
    : claim.status === 'rejected' ? { txt: '● Refusée', bg: '#FCE9EC', fg: BL.berry }
    : { txt: '● En attente', bg: '#FBF1DB', fg: '#A6822E' };
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardConcours} numberOfLines={1}>{claim.concoursNom ?? claim.concoursId}</Text>
        <View style={[s.badge, { backgroundColor: badge.bg }]}><Text style={[s.badgeTxt, { color: badge.fg }]}>{badge.txt}</Text></View>
      </View>
      <Text style={s.cardOrg}>👤 {claim.organisateurNom ?? claim.organisateurId}</Text>
      <Text style={s.verifLabel}>Éléments de vérification</Text>
      <View style={s.verifBox}><Text style={s.verifTxt}>{claim.justification?.trim() ? claim.justification.trim() : '— Aucun élément fourni —'}</Text></View>
      <Text style={s.cardDate}>Demandé le {new Date(claim.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
      {!!claim.reviewedAt && <Text style={s.cardDate}>Revue le {new Date(claim.reviewedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>}

      {claim.status === 'pending' && onApprove && onReject && (
        <View>
          <Text style={s.verifWarn}>⚠️ Vérifiez que le demandeur représente bien l'organisation officielle du concours avant d'approuver.</Text>
          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, s.reject]} disabled={busy} onPress={onReject}><Text style={s.rejectTxt}>Refuser</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.approve]} disabled={busy} onPress={onApprove}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.approveTxt}>Approuver</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BL.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: BL.card, borderBottomWidth: 1, borderBottomColor: BL.line },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: BL.bg },
  backTxt: { fontSize: 20, color: BL.ink },
  h1: { fontFamily: FONT.head, fontSize: 18, fontWeight: '700', color: BL.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: BL.ink, marginBottom: Spacing.sm },
  empty: { fontSize: FontSize.sm, color: BL.faint, marginBottom: Spacing.md },
  card: { backgroundColor: BL.card, borderRadius: 16, borderWidth: 1, borderColor: BL.line, padding: Spacing.lg, marginBottom: Spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  cardConcours: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.bold, color: BL.ink },
  badge: { borderRadius: 8, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  badgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  cardOrg: { fontSize: FontSize.sm, color: BL.sub, marginBottom: 2 },
  verifLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: BL.faint, textTransform: 'uppercase', marginTop: Spacing.sm },
  verifBox: { backgroundColor: BL.bg, borderRadius: 10, padding: Spacing.md, marginTop: 4, marginBottom: Spacing.xs },
  verifTxt: { fontSize: FontSize.sm, color: BL.ink, lineHeight: 19 },
  verifWarn: { fontSize: FontSize.xs, color: '#A6822E', lineHeight: 16, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  cardDate: { fontSize: FontSize.xs, color: BL.faint, marginTop: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flex: 1, borderRadius: 999, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  approve: { backgroundColor: BL.accent },
  approveTxt: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  reject: { backgroundColor: '#FCE9EC', borderWidth: 1, borderColor: '#F3C7CE' },
  rejectTxt: { color: BL.berry, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
