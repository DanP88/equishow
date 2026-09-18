// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/transportRecherches — LOT 1+2+3 (branchement front V2 → migration 111).
//
// LOT 1 : écriture RÉELLE dans transport_recherches + transport_recherche_chevaux
//   (bouton « Publier ma recherche » de TransportChercheV2).
// LOT 2 : lecture RÉELLE + realtime des recherches 'open' (useOpenTransportRecherches)
//   — affichage seul.
// LOT 3 : réponse RÉELLE d'un offreur à une recherche (useTransportRechercheReponses)
//   — insert transport_recherche_reponses, liée à une VRAIE transport_annonce de
//   l'offreur (RLS trr_insert_own vérifie annonce_id appartient à auth.uid()).
//   Repose sur la publication `supabase_realtime` + REPLICA IDENTITY FULL
//   activées par la migration 112 : sans elle, un DELETE/UPDATE filtré sur une
//   colonne non-PK (ex. concours_id) ne remonterait pas côté abonné.
// LOT 4 : lecture RÉELLE côté demandeur des réponses reçues à SES recherches
//   (useMyTransportRecherchesReponses) — affichage seul dans « Mes transports ».
// LOT 6 : le même hook expose aussi, par recherche, la couverture détaillée
//   PAR CHEVAL (transport_recherche_chevaux × transport_reservation_chevaux ×
//   transport_reservations.statut) — aucun état de couverture stocké ou
//   déduit localement, uniquement recalculé à la lecture depuis ces 3 tables
//   + le statut réel de transport_recherches. Realtime étendu en conséquence.
// LOT 5 : acceptation RÉELLE (partielle ou totale) d'une réponse — sélection des
//   chevaux non couverts de CETTE recherche (fetchAvailableChevauxForRecherche)
//   puis appel EXCLUSIF de la RPC accept_transport_recherche_response (111),
//   seule autorité sur prix/commission/vendeur/capacité/statut de la recherche.
//   Le front ne fait QUE proposer les bons candidats (chevaux membres de la
//   recherche ET non déjà couverts) ; toute règle métier est revérifiée et
//   appliquée côté serveur, jamais recalculée ici.
//
// `chevalIds` DOIT être filtré en amont (côté écran) aux seuls chevaux RÉELS
// (table `chevaux`, src==='real' dans UnifiedHorse) : transport_recherche_
// chevaux.cheval_id porte une FK vers chevaux(id) — un id de cheval local V2
// (v2:chevaux, jamais écrit en base) ferait échouer l'insert avec une
// violation de clé étrangère.
//
// Pas de transaction multi-statements possible via le client REST Supabase :
// si l'insert des chevaux échoue après la création de la recherche, on
// supprime la recherche orpheline (rollback manuel côté client — autorisé
// par tr_delete_own tant qu'aucune réservation n'existe encore dessus).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

export interface CreateRechercheInput {
  concoursId?: string;
  depart?: string;
  destination?: string;
  dateDebut?: string;
  dateFin?: string;
  /** Chevaux RÉELS uniquement (déjà filtrés par l'appelant). Minimum 1. */
  chevalIds: string[];
}

export interface CreateRechercheResult {
  id: string | null;
  error: string | null;
}

export function useTransportRecherches() {
  const { profile } = useAuth();

  const createRecherche = useCallback(
    async (input: CreateRechercheInput): Promise<CreateRechercheResult> => {
      if (!profile?.id) return { id: null, error: 'Non authentifié' };
      if (!input.chevalIds.length) return { id: null, error: 'Sélectionne au moins un cheval.' };

      const { data: recherche, error: rechercheError } = await supabase
        .from('transport_recherches')
        .insert({
          demandeur_id: profile.id,
          concours_id: input.concoursId || null,
          depart: input.depart || null,
          destination: input.destination || null,
          date_debut: input.dateDebut || null,
          date_fin: input.dateFin || null,
        })
        .select('id')
        .single();

      if (rechercheError || !recherche) {
        return { id: null, error: rechercheError?.message ?? 'Erreur lors de la création de la recherche.' };
      }

      const { error: chevauxError } = await supabase
        .from('transport_recherche_chevaux')
        .insert(input.chevalIds.map((chevalId) => ({ recherche_id: recherche.id, cheval_id: chevalId })));

      if (chevauxError) {
        await supabase.from('transport_recherches').delete().eq('id', recherche.id);
        return { id: null, error: chevauxError.message };
      }

      return { id: recherche.id, error: null };
    },
    [profile?.id],
  );

  return { createRecherche };
}

