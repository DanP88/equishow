import { useCallback, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { userStore } from '../data/store';
import { StageReservation } from '../types/service';
import { getAuthToken } from '../utils/supabaseAuth';
import { createNotification } from './useNotifications';
import { useMyStageReservations } from './useStages';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Paiement d'une réservation de stage acceptée — mirror de useCoursePayment.
 *
 * Appelle l'Edge Function create-checkout-session avec type='stage', marque
 * la réservation `awaiting_payment`, notifie le coach, puis redirige vers
 * Stripe (window.location sur web pour éviter le blocage popup).
 *
 * Pas de header `apikey` : l'Edge Function n'autorise que Content-Type +
 * Authorization en CORS (cf. fix Lot 2 #12 box).
 */
export function useStagePayment() {
  const { updateStatus } = useMyStageReservations();
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
            description: `Stage "${reservation.stageTitre}" · ${reservation.nbParticipants} participant${reservation.nbParticipants > 1 ? 's' : ''}`,
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

      await updateStatus(reservation.id, 'awaiting_payment');

      await createNotification({
        destinataireId: reservation.coachId,
        type: 'stage_reservation',
        titre: '💳 Paiement en cours',
        message: `${userStore.nom} procède au paiement pour "${reservation.stageTitre}"`,
        status: 'pending',
        donnees: { stageTitre: reservation.stageTitre, prix: reservation.prixTotal },
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
  }, [updateStatus]);

  return { payStage, loading };
}
