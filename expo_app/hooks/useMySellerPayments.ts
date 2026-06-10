import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

// ─────────────────────────────────────────────────────────────────────────────
// useMySellerPayments — paiements REÇUS par le user en tant que vendeur.
//
// RLS sur `payments` limite déjà aux lignes du user (buyer OU seller) ; on
// filtre côté requête sur seller_id = moi pour ne garder que les ventes.
// On exclut les paiements jamais aboutis (pending/failed/cancelled) : seuls
// 'succeeded' (réel argent) et 'refunded' (historique) sont pertinents.
//
// `transfer_state` (séquestre) :
//   held / releasing → fonds en séquestre, pas encore versés
//   released         → versés au compte Stripe du vendeur
//   not_applicable   → legacy (versement immédiat, pré-escrow)
// ─────────────────────────────────────────────────────────────────────────────

export type SellerPaymentType = 'course' | 'stage' | 'transport' | 'box';

export interface SellerPayment {
  id: string;
  type: SellerPaymentType;
  amountSeller: number;          // centimes (ce que touche le vendeur)
  paymentStatus: 'succeeded' | 'refunded';
  transferState: string;         // held | releasing | released | reversed | failed | not_applicable
  disputeStatus: string | null;  // open | resolved_* | null
  releaseDueAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface SellerPaymentsSummary {
  totalReleased: number; // centimes déjà versés
  totalPending: number;  // centimes en séquestre (en attente de versement)
}

// Déjà versé sur le compte Stripe du vendeur (released) ou versement immédiat
// legacy (not_applicable). On exclut les remboursés.
export function isReleased(p: SellerPayment): boolean {
  return p.paymentStatus !== 'refunded'
    && (p.transferState === 'released' || p.transferState === 'not_applicable');
}
// Fonds encaissés mais bloqués en séquestre, en attente de validation.
export function isInEscrow(p: SellerPayment): boolean {
  return p.paymentStatus !== 'refunded'
    && (p.transferState === 'held' || p.transferState === 'releasing');
}

export function useMySellerPayments() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [payments, setPayments] = useState<SellerPayment[]>([]);
  const [summary, setSummary] = useState<SellerPaymentsSummary>({ totalReleased: 0, totalPending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) { setLoading(false); setError(true); return; }
    setLoading(true);
    setError(false);
    const { data, error: err } = await supabase
      .from('payments')
      .select(
        'id, type, amount_seller_ht, payment_status, transfer_state, dispute_status, ' +
          'release_due_at, paid_at, created_at',
      )
      .eq('seller_id', userId)
      .in('payment_status', ['succeeded', 'refunded'])
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (err || !data) { setError(true); setLoading(false); return; }

    const list: SellerPayment[] = (data as any[]).map((r) => ({
      id: r.id,
      type: r.type,
      amountSeller: r.amount_seller_ht ?? 0,
      paymentStatus: r.payment_status,
      transferState: r.transfer_state ?? 'not_applicable',
      disputeStatus: r.dispute_status,
      releaseDueAt: r.release_due_at,
      paidAt: r.paid_at,
      createdAt: r.created_at,
    }));

    let totalReleased = 0;
    let totalPending = 0;
    for (const p of list) {
      if (p.paymentStatus === 'refunded') continue; // ne compte pas dans les gains
      if (isReleased(p)) totalReleased += p.amountSeller;
      else if (isInEscrow(p)) totalPending += p.amountSeller;
    }

    setPayments(list);
    setSummary({ totalReleased, totalPending });
    setLoading(false);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  return { payments, summary, loading, error, reload };
}