// ── LOT 2 : lecture temps réel des recherches ouvertes ─────────────────────
export interface OpenTransportRecherche {
  id: string;
  demandeurId: string;
  concoursId: string | null;
  concoursNom: string | null;
  depart: string | null;
  destination: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  nbPlaces: number;
  createdAt: string;
}

interface OpenRechercheRow {
  id: string;
  demandeur_id: string;
  concours_id: string | null;
  depart: string | null;
  destination: string | null;
  date_debut: string | null;
  date_fin: string | null;
  nb_places: number;
  created_at: string;
  concours: { nom: string } | { nom: string }[] | null;
}

function rowToOpenRecherche(row: OpenRechercheRow): OpenTransportRecherche {
  const concours = Array.isArray(row.concours) ? row.concours[0] : row.concours;
  return {
    id: row.id,
    demandeurId: row.demandeur_id,
    concoursId: row.concours_id,
    concoursNom: concours?.nom ?? null,
    depart: row.depart,
    destination: row.destination,
    dateDebut: row.date_debut,
    dateFin: row.date_fin,
    nbPlaces: row.nb_places,
    createdAt: row.created_at,
  };
}

/**
 * LOT 2 — recherches Transport 'open' visibles par tout authentifié (RLS
 * tr_select_auth), hors les siennes propres. Lecture seule : aucune réponse,
 * aucune acceptation, aucune écriture. Realtime câblé sur la publication
 * `supabase_realtime` activée par la migration 112 (transport_recherches +
 * transport_recherche_chevaux, cette dernière car nb_places est dérivé par
 * trigger côté 111 — un ajout/retrait de cheval doit rafraîchir la liste).
 */
