// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/boxPayments — BOX-5B : branchement V2 sur le paiement Box
// existant (create-checkout-session, webhook-stripe, escrow — AUCUN de ces
// fichiers n'est touché ni dupliqué ici).
//
// Portée stricte : lecture des box_reservations issues du parcours recherche
// (recherche_id IS NOT NULL) pour le cavalier connecté + appel de l'Edge
// Function EXISTANTE create-checkout-session, à l'identique du contrat déjà
// utilisé par expo_app/app/pending-box-payments.tsx (audité avant d'écrire ce
// fichier — même endpoint, mêmes headers, même body minimal, même réponse).
//
// AUCUN calcul de prix/commission ici — price_total_ht/platform_commission/
// price_total_ttc sont lus tels quels depuis box_reservations (déjà
// autoritaires, triggers 051/104). AUCUNE écriture directe `payments`.
// AUCUNE écriture pouvant poser `status='paid'` — seule transition écrite ici
// est `accepted→awaiting_payment`, EXACTEMENT le même mécanisme best-effort
// que pending-box-payments.tsx (non bloquant, le webhook reste seul maître de
// `paid`). Le montant N'EST PAS envoyé au serveur (contrairement à
// paiement-box.tsx, V1, qui en envoie un — vérifié : create-checkout-session
// ne lit jamais `body.amount`, il est donc volontairement omis ici).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { getAuthToken } from '../../utils/supabaseAuth';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

export type BoxRechercheReservationStatus =
  | 'accepted' | 'awaiting_payment' | 'paid' | 'completed'
  | 'payment_expired' | 'cancelled' | 'rejected' | 'pending';

export interface MyBoxRechercheReservation {
  id: string;
  status: BoxRechercheReservationStatus;
  lieu: string | null;
  dateDebut: string;
  dateFin: string;
  nbNuits: number;
  prixTotalHT: number;
  platformCommission: number;
  prixTotalTTC: number;
  chevalId: string | null;
  chevalNom: string | null;
  rechercheId: string;
  createdAt: string;
}

interface ReservationRow {
  id: string;
  status: string;
  lieu: string | null;
  date_debut: string;
  date_fin: string;
  nb_nuits: number;
  price_total_ht: number;
  platform_commission: number;
  price_total_ttc: number;
  cheval_id: string | null;
  recherche_id: string;
  created_at: string;
  cheval: { id: string; nom: string } | { id: string; nom: string }[] | null;
}

function rowToReservation(row: ReservationRow): MyBoxRechercheReservation {
  const cheval = Array.isArray(row.cheval) ? row.cheval[0] : row.cheval;
  return {
    id: row.id,
    status: row.status as BoxRechercheReservationStatus,
    lieu: row.lieu,
    dateDebut: row.date_debut,
    dateFin: row.date_fin,
    nbNuits: row.nb_nuits,
    prixTotalHT: Number(row.price_total_ht),
    platformCommission: Number(row.platform_commission),
    prixTotalTTC: Number(row.price_total_ttc),
    chevalId: row.cheval_id,
    chevalNom: cheval?.nom ?? null,
    rechercheId: row.recherche_id,
    createdAt: row.created_at,
  };
}

/**
 * BOX-5B — box_reservations issues du parcours recherche (recherche_id NOT
 * NULL) pour le cavalier connecté. Réutilise le realtime déjà actif sur
 * box_reservations (aucun nouveau canal indépendant côté Mes Box — celui-ci
 * est dédié à ce composant spécifique, cohérent avec le pattern déjà en
 * place pour useMyBoxRecherchesReponses).
 */
export function useMyBoxRechercheReservations() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<MyBoxRechercheReservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) { setList([]); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('box_reservations')
      .select('id, status, lieu, date_debut, date_fin, nb_nuits, price_total_ht, platform_commission, price_total_ttc, cheval_id, recherche_id, created_at, cheval:chevaux(id, nom)')
      .eq('buyer_id', profile.id)
      .not('recherche_id', 'is', null)
      .order('created_at', { ascending: false });
    if (!error) setList(((data ?? []) as unknown as ReservationRow[]).map(rowToReservation));
    setIsLoading(false);
  }, [profile?.id]);

  useAutoRefresh(load);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`box-recherche-reservations-mine-${profile.id}-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'box_reservations', filter: `buyer_id=eq.${profile.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, load]);

  return { reservations: list, isLoading, reload: load };
}

