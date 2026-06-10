import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

// ── Types ───────────────────────────────────────────────────────────────────
export type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportRequester {
  prenom: string | null;
  nom: string | null;
  pseudo: string | null;
}

export interface SupportRequest {
  id: string;
  ref: string;
  userId: string;
  reservationRef: string | null;
  reservationType: string | null;
  category: string;
  subject: string;
  description: string;
  status: SupportStatus;
  assignedAdmin: string | null;
  resolutionMessage: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  requester: SupportRequester | null;
}

interface SupportRow {
  id: string;
  ref: string;
  user_id: string;
  reservation_ref: string | null;
  reservation_type: string | null;
  category: string;
  subject: string;
  description: string;
  status: SupportStatus;
  assigned_admin: string | null;
  resolution_message: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  requester?: SupportRequester | SupportRequester[] | null;
}

function rowToSupport(r: SupportRow): SupportRequest {
  const req = Array.isArray(r.requester) ? r.requester[0] ?? null : r.requester ?? null;
  return {
    id: r.id,
    ref: r.ref,
    userId: r.user_id,
    reservationRef: r.reservation_ref,
    reservationType: r.reservation_type,
    category: r.category,
    subject: r.subject,
    description: r.description,
    status: r.status,
    assignedAdmin: r.assigned_admin,
    resolutionMessage: r.resolution_message,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    resolvedAt: r.resolved_at,
    requester: req,
  };
}

const SELECT_OWN =
  'id, ref, user_id, reservation_ref, reservation_type, category, subject, description, status, assigned_admin, resolution_message, created_at, updated_at, resolved_at';
const SELECT_ADMIN =
  `${SELECT_OWN}, requester:users!support_requests_user_id_fkey(prenom, nom, pseudo)`;

// ── Hook user : ses propres tickets ─────────────────────────────────────────
export function useSupportRequests() {
  const [items, setItems] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('support_requests')
      .select(SELECT_OWN)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setItems(((data ?? []) as SupportRow[]).map(rowToSupport));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, loading, error, refresh };
}

// ── Hook admin : tous les tickets + actions ─────────────────────────────────
export function useAdminSupportRequests(statusFilter?: SupportStatus | 'all') {
  const { profile } = useAuth();
  const [items, setItems] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    let q = supabase
      .from('support_requests')
      .select(SELECT_ADMIN)
      .order('created_at', { ascending: false });
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data, error } = await q;
    if (error) setError(error.message);
    else setItems(((data ?? []) as SupportRow[]).map(rowToSupport));
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  // Passe le ticket en cours de traitement (+ assignation à l'admin courant).
  const markInProgress = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from('support_requests')
      .update({ status: 'in_progress', assigned_admin: profile?.id ?? null })
      .eq('id', id);
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }, [profile?.id, refresh]);

  // Résout le ticket → le trigger DB notifie l'utilisateur (support_resolved).
  const resolve = useCallback(
    async (id: string, resolutionMessage: string): Promise<{ error: string | null }> => {
      const msg = resolutionMessage.trim();
      if (!msg) return { error: 'Message de résolution requis.' };
      const { error } = await supabase
        .from('support_requests')
        .update({
          status: 'resolved',
          resolution_message: msg,
          assigned_admin: profile?.id ?? null,
        })
        .eq('id', id);
      if (!error) await refresh();
      return { error: error?.message ?? null };
    },
    [profile?.id, refresh],
  );

  return { items, loading, error, refresh, markInProgress, resolve };
}

// ── Compteur tickets ouverts (badge admin-settings) ─────────────────────────
export function useOpenSupportCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const { count: c } = await supabase
      .from('support_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']);
    setCount(c ?? 0);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { count, refresh };
}