export function useOpenTransportRecherches() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<OpenTransportRecherche[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error: qErr } = await supabase
      .from('transport_recherches')
      .select('id, demandeur_id, concours_id, depart, destination, date_debut, date_fin, nb_places, created_at, concours:concours_id(nom)')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (qErr) {
      setError(qErr.message);
      setList([]);
    } else {
      setError(null);
      const rows = (data ?? []) as unknown as OpenRechercheRow[];
      setList(rows.map(rowToOpenRecherche).filter((r) => r.demandeurId !== profile?.id));
    }
    setIsLoading(false);
  }, [profile?.id]);

  useAutoRefresh(load);

  useEffect(() => {
    const channel = supabase
      .channel(`transport-recherches-open-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_recherches' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_recherche_chevaux' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, channelId]);

  return { recherches: list, isLoading, error, reload: load };
}

// ── LOT 3 : réponse d'un offreur à une recherche ouverte ────────────────────
export interface TransportRechercheReponse {
  id: string;
  rechercheId: string;
  annonceId: string;
  offreurId: string;
  message: string | null;
  status: 'pending' | 'declined';
  createdAt: string;
}

interface ReponseRow {
  id: string;
  recherche_id: string;
  annonce_id: string;
  offreur_id: string;
  message: string | null;
  status: string;
  created_at: string;
}

function rowToReponse(row: ReponseRow): TransportRechercheReponse {
  return {
    id: row.id,
    rechercheId: row.recherche_id,
    annonceId: row.annonce_id,
    offreurId: row.offreur_id,
    message: row.message,
    status: row.status as 'pending' | 'declined',
    createdAt: row.created_at,
  };
}

export interface RespondToRechercheInput {
  rechercheId: string;
  annonceId: string;
  message?: string;
}

export interface RespondToRechercheResult {
  id: string | null;
  error: string | null;
}

/**
 * LOT 3 — réponses de l'offreur courant à des recherches ouvertes. Expose
 * à la fois la liste (pour savoir à quelles recherches on a déjà répondu —
 * RLS trr_select_parties : l'offreur voit ses propres réponses) et la
 * mutation `respond` (RLS trr_insert_own : offreur_id=auth.uid() ET
 * l'annonce doit réellement lui appartenir ET la recherche doit être
 * encore 'open' ET on ne peut pas répondre à sa propre recherche — tout
 * est revérifié serveur, le front ne fait que proposer les VRAIES annonces
 * de l'utilisateur, jamais un id arbitraire).
 * Pas d'acceptation ici : ça reste une réponse 'pending', lot suivant.
 */
export function useTransportRechercheReponses() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<TransportRechercheReponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) { setList([]); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('transport_recherche_reponses')
      .select('id, recherche_id, annonce_id, offreur_id, message, status, created_at')
      .eq('offreur_id', profile.id);
    if (!error) setList(((data ?? []) as ReponseRow[]).map(rowToReponse));
    setIsLoading(false);
  }, [profile?.id]);

  useAutoRefresh(load);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`transport-recherche-reponses-${profile.id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_recherche_reponses' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, profile?.id, channelId]);

  const respond = useCallback(
    async (input: RespondToRechercheInput): Promise<RespondToRechercheResult> => {
      if (!profile?.id) return { id: null, error: 'Non authentifié' };
      const { data, error } = await supabase
        .from('transport_recherche_reponses')
        .insert({
          recherche_id: input.rechercheId,
          annonce_id: input.annonceId,
          offreur_id: profile.id,
          message: input.message?.trim() || null,
        })
        .select('id')
        .single();
      if (error || !data) {
        return { id: null, error: error?.message ?? 'Erreur lors de l\'envoi de la réponse.' };
      }
      return { id: data.id, error: null };
    },
    [profile?.id],
  );

  return { myReponses: list, isLoading, respond };
}

// ── LOT 4 : réponses reçues par le demandeur sur SES recherches ────────────
export interface ReceivedReponseAnnonce {
  id: string;
  villeDepart: string;
  villeArrivee: string | null;
  dateTrajet: string | null;
  heureDepart: string | null;
  nbPlacesDisponibles: number | null;
  prixHT: number | null;
  pricePerKm: number | null;
}

export interface ReceivedReponse {
  id: string;
  offreurId: string;
  status: 'pending' | 'declined';
  message: string | null;
  createdAt: string;
  annonce: ReceivedReponseAnnonce | null;
}

/** LOT 6 — un cheval du périmètre de la recherche + son état de couverture réel. */
export interface RechercheCoverageCheval {
  id: string;
  nom: string;
  couvert: boolean;
}

export interface MyRechercheWithReponses {
  recherche: OpenTransportRecherche & { status: 'open' | 'matched' | 'cancelled' };
  /** LOT 6 — tous les chevaux de la recherche, chacun avec son état de couverture réel. */
  chevaux: RechercheCoverageCheval[];
  reponses: ReceivedReponse[];
}

interface MyRechercheRow {
  id: string;
  depart: string | null;
  destination: string | null;
  date_debut: string | null;
  date_fin: string | null;
  nb_places: number;
  status: string;
  concours_id: string | null;
  created_at: string;
  concours: { nom: string } | { nom: string }[] | null;
}

interface ReceivedReponseRow {
  id: string;
  recherche_id: string;
  offreur_id: string;
  status: string;
  message: string | null;
  created_at: string;
  annonce: {
    id: string;
    ville_depart: string;
    ville_arrivee: string | null;
    date_trajet: string | null;
    heure_depart: string | null;
    nb_places_disponibles: number | null;
    prix_ht: number | null;
    price_per_km: number | null;
  } | null;
}

/**
 * LOT 4 — pour chaque recherche du demandeur courant, les réponses réelles
 * reçues (jointes à l'annonce du transporteur). LECTURE SEULE : aucun bouton
 * d'acceptation fonctionnel, aucun appel à accept_transport_recherche_response
 * ici (lot suivant). RLS trr_select_parties : le demandeur voit les réponses
 * de SES recherches uniquement — un tiers non concerné (ni demandeur ni
 * offreur) n'a accès à rien de tout ça, vérifié par la RLS côté serveur.
 * Deux requêtes séparées (mes recherches, puis leurs réponses) plutôt qu'un
 * embed filtré sur une relation imbriquée — plus simple à garder correct.
 */
export function useMyTransportRecherchesReponses() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<MyRechercheWithReponses[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) { setList([]); return; }
    setIsLoading(true);

    const { data: recherchesData, error: rErr } = await supabase
      .from('transport_recherches')
      .select('id, depart, destination, date_debut, date_fin, nb_places, status, concours_id, created_at, concours:concours_id(nom)')
      .eq('demandeur_id', profile.id)
      .order('created_at', { ascending: false });

    if (rErr || !recherchesData || recherchesData.length === 0) {
      setList([]);
      setIsLoading(false);
      return;
    }

    const rows = recherchesData as unknown as MyRechercheRow[];
    const ids = rows.map((r) => r.id);

    const { data: reponsesData, error: repErr } = await supabase
      .from('transport_recherche_reponses')
      .select('id, recherche_id, offreur_id, status, message, created_at, annonce:transport_annonces(id, ville_depart, ville_arrivee, date_trajet, heure_depart, nb_places_disponibles, prix_ht, price_per_km)')
      .in('recherche_id', ids)
      .order('created_at', { ascending: false });

    const reponsesRows = repErr ? [] : ((reponsesData ?? []) as unknown as ReceivedReponseRow[]);

    // ── LOT 6 : couverture réelle par cheval, pour chaque recherche ─────────
    // 1) le périmètre figé (tous les chevaux de chaque recherche) ;
    // 2) les réservations vivantes de ces recherches (mêmes statuts
    //    consommants que la RPC/fn_recompute_transport_recherche_status) ;
    // 3) les chevaux réellement affectés à CES réservations.
    // Rien n'est stocké : recalculé à chaque load() depuis les 3 tables.
    const { data: rechevauxData } = await supabase
      .from('transport_recherche_chevaux')
      .select('recherche_id, cheval_id, cheval:chevaux(id, nom)')
      .in('recherche_id', ids);

    const { data: reservationsCoverage } = await supabase
      .from('transport_reservations')
      .select('id, recherche_id')
      .in('recherche_id', ids)
      .in('statut', ['accepted', 'awaiting_payment', 'paid', 'completed']);

    const reservationToRecherche = new Map<string, string>(
      (reservationsCoverage ?? []).map((r) => [r.id as string, r.recherche_id as string]),
    );
    const coverageReservationIds = Array.from(reservationToRecherche.keys());

    let coveredKeys = new Set<string>();
    if (coverageReservationIds.length) {
      const { data: coveredRows } = await supabase
        .from('transport_reservation_chevaux')
        .select('reservation_id, cheval_id')
        .in('reservation_id', coverageReservationIds);
      coveredKeys = new Set(
        (coveredRows ?? []).map((r) => `${reservationToRecherche.get(r.reservation_id as string)}::${r.cheval_id}`),
      );
    }

    const rechevauxRows = (rechevauxData ?? []) as unknown as {
      recherche_id: string;
      cheval_id: string;
      cheval: { id: string; nom: string } | { id: string; nom: string }[] | null;
    }[];

    const result: MyRechercheWithReponses[] = rows.map((row) => {
      const concours = Array.isArray(row.concours) ? row.concours[0] : row.concours;
      const recherche: OpenTransportRecherche & { status: 'open' | 'matched' | 'cancelled' } = {
        id: row.id,
        demandeurId: profile.id,
        concoursId: row.concours_id,
        concoursNom: concours?.nom ?? null,
        depart: row.depart,
        destination: row.destination,
        dateDebut: row.date_debut,
        dateFin: row.date_fin,
        nbPlaces: row.nb_places,
        createdAt: row.created_at,
        status: row.status as 'open' | 'matched' | 'cancelled',
      };
      const reponses: ReceivedReponse[] = reponsesRows
        .filter((rep) => rep.recherche_id === row.id)
        .map((rep) => {
          const a = Array.isArray(rep.annonce) ? rep.annonce[0] : rep.annonce;
          return {
            id: rep.id,
            offreurId: rep.offreur_id,
            status: rep.status as 'pending' | 'declined',
            message: rep.message,
            createdAt: rep.created_at,
            annonce: a ? {
              id: a.id,
              villeDepart: a.ville_depart,
              villeArrivee: a.ville_arrivee,
              dateTrajet: a.date_trajet,
              heureDepart: a.heure_depart,
              nbPlacesDisponibles: a.nb_places_disponibles,
              prixHT: a.prix_ht,
              pricePerKm: a.price_per_km,
            } : null,
          };
        });
      const chevaux: RechercheCoverageCheval[] = rechevauxRows
        .filter((rc) => rc.recherche_id === row.id)
        .map((rc) => {
          const c = Array.isArray(rc.cheval) ? rc.cheval[0] : rc.cheval;
          return {
            id: rc.cheval_id,
            nom: c?.nom ?? 'Cheval',
            couvert: coveredKeys.has(`${row.id}::${rc.cheval_id}`),
          };
        });
      return { recherche, chevaux, reponses };
    });

    setList(result);
    setIsLoading(false);
  }, [profile?.id]);

  useAutoRefresh(load);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`transport-mes-recherches-reponses-${profile.id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_recherche_reponses' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_recherches' }, () => load())
      // LOT 6 — une acceptation insère dans transport_reservation_chevaux et fait
      // transiter transport_reservations.statut : les deux doivent rafraîchir la
      // couverture affichée, sans quoi l'écran resterait figé après « Accepter ».
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_reservation_chevaux' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_reservations' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, profile?.id, channelId]);

  return { items: list, isLoading, reload: load };
}

// ── LOT 5 : sélection des chevaux non couverts + acceptation réelle ────────
export interface RechercheChevalOption {
  id: string;
  nom: string;
}

/**
 * LOT 5 — chevaux du périmètre FIGÉ de la recherche (transport_recherche_chevaux)
 * qui ne sont PAS déjà couverts par une réservation vivante de cette recherche.
 * Même liste de statuts « consommants » que la RPC et fn_recompute_transport_
 * recherche_status (111) : accepted/awaiting_payment/paid/completed — jamais
 * pending (ne consomme pas encore). Fonction simple (pas un hook) : appelée à
 * la demande (ouverture du panneau de sélection), jamais en continu.
 */
export async function fetchAvailableChevauxForRecherche(
  rechercheId: string,
): Promise<{ chevaux: RechercheChevalOption[]; error: string | null }> {
  const { data: chevauxRows, error: cErr } = await supabase
    .from('transport_recherche_chevaux')
    .select('cheval_id, cheval:chevaux(id, nom)')
    .eq('recherche_id', rechercheId);
  if (cErr) return { chevaux: [], error: cErr.message };

  const { data: reservations, error: resErr } = await supabase
    .from('transport_reservations')
    .select('id')
    .eq('recherche_id', rechercheId)
    .in('statut', ['accepted', 'awaiting_payment', 'paid', 'completed']);
  if (resErr) return { chevaux: [], error: resErr.message };

  const reservationIds = (reservations ?? []).map((r) => r.id);
  let coveredIds = new Set<string>();
  if (reservationIds.length) {
    const { data: coveredRows, error: covErr } = await supabase
      .from('transport_reservation_chevaux')
      .select('cheval_id')
      .in('reservation_id', reservationIds);
    if (covErr) return { chevaux: [], error: covErr.message };
    coveredIds = new Set((coveredRows ?? []).map((r) => r.cheval_id as string));
  }

  const rows = (chevauxRows ?? []) as unknown as {
    cheval_id: string;
    cheval: { id: string; nom: string } | { id: string; nom: string }[] | null;
  }[];
  const chevaux = rows
    .filter((r) => !coveredIds.has(r.cheval_id))
    .map((r) => {
      const c = Array.isArray(r.cheval) ? r.cheval[0] : r.cheval;
      return { id: r.cheval_id, nom: c?.nom ?? 'Cheval' };
    });
  return { chevaux, error: null };
}

export interface AcceptRechercheReponseInput {
  reponseId: string;
  /** Exactement les chevaux choisis par le demandeur. Jamais « tous » par défaut. */
  chevalIds: string[];
}

export interface AcceptRechercheReponseResult {
  reservationId: string | null;
  error: string | null;
}

/**
 * LOT 5 — appelle EXCLUSIVEMENT accept_transport_recherche_response (111).
 * Ne recalcule NI ne transmet prix/commission/vendeur/capacité/statut : la
 * RPC (SECURITY DEFINER) fait tout, délègue aux triggers déjà audités
 * (051 prix, 053 capacité, recalcul couverture 111 §10).
 */
export function useAcceptTransportRechercheResponse() {
  const accept = useCallback(
    async (input: AcceptRechercheReponseInput): Promise<AcceptRechercheReponseResult> => {
      if (!input.chevalIds.length) return { reservationId: null, error: 'Sélectionne au moins un cheval.' };
      const { data, error } = await supabase.rpc('accept_transport_recherche_response', {
        p_reponse_id: input.reponseId,
        p_cheval_ids: input.chevalIds,
      });
      if (error) return { reservationId: null, error: error.message };
      return { reservationId: (data as string) ?? null, error: null };
    },
    [],
  );
  return { accept };
}
