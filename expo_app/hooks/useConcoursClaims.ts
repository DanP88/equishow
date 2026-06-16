// ─────────────────────────────────────────────────────────────────────────────
// useConcoursClaims — LOT Organisateur P0 (mig 076).
// Revendication d'un concours par un organisateur, validée par un admin.
// Ownership = ligne `concours_claims` status='approved' (cf. 076).
// RLS : insert own / select own+admin / update admin. Aucune écriture sur
// concours.organisateur_id (décision lot : ownership 100% dans concours_claims).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { createNotification } from './useNotifications';

export type ClaimStatus = 'pending' | 'approved' | 'rejected';

export interface ConcoursClaim {
  id: string;
  concoursId: string;
  organisateurId: string;
  status: ClaimStatus;
  justification: string | null;
  organisateurNom: string | null;
  concoursNom: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

function rowToClaim(r: any): ConcoursClaim {
  return {
    id: r.id,
    concoursId: r.concours_id,
    organisateurId: r.organisateur_id,
    status: r.status,
    justification: r.justification ?? null,
    organisateurNom: r.organisateur_nom ?? null,
    concoursNom: r.concours_nom ?? null,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at ?? null,
  };
}

// Revendications de l'organisateur courant (tous statuts).
export function useMyConcoursClaims() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [claims, setClaims] = useState<ConcoursClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setClaims([]); setIsLoading(false); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('concours_claims')
      .select('*')
      .eq('organisateur_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) setClaims(data.map(rowToClaim));
    setIsLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  return { claims, isLoading, reload: load };
}

// Compteur des revendications en attente (badge admin). concours_claims n'est
// pas en realtime → le recompte se fait au focus (cf. admin-settings).
export function useOpenConcoursClaimsCount() {
  const [count, setCount] = useState(0);

  const reload = useCallback(async () => {
    const { count: c, error } = await supabase
      .from('concours_claims')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (!error) setCount(c ?? 0);
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { count, reload };
}

// Soumission d'une revendication (snapshots nom org + nom concours pour l'admin).
export async function submitConcoursClaim(input: {
  concoursId: string;
  concoursNom?: string | null;
  justification?: string | null;
  organisateurNom?: string | null;
}): Promise<{ error: string | null }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { error: 'Non authentifié' };
  const { error } = await supabase.from('concours_claims').insert({
    concours_id: input.concoursId,
    organisateur_id: uid,
    status: 'pending',
    justification: input.justification ?? null,
    organisateur_nom: input.organisateurNom ?? null,
    concours_nom: input.concoursNom ?? null,
  });
  return { error: error?.message ?? null };
}

// Vue admin : toutes les revendications + action de revue (approve/reject).
export function useAdminConcoursClaims() {
  const [claims, setClaims] = useState<ConcoursClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('concours_claims')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setClaims(data.map(rowToClaim));
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const review = useCallback(async (id: string, status: 'approved' | 'rejected'): Promise<{ error: string | null }> => {
    const { data: auth } = await supabase.auth.getUser();
    const claim = claims.find((c) => c.id === id);
    const { error } = await supabase
      .from('concours_claims')
      .update({ status, reviewed_by: auth.user?.id ?? null })
      .eq('id', id);
    if (error) return { error: error.message };

    // PART 2 — notifier l'organisateur (réutilise le système notif existant ;
    // type 'reservation_request' = type plein déjà autorisé par notifications_type_check,
    // SANS status donc rendu titre/message seul). Best-effort : n'échoue jamais la revue.
    if (claim) {
      const nom = claim.concoursNom ?? 'concours';
      const notif = status === 'approved'
        ? {
            titre: '🏆 Revendication approuvée',
            message: `Votre revendication du concours « ${nom} » a été approuvée.\nLe Radar de demande est maintenant disponible.`,
          }
        : {
            titre: '❌ Revendication refusée',
            message: `Votre revendication du concours « ${nom} » n'a pas été approuvée.`,
          };
      const { error: nErr } = await createNotification({
        destinataireId: claim.organisateurId,
        type: 'reservation_request',
        titre: notif.titre,
        message: notif.message,
        actionUrl: '/(tabs)/org-concours',
        donnees: { concours_id: claim.concoursId, claim_id: claim.id, kind: 'concours_claim_review' },
      });
      if (nErr) console.warn('[claim-notif] notification non envoyée:', nErr);
    }

    await load();
    return { error: null };
  }, [load, claims]);

  return { claims, isLoading, reload: load, review };
}
