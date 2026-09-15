// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/admin — espace ADMIN V2, moteurs réels V1 (LECTURE + ÉCRITURE).
//
// Contrairement aux autres adapters V2 (cavalier/coach/organisateur), l'admin
// n'a PAS de mode démo/simulé : les actions (remboursement, résolution de
// litige, réponse à une réclamation) sont RÉELLES dès la V2 — mêmes hooks/
// Edge Functions/RLS que V1. 0 nouvel objet backend (0 migration/RPC/trigger).
// Voir BACKEND_OWNERSHIP.md : SHARED.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useEscrowActions, type EscrowActionResult } from '../../hooks/useEscrowActions';
import { useOpenSupportCount } from '../../hooks/useSupportRequests';
import { useNotifications } from '../../hooks/useNotifications';
import { selectActiveNotifications } from '../../hooks/useActiveNotifications';
import { userStore } from '../../data/store';

// ── Litiges (payment_disputes, status='open') ───────────────────────────────

interface UserMini {
  id: string;
  prenom: string | null;
  nom: string | null;
  pseudo: string | null;
  avatar_color: string | null;
  initiales: string | null;
}

export interface AdminDisputeRow {
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

export function useV2AdminDisputes() {
  const [disputes, setDisputes] = useState<AdminDisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { releasePayment, resolveDispute, refundPayment, loading: actionLoading } = useEscrowActions();

  const load = useCallback(async () => {
    setError(null);
    try {
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
      const list = (rawDisputes ?? []) as unknown as Omit<AdminDisputeRow, 'buyer' | 'seller'>[];

      const userIds = Array.from(new Set(
        list.flatMap((d) => [d.payment.buyer_id, d.payment.seller_id]).filter(Boolean),
      ));
      let usersById = new Map<string, UserMini>();
      if (userIds.length > 0) {
        const { data: users, error: usersErr } = await supabase
          .from('users_public')
          .select('id, prenom, nom, pseudo, avatar_color, initiales')
          .in('id', userIds);
        if (usersErr) throw usersErr;
        usersById = new Map((users ?? []).map((u) => [u.id, u as UserMini]));
      }

      setDisputes(list.map((d) => ({
        ...d,
        buyer: usersById.get(d.payment.buyer_id) ?? null,
        seller: usersById.get(d.payment.seller_id) ?? null,
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement litiges');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Résout en faveur du vendeur : clôt le litige puis libère les fonds. */
  const resolveRelease = useCallback(async (d: AdminDisputeRow) => {
    const r1 = await resolveDispute(d.payment_id, 'release');
    if (!r1.ok) return { ok: false, code: r1.code, stage: 'resolve' as const };
    const r2 = await releasePayment(d.payment_id);
    await load();
    if (!r2.ok) return { ok: false, code: r2.code, stage: 'release' as const };
    return { ok: true } as const;
  }, [resolveDispute, releasePayment, load]);

  /** Rembourse l'acheteur (Stripe réel + reversal si déjà versé) puis clôt le litige. */
  const resolveRefund = useCallback(async (d: AdminDisputeRow) => {
    const r1 = await refundPayment(d.payment_id);
    if (!r1.ok) return { ok: false, code: r1.code, stage: 'refund' as const };
    const r2 = await resolveDispute(d.payment_id, 'refund');
    await load();
    if (!r2.ok) return { ok: true, code: r2.code, stage: 'resolve' as const };
    return { ok: true } as const;
  }, [refundPayment, resolveDispute, load]);

  return { disputes, loading, error, refresh: load, actionLoading, resolveRelease, resolveRefund };
}

// ── Analytics (vues mig 070/071 + comportement) ─────────────────────────────

export interface AdminAnalyticsBehavior {
  kpi: {
    pageviews_7d: number | null; dau_7d: number | null; sessions_7d: number | null;
    cta_clicks_7d: number | null; errors_7d: number | null; avg_session_seconds: number | null;
  } | null;
  activeSessions: number;
  topScreens: { screen: string; views: number; unique_users: number; avg_duration_seconds: number | null }[];
  topCtas: { screen: string | null; action: string; clicks: number; unique_users: number }[];
  recentErrors: { id: string; screen: string | null; metadata: { message?: string }; created_at: string }[];
}

export function useV2AdminBehavior() {
  const [data, setData] = useState<AdminAnalyticsBehavior | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [kpiRes, activeRes, screensRes, ctasRes, errorsRes] = await Promise.all([
        supabase.from('v_analytics_kpi_7d').select('*').maybeSingle(),
        supabase.from('v_analytics_active_sessions').select('active_sessions_1h').maybeSingle(),
        supabase.from('v_analytics_top_screens').select('*').limit(15),
        supabase.from('v_analytics_top_ctas').select('*').limit(15),
        supabase.from('v_analytics_recent_errors').select('*'),
      ]);
      if (kpiRes.error) throw kpiRes.error;
      if (activeRes.error) throw activeRes.error;
      if (screensRes.error) throw screensRes.error;
      if (ctasRes.error) throw ctasRes.error;
      if (errorsRes.error) throw errorsRes.error;
      setData({
        kpi: kpiRes.data as AdminAnalyticsBehavior['kpi'],
        activeSessions: (activeRes.data as { active_sessions_1h: number } | null)?.active_sessions_1h ?? 0,
        topScreens: (screensRes.data ?? []) as AdminAnalyticsBehavior['topScreens'],
        topCtas: (ctasRes.data ?? []) as AdminAnalyticsBehavior['topCtas'],
        recentErrors: (errorsRes.data ?? []) as AdminAnalyticsBehavior['recentErrors'],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, refresh: load };
}

// ── Badges bottom bar admin ─────────────────────────────────────────────────

export function useV2AdminBadges() {
  const { count: supportOpen } = useOpenSupportCount();
  const { notifications } = useNotifications();
  const notifUnread = selectActiveNotifications(notifications, {
    courseDemands: [], stageReservations: [], viewerId: userStore.id,
  }).filter((n) => !n.lu).length;
  return { supportOpen, notifUnread };
}

export type { EscrowActionResult };
