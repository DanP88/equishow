// ─────────────────────────────────────────────────────────────────────────────
// Lot 2 — Marketplace Analytics. Lecture seule des 7 vues d'agrégation
// (migration 070), toutes en security_invoker → RLS admin appliquée.
// Source financière unique = payments (montants en CENTIMES). Le front divise
// par 100 à l'affichage (formatEuros).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface MktRevenue {
  gmv_brut_total_cents: number;
  gmv_brut_7d_cents: number;
  gmv_brut_30d_cents: number;
  gmv_net_total_cents: number;
  gmv_net_7d_cents: number;
  gmv_net_30d_cents: number;
  refunded_total_cents: number;
  refunded_30d_cents: number;
  commissions_total_cents: number;
  commissions_30d_cents: number;
}
export interface MktByType {
  type: 'box' | 'transport' | 'course' | 'stage' | string;
  bookings: number;
  bookings_30d: number;
  gmv_net_cents: number;
  commissions_cents: number;
}
export interface MktReservations {
  reservations_total: number;
  reservations_30d: number;
}
export interface MktPayments {
  payments_succeeded: number;
  payments_failed: number;
  success_rate: number | null;
  avg_basket_cents: number | null;
}
export interface MktSellers {
  active_sellers: number;
  active_onboarded: number;
  active_not_onboarded: number;
}
export interface MktEscrow {
  held_seller_cents: number;
  released_seller_cents: number;
  pending_release_seller_cents: number;
  held_count: number;
  pending_release_count: number;
}
export interface MktDisputes {
  disputes_total: number;
  disputes_open: number;
  dispute_rate: number | null;
  disputed_amount_cents: number;
}

export interface MarketplaceData {
  revenue: MktRevenue | null;
  byType: MktByType[];
  reservations: MktReservations | null;
  payments: MktPayments | null;
  sellers: MktSellers | null;
  escrow: MktEscrow | null;
  disputes: MktDisputes | null;
}

export function useMarketplaceAnalytics() {
  const [data, setData] = useState<MarketplaceData>({
    revenue: null, byType: [], reservations: null,
    payments: null, sellers: null, escrow: null, disputes: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [rev, byType, resv, pay, sellers, escrow, disp] = await Promise.all([
        supabase.from('v_mkt_revenue').select('*').maybeSingle(),
        supabase.from('v_mkt_revenue_by_type').select('*'),
        supabase.from('v_mkt_reservations').select('*').maybeSingle(),
        supabase.from('v_mkt_payments').select('*').maybeSingle(),
        supabase.from('v_mkt_sellers').select('*').maybeSingle(),
        supabase.from('v_mkt_escrow').select('*').maybeSingle(),
        supabase.from('v_mkt_disputes').select('*').maybeSingle(),
      ]);
      const firstErr = [rev, byType, resv, pay, sellers, escrow, disp].find(r => r.error)?.error;
      if (firstErr) throw firstErr;
      setData({
        revenue: (rev.data as MktRevenue | null) ?? null,
        byType: (byType.data ?? []) as MktByType[],
        reservations: (resv.data as MktReservations | null) ?? null,
        payments: (pay.data as MktPayments | null) ?? null,
        sellers: (sellers.data as MktSellers | null) ?? null,
        escrow: (escrow.data as MktEscrow | null) ?? null,
        disputes: (disp.data as MktDisputes | null) ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement marketplace analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
