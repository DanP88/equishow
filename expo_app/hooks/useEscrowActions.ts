import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { getAuthToken } from '../utils/supabaseAuth';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

// Confirmation cross-platform (window.confirm sur web, Alert sur natif).
function confirmAsync(title: string, message: string, okLabel = 'Confirmer'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, onPress: () => resolve(true) },
    ]);
  });
}

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

async function callFn(path: string, body: unknown): Promise<{ ok: boolean; data: any }> {
  const token = await getAuthToken();
  if (!token) {
    notify('Session expirée', 'Veuillez vous reconnecter.');
    return { ok: false, data: { error: 'no_token' } };
  }
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  let data: any = {};
  try { data = await resp.json(); } catch { /* noop */ }
  return { ok: resp.ok, data };
}

/**
 * Actions séquestre (escrow) côté acheteur.
 * - confirmPrestation : libère les fonds au vendeur (release-payment). Release
 *   ANTICIPÉ optionnel : sinon le cron libère automatiquement à release_due_at.
 * - openDispute : ouvre un litige interne (manage-dispute) → bloque le versement
 *   le temps qu'un admin vérifie.
 * Renvoie true si l'action a réussi (pour rafraîchir l'appelant).
 */
export function useEscrowActions() {
  const [loading, setLoading] = useState(false);

  const confirmPrestation = useCallback(async (paymentId: string): Promise<boolean> => {
    const ok = await confirmAsync(
      'Libérer le paiement',
      'Confirmez-vous avoir bien reçu la prestation ? Les fonds seront versés au vendeur. Cette action est définitive.',
      'Oui, libérer',
    );
    if (!ok) return false;
    try {
      setLoading(true);
      const res = await callFn('release-payment', { payment_id: paymentId });
      if (res.ok) {
        notify('Paiement libéré', 'Le vendeur va recevoir son versement. Merci !');
        return true;
      }
      const code = res.data?.error ?? 'inconnu';
      notify('Action impossible', `Le versement n'a pas pu être libéré (${code}).`);
      return false;
    } catch {
      notify('Erreur', 'Une erreur réseau est survenue.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const openDispute = useCallback(async (paymentId: string): Promise<boolean> => {
    const ok = await confirmAsync(
      'Signaler un problème',
      'Un litige sera ouvert et le versement au vendeur bloqué, le temps qu\'un administrateur vérifie la situation. Continuer ?',
      'Ouvrir un litige',
    );
    if (!ok) return false;
    try {
      setLoading(true);
      const res = await callFn('manage-dispute', {
        payment_id: paymentId,
        action: 'open',
        reason: 'Problème signalé par l\'acheteur depuis l\'app',
      });
      if (res.ok) {
        notify('Litige ouvert', 'Le versement est bloqué. Un administrateur va examiner votre signalement.');
        return true;
      }
      const code = res.data?.error ?? 'inconnu';
      notify('Action impossible', `Le litige n'a pas pu être ouvert (${code}).`);
      return false;
    } catch {
      notify('Erreur', 'Une erreur réseau est survenue.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { confirmPrestation, openDispute, loading };
}
