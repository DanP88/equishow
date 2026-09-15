// ─────────────────────────────────────────────────────────────────────────────
// AdminDisputesV2 — reskin Blush de app/(tabs)/admin-disputes.tsx.
// Actions RÉELLES (release / refund via useEscrowActions, mêmes Edge Functions
// que V1). v2/adapters/admin.useV2AdminDisputes encapsule le fetch + actions.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { BL, FONT } from '../../ui/blush';
import { Spacing, FontSize, FontWeight } from '../../../constants/theme';
import { useV2AdminDisputes, type AdminDisputeRow } from '../../adapters/admin';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { AlertModal } from '../../../components/AlertModal';

type Pending = { kind: 'release' | 'refund'; dispute: AdminDisputeRow } | null;

function typeLabel(t: string): string {
  return { box: 'Box', course: 'Cours', stage: 'Stage', transport: 'Transport' }[t] ?? t;
}
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}
function name(u: AdminDisputeRow['buyer']): string {
  if (!u) return '—';
  const full = `${u.prenom ?? ''} ${u.nom ?? ''}`.trim();
  return full || (u.pseudo ? `@${u.pseudo}` : '—');
}

export function AdminDisputesV2() {
  const { disputes, loading, error, refresh, actionLoading, resolveRelease, resolveRefund } = useV2AdminDisputes();
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [alert, setAlert] = useState<{ title: string; message: string; variant: 'success' | 'error' | 'info' } | null>(null);

  async function onRefresh() { setRefreshing(true); await refresh(); setRefreshing(false); }

  async function onConfirm() {
    if (!pending) return;
    const { kind, dispute } = pending;
    setPending(null);
    if (kind === 'release') {
      const r = await resolveRelease(dispute);
      setAlert(r.ok
        ? { title: '✅ Fonds libérés', message: 'Litige clos en faveur du vendeur. Transfer Stripe créé.', variant: 'success' }
        : { title: r.stage === 'release' ? 'Litige résolu — release à terminer' : 'Échec', message: `${r.stage === 'release' ? 'Le litige est marqué résolu mais le release a échoué' : 'Impossible de résoudre le litige'} (${r.code}).`, variant: 'error' });
    } else {
      const r = await resolveRefund(dispute);
      setAlert(!r.ok
        ? { title: 'Remboursement échoué', message: `Le remboursement n'a pas pu être effectué (${r.code}). Aucun litige n'a été clôturé. Charge Stripe ${dispute.payment.stripe_charge_id ?? '—'}.`, variant: 'error' }
        : r.code
          ? { title: '↩️ Remboursement déclenché', message: `Remboursement effectué, mais la clôture du litige a échoué (${r.code}). À vérifier dans la liste.`, variant: 'info' }
          : { title: '↩️ Remboursement déclenché', message: "L'acheteur a été remboursé (retour sur carte sous quelques jours). Litige clos.", variant: 'success' });
    }
  }

  const confirmProps = (() => {
    if (!pending) return null;
    const e = (pending.dispute.payment.amount_buyer_ttc / 100).toFixed(2);
    return pending.kind === 'release'
      ? { title: 'Libérer les fonds ?', message: `Le vendeur va recevoir ${e} € TTC (hors commission). Action irréversible.`, confirmLabel: 'Oui, libérer', destructive: false }
      : { title: "Rembourser l'acheteur ?", message: `L'acheteur sera remboursé de ${e} € TTC. Si les fonds avaient déjà été versés au vendeur, le transfert est annulé. Action irréversible.`, confirmLabel: 'Oui, rembourser', destructive: true };
  })();

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={s.pad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BL.accent} />}
      >
        <Text style={s.h1}>Litiges en cours</Text>
        <Text style={s.sub}>Résolution réelle — Stripe (release / refund)</Text>

        {loading ? (
          <View style={s.center}><ActivityIndicator size="large" color={BL.accent} /></View>
        ) : error ? (
          <View style={s.center}><Text style={s.errIcon}>⚠️</Text><Text style={s.errText}>{error}</Text></View>
        ) : disputes.length === 0 ? (
          <View style={s.center}><Text style={s.emptyIcon}>🎉</Text><Text style={s.emptyText}>Aucun litige en cours.</Text></View>
        ) : disputes.map((d) => {
          const eurAmt = (d.payment.amount_buyer_ttc / 100).toFixed(2);
          return (
            <View key={d.id} style={s.card}>
              <View style={s.cardHead}>
                <View style={s.badge}><Text style={s.badgeTxt}>🚩 LITIGE OUVERT</Text></View>
                <Text style={s.typeTag}>{typeLabel(d.payment.type)}</Text>
              </View>
              <Text style={s.amount}>{eurAmt} € TTC</Text>
              <Text style={s.meta}>Ouvert {fmtDate(d.created_at)} · source : {d.source}</Text>
              <View style={s.sep} />
              <Row label="Acheteur" value={name(d.buyer)} />
              <Row label="Vendeur" value={name(d.seller)} />
              <Row label="État paiement" value={`${d.payment.payment_status} · ${d.payment.transfer_state}`} />
              {d.payment.stripe_charge_id && <Row label="Stripe charge" value={d.payment.stripe_charge_id} mono />}
              <View style={s.sep} />
              <Text style={s.reasonLabel}>Raison</Text>
              <Text style={s.reasonText}>{d.reason || '—'}</Text>
              <View style={s.actions}>
                <TouchableOpacity style={[s.btn, s.btnRelease, actionLoading && s.btnOff]} disabled={actionLoading} onPress={() => setPending({ kind: 'release', dispute: d })} activeOpacity={0.85}>
                  <Text style={s.btnReleaseTxt}>✅ Libérer fonds</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.btnRefund, actionLoading && s.btnOff]} disabled={actionLoading} onPress={() => setPending({ kind: 'refund', dispute: d })} activeOpacity={0.85}>
                  <Text style={s.btnRefundTxt}>↩️ Rembourser</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      <ConfirmModal
        visible={!!pending && !!confirmProps}
        title={confirmProps?.title ?? ''}
        message={confirmProps?.message}
        confirmLabel={confirmProps?.confirmLabel}
        cancelLabel="Annuler"
        destructive={confirmProps?.destructive}
        onCancel={() => setPending(null)}
        onConfirm={onConfirm}
      />
      <AlertModal visible={!!alert} title={alert?.title ?? ''} message={alert?.message} variant={alert?.variant ?? 'info'} onClose={() => setAlert(null)} />
    </View>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, mono && { fontFamily: 'Courier' }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BL.bg },
  pad: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 60 },
  h1: { fontFamily: FONT.head, fontSize: 25, fontWeight: '700', color: BL.ink },
  sub: { fontSize: FontSize.sm, color: BL.sub, marginBottom: Spacing.sm },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  errIcon: { fontSize: 40 }, errText: { fontSize: FontSize.base, color: BL.berry, textAlign: 'center' },
  emptyIcon: { fontSize: 48 }, emptyText: { fontSize: FontSize.base, color: BL.sub },
  card: { backgroundColor: BL.card, borderRadius: 16, borderWidth: 1, borderColor: BL.line, padding: Spacing.lg, gap: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { backgroundColor: '#FCE9EC', borderColor: BL.berry, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: 10 },
  badgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: BL.berry },
  typeTag: { fontSize: FontSize.xs, color: BL.sub, textTransform: 'uppercase', fontWeight: FontWeight.semibold },
  amount: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: BL.accent, marginTop: 2 },
  meta: { fontSize: FontSize.xs, color: BL.sub, marginBottom: Spacing.xs },
  sep: { height: 1, backgroundColor: BL.line, marginVertical: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, gap: Spacing.md },
  rowLabel: { fontSize: FontSize.xs, color: BL.sub, minWidth: 100 },
  rowValue: { fontSize: FontSize.sm, color: BL.ink, flex: 1, textAlign: 'right' },
  reasonLabel: { fontSize: FontSize.xs, color: BL.sub, marginTop: Spacing.xs, fontWeight: FontWeight.semibold },
  reasonText: { fontSize: FontSize.sm, color: BL.ink, marginTop: 2, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, flexWrap: 'wrap' },
  btn: { flexGrow: 1, borderRadius: 999, paddingHorizontal: Spacing.md, paddingVertical: 10, alignItems: 'center' },
  btnOff: { opacity: 0.5 },
  btnRelease: { backgroundColor: BL.accent },
  btnReleaseTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff' },
  btnRefund: { backgroundColor: BL.card, borderWidth: 1, borderColor: BL.berry },
  btnRefundTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: BL.berry },
});
