import { useCallback, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { userStore } from '../data/store';
import { StageReservation } from '../types/service';
import { getAuthToken } from '../utils/supabaseAuth';
import { createNotification } from './useNotifications';
import { supabase } from '../lib/supabase';
import { trackFunnel } from '../lib/analytics';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Paiement d'une réservation de stage acceptée — mirror de useCoursePayment.
 *
 * Appelle l'Edge Function create-checkout-session avec type='stage', notifie
 * le coach, puis redirige vers Stripe (window.location sur web pour éviter le
 * blocage popup).
 *
 * Au clic « Payer », la réservation passe accepted → awaiting_payment AVANT la
 * redirection Stripe (aligne Stage sur Box/Transport — escrow mig 062/063 :
 * awaiting_payment consomme la place, le cron 055 l'expire en cancelled après
 * 24h d'abandon Stripe). Le webhook posera `paid` à la confirmation. On ne
 * touche JAMAIS paid/completed/cancelled ici : la garde `.in('status', [...])`
 * restreint l'écriture aux transitions accepted→awaiting_payment et
 * awaiting_payment→awaiting_payment (relance idempotente).
 *
 * Pas de header `apikey` : l'Edge Function n'autorise que Content-Type +
 * Authorization en CORS (cf. fix Lot 2 #12 box).
 */
export function useStagePayment() {
  const [loading, setLoading] = useState(false);

  const payStage = useCallback(async (reservation: StageReservation) => {
    try {
      setLoading(true);

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        Alert.alert('Erreur', 'Configuration Supabase manquante');
        return;
      }

      const userToken = await getAuthToken();
      if (!userToken) {
        Alert.alert('Erreur', 'Session expirée, veuillez vous reconnecter');
        return;
      }

      // Funnel Lot 3 : lancement du checkout Stripe (étape open_checkout).
      trackFunnel('payment', 'open_checkout', {
        module: 'stage', reservation_id: reservation.id,
        seller_id: reservation.coachId, amount: Math.round(reservation.prixTotal * 100),
      });

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            type: 'stage',
            reservationId: reservation.id,
            amount: reservation.prixTotal,
            description: `Stage "${reservation.stageTitre}" · ${reservation.nombreParticipants} participant${reservation.nombreParticipants > 1 ? 's' : ''}`,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Edge Function error:', errorData);
        Alert.alert('Erreur', 'Impossible de créer la session de paiement');
        return;
      }

      const data = await response.json();
      if (!data.checkoutUrl) {
        Alert.alert('Erreur', 'URL de paiement non disponible: ' + (data.error || 'Unknown error'));
        return;
      }

      // accepted → awaiting_payment avant la redirection Stripe (mirror box :
      // pending-box-payments.tsx). Non bloquant : si l'UPDATE échoue, le webhook
      // posera `paid` indépendamment. La garde `.in('status', [...])` empêche
      // tout écrasement de paid/completed/cancelled (ne transitionne que depuis
      // accepted ou awaiting_payment — relance idempotente).
      const { error: statutErr } = await supabase
        .from('stage_reservations')
        .update({ status: 'awaiting_payment', updated_at: new Date().toISOString() })
        .eq('id', reservation.id)
        .in('status', ['accepted', 'awaiting_payment']);
      if (statutErr) {
        console.warn('[useStagePayment] update awaiting_payment a échoué (non bloquant):', statutErr.message);
      }

      // Pas de `prix` ici : ce serait le TTC cavalier (commission incluse) que
      // le coach ne doit pas voir. Le webhook bascule cette notif en
      // « 💰 Paiement reçu » avec le montant NET seller dès confirmation
      // Stripe (match via stageReservationId).
      await createNotification({
        destinataireId: reservation.coachId,
        type: 'stage_reservation',
        titre: '💳 Paiement en cours',
        message: `${userStore.nom} procède au paiement pour "${reservation.stageTitre}"`,
        status: 'pending',
        donnees: { stageTitre: reservation.stageTitre, stageReservationId: reservation.id },
      });

      if (Platform.OS === 'web') {
        window.location.href = data.checkoutUrl;
      } else {
        await Linking.openURL(data.checkoutUrl);
      }
    } catch (error) {
      console.error('Stage payment error:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'initiation du paiement');
    } finally {
      setLoading(false);
    }
  }, []);

  return { payStage, loading };
}
