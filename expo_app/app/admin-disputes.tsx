import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { AuthGuard } from '../components/AuthGuard';
import { ConfirmModal } from '../components/ConfirmModal';
import { AlertModal } from '../components/AlertModal';
import { supabase } from '../lib/supabase';
import { useScreenTracking } from '../hooks/useScreenTracking';
import { useEscrowActions } from '../hooks/useEscrowActions';

interface UserMini {
  id: string;
  prenom: string | null;
  nom: string | null;
  pseudo: string | null;
  avatar_color: string | null;
  initiales: string | null;
}

interface DisputeRow {
  id: string;
  payment_id: string;
  source: 'buyer' | 'admin' | 'chargeback' | string;
  status: 'open' | 'resolved_release' | 'resolved_refund' | string;
  reason: string | null;
  stripe_dispute_id: string | null;
  created_at: string;
  payment: {
    id: string;
    type: 'box' | 'course' | 'stage' | 'transport' | string;
    amount_buyer_ttc: number;
    payment_status: string;
    transfer_state: string;
    stripe_charge_id: string | null;
    buyer_id: string;
    seller_id: string;
  };
  buyer: UserMini | null;
  seller: UserMini | null;
}

type PendingAction =
  | { kind: 'release'; dispute: DisputeRow }
  | { kind: 'refund'; dispute: DisputeRow }
  | null;

export default function AdminDisputesScreen() {
  return (
    <AuthGuard requiredRole="admin">
      <AdminDisputesContent />
    </AuthGuard>
  );
}

