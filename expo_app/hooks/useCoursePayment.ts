import { useCallback, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { userStore } from '../data/store';
import { CourseDemande } from '../types/service';
import { getAuthToken } from '../utils/supabaseAuth';
import { createNotification } from './useNotifications';
import { useMyCourseDemands } from './useCourseDemands';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Paiement d'une demande de cours acceptée — point unique partagé entre
 * l'écran /pending-payments et la carte de notification « Payer maintenant ».
 *
 * Appelle l'Edge Function create-checkout-session, marque la demande
 * `awaiting_payment`, notifie le coach, puis redirige vers Stripe (window.location
 * sur web pour éviter le blocage popup — cf. fix dcc0fdb).
 */
export function useCoursePayment() {
  const { updateStatus } = useMyCourseDemands();
  const [loading, setLoading] = useState(false);

  const payCourse = useCallback(async (demand: CourseDemande) => {
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
          // Pas de header `apikey` : la fonction Edge n'autorise que
          // Content-Type + Authorization en CORS (sinon le preflight navigateur
          // est bloqué). Le JWT utilisateur dans Authorization suffit au gateway.
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
          body: JSON.stringify({ type: 'course', demandId: demand.id }),
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

      await updateStatus(demand.id, 'awaiting_payment');

      await createNotification({
        destinataireId: demand.coachId,
        type: 'course_request',
        titre: '💳 Paiement en cours',
        message: `${userStore.nom} procède au paiement pour "${demand.annonceTitre}"`,
        status: 'pending',
        donnees: { annonceTitre: demand.annonceTitre, prix: demand.prix },
      });

      // Sur web, window.location évite le blocage popup (Linking.openURL =
      // window.open('_blank') après await => bloqué par le navigateur).
      if (Platform.OS === 'web') {
        window.location.href = data.checkoutUrl;
      } else {
        await Linking.openURL(data.checkoutUrl);
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'initiation du paiement');
    } finally {
      setLoading(false);
    }
  }, [updateStatus]);

  return { payCourse, loading };
}