export interface CreateBoxCheckoutResult {
  checkoutUrl: string | null;
  paymentId: string | null;
  error: string | null;
}

/**
 * BOX-5B — appelle EXCLUSIVEMENT l'Edge Function existante create-checkout-
 * session (logique métier/montants/escrow non modifiés). Body réduit au
 * strict nécessaire : `type`+`reservationId`+`description` — pas de montant
 * (jamais lu côté serveur), pas de buyer/seller (dérivés de la ligne + du JWT
 * côté serveur). Le serveur reste l'unique source de vérité sur le prix.
 *
 * PAY-RETURN-1 : `platform` indique seulement web|native au serveur, qui
 * choisit lui-même entre 2 paires d'URLs de retour fixes (jamais une URL
 * fournie par le client — cf. create-checkout-session/index.ts).
 */
export async function createBoxCheckoutSession(
  reservationId: string,
  description?: string,
): Promise<CreateBoxCheckoutResult> {
  // Session potentiellement ancienne (attente entre 2 essais, etc.) →
  // getAuthToken() renverrait un token expiré en cache et le serveur
  // rejetterait en 401 "Unauthorized". Même mécanisme que checkout-success.tsx
  // (V1) pour la même raison. Best-effort : si le refresh échoue, on tente
  // quand même avec le token en cache plutôt que de bloquer.
  try {
    await supabase.auth.refreshSession();
  } catch { /* best-effort */ }

  const token = await getAuthToken();
  if (!token) return { checkoutUrl: null, paymentId: null, error: 'Session expirée, reconnecte-toi.' };
  if (!SUPABASE_URL) return { checkoutUrl: null, paymentId: null, error: 'Configuration Supabase manquante.' };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'box',
        reservationId,
        description,
        platform: Platform.OS === 'web' ? 'web' : 'native',
      }),
    });
    const data = await response.json();
    if (!response.ok || !data?.checkoutUrl) {
      return { checkoutUrl: null, paymentId: null, error: data?.error ?? 'Impossible de créer la session de paiement.' };
    }
    return { checkoutUrl: data.checkoutUrl, paymentId: data.paymentId ?? null, error: null };
  } catch (e) {
    return { checkoutUrl: null, paymentId: null, error: e instanceof Error ? e.message : 'Erreur réseau.' };
  }
}

/**
 * BOX-5B — même transition best-effort `accepted→awaiting_payment` que
 * pending-box-payments.tsx (V1) : écrite APRÈS la création réussie de la
 * session Stripe, jamais bloquante (le webhook pose `paid` indépendamment de
 * ce passage). `awaiting_payment` n'est PAS un statut gardé par le trigger
 * 047 — transition libre, comme en V1. Ne pose JAMAIS `paid`.
 */
export async function markBoxReservationAwaitingPayment(reservationId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('box_reservations')
    .update({ status: 'awaiting_payment' })
    .eq('id', reservationId);
  return { error: error?.message ?? null };
}

/**
 * Ouvre l'URL Stripe Checkout.
 * Web : inchangé (window.location.href, évite le blocage popup).
 * Natif (PAY-RETURN-1) : `openAuthSessionAsync` au lieu de `Linking.openURL`
 * simple — ouvre Stripe dans une session navigateur contrôlée par l'app et
 * referme automatiquement celle-ci quand Stripe redirige vers l'URL native
 * (succès OU annulation — le serveur pointe les deux sur `equishow://box/
 * mes-box`, cf. create-checkout-session ; jamais un écran V1). Le résultat de
 * cet appel n'est JAMAIS utilisé comme preuve de paiement — il signale
 * seulement que l'utilisateur est revenu dans l'app ; l'appelant recharge
 * l'état réel depuis Supabase (le webhook Stripe reste l'unique source de
 * vérité de `paid`). `createURL('box/mes-box')` DOIT rester identique au path
 * codé en dur côté serveur (matching par préfixe complet sur Android, cf.
 * audit PAY-RETURN-1B).
 */
export async function openCheckoutUrl(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.location.href = url;
    return;
  }
  await WebBrowser.openAuthSessionAsync(url, ExpoLinking.createURL('box/mes-box'));
}
