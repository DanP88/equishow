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
//   Pas d'acceptation/réservation/sélection de chevaux ici — lot suivant.
//   Repose sur la publication `supabase_realtime` + REPLICA IDENTITY FULL
//   activées par la migration 112 : sans elle, un DELETE/UPDATE filtré sur une
//   colonne non-PK (ex. concours_id) ne remonterait pas côté abonné.
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
