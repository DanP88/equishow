// ─────────────────────────────────────────────────────────────────────────────
// useCoachAccess — état de l'essai gratuit Coach (3 premières séances payées).
//
// Lit `payments` du coach courant (RLS : payments_select_parties → seller_id =
// auth.uid()) et calcule l'état d'accès via lib/coachAccess (fonctions pures).
//
// Sécurité produit : FAIL-OPEN. Toute erreur de lecture renvoie un accès complet
// (canAcceptNew = true, badge masqué) — on ne bloque JAMAIS un coach à cause d'un
// bug de lecture. Cavalier / organisateur : hook inerte (isCoach = false).
//
// 100% lecture seule. Aucun impact escrow / réservation / abonnements existants.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import {
  CoachAccess,
  PaymentRowForTrial,
  coachHasPro,
  computeCoachAccess,
  countPaidCoachSessions,
} from '../lib/coachAccess';

export interface UseCoachAccess extends CoachAccess {
  isCoach: boolean;
  loading: boolean;
  error: boolean;     // true si lecture échouée → fail-open
  reload: () => void;
}

export function useCoachAccess(): UseCoachAccess {
  const { profile } = useAuth();
  const isCoach = (profile as any)?.role === 'coach';

  const [paidSessions, setPaidSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const hasPro = coachHasPro((profile as any)?.plan_id, (profile as any)?.plan);

  const load = useCallback(async () => {
    if (!profile?.id || !isCoach) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const { data, error: qErr } = await supabase
        .from('payments')
        .select('type,transfer_state,payment_status,refunded_at,dispute_status')
        .eq('seller_id', profile.id)
        .eq('type', 'course');
      if (qErr) throw qErr;
      setPaidSessions(countPaidCoachSessions((data ?? []) as PaymentRowForTrial[]));
    } catch (e) {
      // FAIL-OPEN : ne jamais bloquer le coach pour une erreur de lecture.
      console.warn('[useCoachAccess] lecture payments échouée (fail-open):', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, isCoach]);

  useEffect(() => { load(); }, [load]);

  // Fail-open : en cas d'erreur, accès complet (hasPro forcé ; badge masqué côté
  // écran via le flag `error`).
  const access = computeCoachAccess({ paidSessions, hasPro: error ? true : hasPro });

  return { ...access, isCoach, loading, error, reload: load };
}
