import { useCallback, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { userStore } from '../data/store';
import { CourseDemande } from '../types/service';
import { getAuthToken } from '../utils/supabaseAuth';
import { createNotification } from './useNotifications';
import { trackFunnel } from '../lib/analytics';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Paiement d'une demande de cours acceptée — point unique partagé entre
 * l'écran /pending-payments et la carte de notification « Payer maintenant ».
 *
 * Appelle l'Edge Function create-checkout-session, notifie le coach, puis
 * redirige vers Stripe (window.location sur web pour éviter le blocage popup —
 * cf. fix dcc0fdb).
 *
 * Note : la demande reste `accepted` jusqu'au webhook (`paid`). On n'écrit pas
 * `awaiting_payment` côté cours : ce statut est absent du CHECK de
 * course_demands, l'UPDATE échouait silencieusement (audit 2026-06-04).
 */
export function useCoursePayment() {
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

      // Funnel Lot 3 : lancement du checkout Stripe (étape open_checkout).
      trackFunnel('payment', 'open_checkout', {
        module: 'course', reservation_id: demand.id,
        seller_id: demand.coachId, amount: Math.round(demand.prix * 100),
      });

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

      // Pas de `prix` ici : ce serait le TTC cavalier (commission incluse) que
      // le coach ne doit pas voir. Le webhook bascule cette notif en
      // « 💰 Paiement reçu » avec le montant NET seller dès confirmation
      // Stripe (match via courseDemandId).
      await createNotification({
        destinataireId: demand.coachId,
        type: 'course_request',
        titre: '💳 Paiement en cours',
        message: `${userStore.nom} procède au paiement pour "${demand.annonceTitre}"`,
        status: 'pending',
        donnees: { annonceTitre: demand.annonceTitre, courseDemandId: demand.id },
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
  }, []);

  return { payCourse, loading };
}