function AdminDisputesContent() {
  useScreenTracking('admin-disputes');

  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { releasePayment, resolveDispute, refundPayment, loading: actionLoading } = useEscrowActions();
  const [pending, setPending] = useState<PendingAction>(null);
  const [resultAlert, setResultAlert] = useState<{
    title: string; message: string; variant: 'success' | 'error' | 'info';
  } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      // 1. Disputes ouvertes + jointure embedded sur payments
      // (dépend de policies RLS admin sur payment_disputes + payments — mig 044)
      const { data: rawDisputes, error: dispErr } = await supabase
        .from('payment_disputes')
        .select(`
          id, payment_id, source, status, reason, stripe_dispute_id, created_at,
          payment:payments!inner (
            id, type, amount_buyer_ttc, payment_status, transfer_state,
            stripe_charge_id, buyer_id, seller_id
          )
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (dispErr) throw dispErr;
      const list = (rawDisputes ?? []) as unknown as Omit<DisputeRow, 'buyer' | 'seller'>[];

      // 2. Récupère prénom/nom/avatar des acheteurs et vendeurs via users_public
      const userIds = Array.from(new Set(
        list.flatMap(d => [d.payment.buyer_id, d.payment.seller_id]).filter(Boolean),
      ));

      let usersById = new Map<string, UserMini>();
      if (userIds.length > 0) {
        const { data: users, error: usersErr } = await supabase
          .from('users_public')
          .select('id, prenom, nom, pseudo, avatar_color, initiales')
          .in('id', userIds);
        if (usersErr) throw usersErr;
        usersById = new Map((users ?? []).map(u => [u.id, u as UserMini]));
      }

      // 3. Enrichit chaque ligne
      const enriched: DisputeRow[] = list.map(d => ({
        ...d,
        buyer: usersById.get(d.payment.buyer_id) ?? null,
        seller: usersById.get(d.payment.seller_id) ?? null,
      }));

      setDisputes(enriched);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erreur chargement litiges');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onPressRelease = useCallback((d: DisputeRow) => {
    if (actionLoading) return;
    setPending({ kind: 'release', dispute: d });
  }, [actionLoading]);

  const onPressRefund = useCallback((d: DisputeRow) => {
    if (actionLoading) return;
    setPending({ kind: 'refund', dispute: d });
  }, [actionLoading]);

  const onConfirmAction = useCallback(async () => {
    if (!pending) return;
    const { kind, dispute } = pending;
    setPending(null);

    if (kind === 'release') {
      // 1) Marque dispute resolved_release (débloque dispute_status)
      const r1 = await resolveDispute(dispute.payment_id, 'release');
      if (!r1.ok) {
        setResultAlert({
          title: 'Échec',
          message: `Impossible de résoudre le litige (${r1.code}).`,
          variant: 'error',
        });
        return;
      }
      // 2) Libère effectivement les fonds via release-payment
      const r2 = await releasePayment(dispute.payment_id);
      if (!r2.ok) {
        setResultAlert({
          title: 'Litige résolu — release à terminer',
          message: `Le litige est marqué résolu mais le release a échoué (${r2.code}). Réessayer depuis l'admin ou attendre le cron.`,
          variant: 'error',
        });
      } else {
        setResultAlert({
          title: '✅ Fonds libérés',
          message: 'Litige clos en faveur du vendeur. Transfer Stripe créé.',
          variant: 'success',
        });
      }
    } else {
      // kind === 'refund' : remboursement RÉEL via process-refund (admin autorisé,
      // mig 069). 1) refund Stripe (+ reversal si déjà versé) + clear du blocage
      // litige côté serveur. 2) seulement SI succès, marquer le litige
      // resolved_refund (resolved_by/at) pour l'historique. Jamais « remboursé »
      // si l'Edge a échoué.
      const r1 = await refundPayment(dispute.payment_id);
      if (!r1.ok) {
        setResultAlert({
          title: 'Remboursement échoué',
          message: `Le remboursement n'a pas pu être effectué (${r1.code}). Aucun litige n'a été clôturé. Réessayer, ou traiter via le Dashboard Stripe (charge ${dispute.payment.stripe_charge_id ?? '—'}).`,
          variant: 'error',
        });
        return;
      }
      const r2 = await resolveDispute(dispute.payment_id, 'refund');
      setResultAlert({
        title: '↩️ Remboursement déclenché',
        message: r2.ok
          ? "L'acheteur a été remboursé (retour sur carte sous quelques jours). Litige clos."
          : `Remboursement effectué, mais la clôture du litige a échoué (${r2.code}). À vérifier dans la liste.`,
        variant: r2.ok ? 'success' : 'info',
      });
    }

    await load();
  }, [pending, resolveDispute, releasePayment, refundPayment, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const confirmModalProps = useMemo(() => {
    if (!pending) return null;
    const { kind, dispute } = pending;
    const eur = (dispute.payment.amount_buyer_ttc / 100).toFixed(2);
    if (kind === 'release') {
      return {
        title: 'Libérer les fonds ?',
        message: `Le vendeur va recevoir le montant correspondant à ce paiement (${eur} € TTC, hors commission). Action irréversible.`,
        confirmLabel: 'Oui, libérer',
        destructive: false,
      };
    }
    return {
      title: 'Rembourser l\'acheteur ?',
      message: `L'acheteur sera remboursé de ${eur} € TTC (retour sur sa carte). Si les fonds avaient déjà été versés au vendeur, le transfert est annulé. Action irréversible.`,
      confirmLabel: 'Oui, rembourser',
      destructive: true,
    };
  }, [pending]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        >
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Litiges en cours</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : loadError ? (
          <View style={s.center}>
            <Text style={s.errIcon}>⚠️</Text>
            <Text style={s.errText}>{loadError}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={load}>
              <Text style={s.retryBtnText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : disputes.length === 0 ? (
          <View style={s.center}>
            <Text style={s.emptyIcon}>🎉</Text>
            <Text style={s.emptyText}>Aucun litige en cours.</Text>
          </View>
        ) : (
          disputes.map((d) => {
            const eur = (d.payment.amount_buyer_ttc / 100).toFixed(2);
            const buyerName = renderName(d.buyer) || abbrevId(d.payment.buyer_id);
            const sellerName = renderName(d.seller) || abbrevId(d.payment.seller_id);
            return (
              <View key={d.id} style={s.card}>
                <View style={s.cardHeader}>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>🚩 LITIGE OUVERT</Text>
                  </View>
                  <Text style={s.typeTag}>{typeLabel(d.payment.type)}</Text>
                </View>

                <Text style={s.amount}>{eur} € TTC</Text>
                <Text style={s.metaLine}>Ouvert {formatDate(d.created_at)} · source : {d.source}</Text>

                <View style={s.separator} />
                <View style={s.row}>
                  <Text style={s.rowLabel}>Acheteur</Text>
                  <Text style={s.rowValue}>{buyerName}</Text>
                </View>
                <View style={s.row}>
                  <Text style={s.rowLabel}>Vendeur</Text>
                  <Text style={s.rowValue}>{sellerName}</Text>
                </View>
                <View style={s.row}>
                  <Text style={s.rowLabel}>État paiement</Text>
                  <Text style={s.rowValue}>
                    {d.payment.payment_status} · {d.payment.transfer_state}
                  </Text>
                </View>
                {d.payment.stripe_charge_id && (
                  <View style={s.row}>
                    <Text style={s.rowLabel}>Stripe charge</Text>
                    <Text style={[s.rowValue, s.monoText]}>{d.payment.stripe_charge_id}</Text>
                  </View>
                )}

                <View style={s.separator} />
                <Text style={s.reasonLabel}>Raison</Text>
                <Text style={s.reasonText}>{d.reason || '—'}</Text>

                <View style={s.actions}>
                  <TouchableOpacity
                    style={[s.btnRelease, actionLoading && s.btnDisabled]}
                    disabled={actionLoading}
                    onPress={() => onPressRelease(d)}
                    activeOpacity={0.85}
                  >
                    <Text style={s.btnReleaseText}>✅ Libérer fonds</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btnRefund, actionLoading && s.btnDisabled]}
                    disabled={actionLoading}
                    onPress={() => onPressRefund(d)}
                    activeOpacity={0.85}
                  >
                    <Text style={s.btnRefundText}>↩️ Rembourser acheteur</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!pending && !!confirmModalProps}
        title={confirmModalProps?.title ?? ''}
        message={confirmModalProps?.message}
        confirmLabel={confirmModalProps?.confirmLabel}
        cancelLabel="Annuler"
        destructive={confirmModalProps?.destructive}
        onCancel={() => setPending(null)}
        onConfirm={onConfirmAction}
      />

      <AlertModal
        visible={!!resultAlert}
        title={resultAlert?.title ?? ''}
        message={resultAlert?.message}
        variant={resultAlert?.variant ?? 'info'}
        onClose={() => setResultAlert(null)}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers

function renderName(u: UserMini | null): string {
  if (!u) return '';
  const first = (u.prenom ?? '').trim();
  const last = (u.nom ?? '').trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (u.pseudo) return `@${u.pseudo}`;
  return '';
}

function abbrevId(id: string): string {
  return id ? `${id.slice(0, 8)}…` : '—';
}

function typeLabel(t: string): string {
  switch (t) {
    case 'box': return 'Box';
    case 'course': return 'Cours';
    case 'stage': return 'Stage';
    case 'transport': return 'Transport';
    default: return t;
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// styles

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 32, color: Colors.textPrimary, lineHeight: 32 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  container: { padding: Spacing.lg, gap: Spacing.md },

  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  errIcon: { fontSize: 40 },
  errText: { fontSize: FontSize.base, color: Colors.urgent, textAlign: 'center' },
  retryBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, marginTop: Spacing.sm,
  },
  retryBtnText: { color: '#fff', fontWeight: FontWeight.bold },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: FontSize.base, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, gap: 4,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  badge: {
    backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.md,
  },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#991B1B' },
  typeTag: {
    fontSize: FontSize.xs, color: Colors.textSecondary,
    textTransform: 'uppercase', fontWeight: FontWeight.semibold,
  },

  amount: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.primary, marginTop: 2 },
  metaLine: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.xs },

  separator: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 2, gap: Spacing.md,
  },
  rowLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 0, minWidth: 100 },
  rowValue: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  monoText: { fontFamily: 'Courier' as any, fontSize: FontSize.xs },

  reasonLabel: {
    fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs,
    fontWeight: FontWeight.semibold,
  },
  reasonText: {
    fontSize: FontSize.sm, color: Colors.textPrimary, marginTop: 2,
    fontStyle: 'italic',
  },

  actions: {
    flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, flexWrap: 'wrap',
  },
  btnRelease: {
    flexGrow: 1, backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10, alignItems: 'center',
  },
  btnReleaseText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff' },
  btnRefund: {
    flexGrow: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#FCD34D',
  },
  btnRefundText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#92400E' },
  btnDisabled: { opacity: 0.5 },
});
