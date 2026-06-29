// ─────────────────────────────────────────────────────────────────────────────
// useCoachAccess — état de l'essai gratuit Coach (3 premières séances payées)
// + anti-abus multi-comptes (éligibilité d'identité).
//
// Stratégie de lecture :
//   1. RPC serveur `fn_my_coach_trial_status` (mig 087) → compteur + éligibilité
//      anti-abus (doublon Stripe Connect = preuve forte). Source autoritaire.
//   2. Fallback si la RPC n'existe pas encore (mig non appliquée) ou erreur :
//      calcul client depuis `payments` (RLS seller) + éligibilité = true.
//
// Sécurité produit : FAIL-OPEN. On ne bloque JAMAIS un coach sans preuve forte.
// Cavalier / organisateur : hook inerte (isCoach = false).
// 100% lecture (la RPC ne fait qu'un upsert de suivi). 0 impact escrow/réservation.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import {
  CoachAccess,
  PaymentRowForTrial,
  TrialAdminStatus,
  coachHasPro,
  computeCoachAccess,
  countPaidCoachSessions,
} from '../lib/coachAccess';

export interface UseCoachAccess extends CoachAccess {
  isCoach: boolean;
  loading: boolean;
  error: boolean;                  // lecture échouée → fail-open
  adminStatus: TrialAdminStatus;   // statut anti-abus (défaut trial_allowed)
  reload: () => void;
}

// Mémo de session : une fois la RPC serveur détectée absente (mig 086/087 non
// appliquée → PGRST202 / 404), on cesse de la rappeler à chaque montage d'écran.
// Évite de répéter le 404 réseau (bruit console) tant que la migration n'est pas
// appliquée. NE concerne QUE la fonction manquante : une erreur transitoire
// (réseau, timeout) ne désactive pas la RPC et reste visible.
let serverRpcMissing = false;

export function useCoachAccess(): UseCoachAccess {
  const { profile } = useAuth();
  const isCoach = (profile as any)?.role === 'coach';

  const [paidSessions, setPaidSessions] = useState(0);
  const [trialEligible, setTrialEligible] = useState(true);
  const [adminStatus, setAdminStatus] = useState<TrialAdminStatus>('trial_allowed');
  const [serverHasPro, setServerHasPro] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const localHasPro = coachHasPro((profile as any)?.plan_id, (profile as any)?.plan);

  const load = useCallback(async () => {
    if (!profile?.id || !isCoach) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      // 1. Source autoritaire : RPC serveur (compteur + anti-abus).
      //    Sautée si déjà détectée absente cette session (évite un 404 répété).
      if (!serverRpcMissing) {
        const { data, error: rpcErr } = await supabase.rpc('fn_my_coach_trial_status');
        if (!rpcErr && data) {
          const d = data as any;
          setPaidSessions(Number(d.paid_sessions) || 0);
          setTrialEligible(d.trial_eligible !== false);
          setAdminStatus((d.admin_status as TrialAdminStatus) ?? 'trial_allowed');
          setServerHasPro(!!d.has_pro);
          return;
        }
        // RPC inexistante (mig 086/087 non appliquée) : on mémorise pour ne plus
        // la rappeler. PGRST202 = fonction absente ; 404 idem côté PostgREST.
        if (rpcErr && (rpcErr.code === 'PGRST202' || rpcErr.code === '404')) {
          serverRpcMissing = true;
        }
        // (autre erreur RPC = transitoire : on tente quand même le fallback client
        //  ci-dessous, sans désactiver la RPC pour les prochains montages.)
      }
      // 2. Fallback : RPC absente (mig non appliquée) → calcul client, éligible.
      const { data: pays, error: qErr } = await supabase
        .from('payments')
        .select('type,transfer_state,payment_status,refunded_at,dispute_status')
        .eq('seller_id', profile.id)
        .eq('type', 'course');
      if (qErr) throw qErr;
      setPaidSessions(countPaidCoachSessions((pays ?? []) as PaymentRowForTrial[]));
      setTrialEligible(true);
      setAdminStatus('trial_allowed');
      setServerHasPro(null);
    } catch (e) {
      // FAIL-OPEN : ne jamais bloquer le coach pour une erreur de lecture.
      console.warn('[useCoachAccess] lecture échouée (fail-open):', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, isCoach]);

  useEffect(() => { load(); }, [load]);

  const hasPro = serverHasPro ?? localHasPro;
  const access = computeCoachAccess({
    paidSessions,
    hasPro: error ? true : hasPro,        // fail-open
    trialEligible: error ? true : trialEligible,
  });

  return { ...access, isCoach, loading, error, adminStatus, reload: load };
}
