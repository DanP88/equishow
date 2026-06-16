// ─────────────────────────────────────────────────────────────────────────────
// admin-concours-claims — LOT Organisateur P0. Revue admin des revendications.
// L'admin voit toutes les demandes (RLS update admin) et approuve / refuse.
// L'approbation = ownership (claim status='approved'). Anti-doublon : l'index
// unique « 1 seul approved par concours » (076) bloque un 2ᵉ propriétaire.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { AuthGuard } from '../components/AuthGuard';
import { AlertModal } from '../components/AlertModal';
import { useScreenTracking } from '../hooks/useScreenTracking';
import { useAdminConcoursClaims, ConcoursClaim } from '../hooks/useConcoursClaims';

export default function AdminConcoursClaimsScreen() {
  return (
    <AuthGuard requiredRole="admin">
      <Content />
    </AuthGuard>
  );
}

function Content() {
  useScreenTracking('admin-concours-claims');
  const { claims, isLoading, review } = useAdminConcoursClaims();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [alertState, setAlertState] = useState<{ title: string; message: string } | null>(null);

  const pending = claims.filter((c) => c.status === 'pending');
  const done = claims.filter((c) => c.status !== 'pending');

  async function act(id: string, status: 'approved' | 'rejected') {
    setBusyId(id);
    const { error } = await review(id, status);
    setBusyId(null);
    if (error) {
      const dup = /duplicate key|unique|ux_concours_claims_one_approved/i.test(error);
      setAlertState({
        title: dup ? 'Concours déjà attribué' : 'Erreur',
        message: dup ? 'Ce concours a déjà un organisateur propriétaire (un seul autorisé).' : error,
      });
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/admin-settings')} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title}>Revendications de concours</Text>
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
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

      <AlertModal visible={!!alertState} title={alertState?.title ?? ''} message={alertState?.message} variant="error" onClose={() => setAlertState(null)} />
    </SafeAreaView>
  );
}

function ClaimCard({ claim, busy, onApprove, onReject }: {
  claim: ConcoursClaim; busy?: boolean; onApprove?: () => void; onReject?: () => void;
}) {
  const badge =
    claim.status === 'approved' ? { txt: '● Approuvée', bg: '#ECFDF5', fg: '#10B981' }
    : claim.status === 'rejected' ? { txt: '● Refusée', bg: '#FEE2E2', fg: '#EF4444' }
    : { txt: '● En attente', bg: '#FFF7ED', fg: '#F59E0B' };
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardConcours} numberOfLines={1}>{claim.concoursNom ?? claim.concoursId}</Text>
        <View style={[s.badge, { backgroundColor: badge.bg }]}><Text style={[s.badgeTxt, { color: badge.fg }]}>{badge.txt}</Text></View>
      </View>
      <Text style={s.cardOrg}>👤 {claim.organisateurNom ?? claim.organisateurId}</Text>

      <Text style={s.verifLabel}>Éléments de vérification</Text>
      <View style={s.verifBox}>
        <Text style={s.verifTxt}>{claim.justification?.trim() ? claim.justification.trim() : '— Aucun élément fourni —'}</Text>
      </View>

      <Text style={s.cardDate}>Demandé le {new Date(claim.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
      {!!claim.reviewedAt && (
        <Text style={s.cardDate}>Revue le {new Date(claim.reviewedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
      )}

      {claim.status === 'pending' && onApprove && onReject && (
        <View>
          <Text style={s.verifWarn}>⚠️ Vérifiez que le demandeur représente bien l'organisation officielle du concours avant d'approuver.</Text>
        <View style={s.actions}>
          <TouchableOpacity style={[s.btn, s.reject]} disabled={busy} onPress={onReject}>
            <Text style={s.rejectTxt}>Refuser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.approve]} disabled={busy} onPress={onApprove}>
            {busy ? <ActivityIndicator color={Colors.textInverse} /> : <Text style={s.approveTxt}>Approuver</Text>}
          </TouchableOpacity>
        </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceVariant },
  backTxt: { fontSize: 20, color: Colors.textPrimary },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  empty: { fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadow.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  cardConcours: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  badge: { borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  badgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  cardOrg: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
  verifLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', marginTop: Spacing.sm },
  verifBox: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, padding: Spacing.md, marginTop: 4, marginBottom: Spacing.xs },
  verifTxt: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 19 },
  verifWarn: { fontSize: FontSize.xs, color: '#B45309', lineHeight: 16, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  cardDate: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  approve: { backgroundColor: Colors.primary },
  approveTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  reject: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FEC2C2' },
  rejectTxt: { color: '#DC2626', fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
