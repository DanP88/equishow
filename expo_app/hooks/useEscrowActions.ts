import { useCallback, useState } from 'react';
import { getAuthToken } from '../utils/supabaseAuth';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

// Résultat brut d'une action séquestre. La confirmation et les messages de
// succès/erreur sont gérés par l'UI (modales stylées de l'app), pas ici — ce
// hook ne fait QUE l'appel réseau.
export interface EscrowActionResult {
  ok: boolean;
  code?: string; // 'no_token' | 'network' | code d'erreur renvoyé par la fonction
}

async function callFn(path: string, body: unknown): Promise<EscrowActionResult> {
  const token = await getAuthToken();
  if (!token) return { ok: false, code: 'no_token' };
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    let data: any = {};
    try { data = await resp.json(); } catch { /* noop */ }
    return resp.ok ? { ok: true } : { ok: false, code: data?.error ?? 'inconnu' };
  } catch {
    return { ok: false, code: 'network' };
  }
}

/**
 * Actions séquestre (escrow) côté acheteur — appels réseau uniquement.
 * - releasePayment : libère les fonds au vendeur (release-payment). Release
 *   ANTICIPÉ optionnel : sinon le cron libère automatiquement à release_due_at.
 * - openDispute : ouvre un litige interne (manage-dispute) → bloque le versement
 *   le temps qu'un admin vérifie.
 * Renvoie { ok, code } ; l'appelant affiche la confirmation/résultat.
 */
export function useEscrowActions() {
  const [loading, setLoading] = useState(false);

  const releasePayment = useCallback(async (paymentId: string): Promise<EscrowActionResult> => {
    try {
      setLoading(true);
      return await callFn('release-payment', { payment_id: paymentId });
    } finally {
      setLoading(false);
    }
  }, []);

  const openDispute = useCallback(async (paymentId: string): Promise<EscrowActionResult> => {
    try {
      setLoading(true);
      return await callFn('manage-dispute', {
        payment_id: paymentId,
        action: 'open',
        reason: 'Problème signalé par l\'acheteur depuis l\'app',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return { releasePayment, openDispute, loading };
}
