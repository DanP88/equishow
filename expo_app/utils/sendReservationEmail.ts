import { getAuthToken } from './supabaseAuth';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

export type ReservationEmailModule = 'course' | 'stage' | 'transport' | 'box';

/**
 * Déclenche l'email « réservation confirmée » (aux 2 parties) via l'Edge
 * Function send-reservation-email, après qu'un vendeur a validé une demande.
 *
 * Best-effort : ne lève jamais et ne bloque jamais le flux d'acceptation.
 * Pas de header `apikey` (la fonction n'autorise que Content-Type + Authorization
 * en CORS — cf. fix checkout). Le JWT utilisateur suffit.
 */
export async function sendReservationEmail(
  module: ReservationEmailModule,
  reservationId: string,
): Promise<void> {
  try {
    if (!SUPABASE_URL) return;
    const token = await getAuthToken();
    if (!token) return;
    await fetch(`${SUPABASE_URL}/functions/v1/send-reservation-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ module, reservationId }),
    });
  } catch (e) {
    console.warn('sendReservationEmail (non bloquant):', e);
  }
}
