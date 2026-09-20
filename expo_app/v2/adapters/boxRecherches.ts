// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/boxRecherches — BOX-1 (branchement front V2 → migration 114)
//   + BOX-1A (publication atomique via RPC create_box_recherche, mig 116).
//
// BOX-1 : écriture RÉELLE dans box_recherches + box_recherche_chevaux
//   (bouton « Publier ma recherche de box » de BoxChercheV2, compte connecté
//   uniquement — le parcours démo reste 100% local, cf. v2/state/boxLocal.ts).
// BOX-1A : createRecherche appelle DÉSORMAIS un SEUL RPC transactionnel
//   (public.create_box_recherche, mig 116) au lieu de 2 INSERT REST successifs
//   + rollback client. La RPC crée box_recherches + box_recherche_chevaux
//   dans UNE SEULE transaction Postgres — impossible d'obtenir une recherche
//   sans ses chevaux, y compris en cas de coupure réseau/crash app pendant
//   l'appel (soit tout committe côté serveur, soit rien ne persiste). Le
//   rollback manuel client (delete de la recherche orpheline) est donc
//   devenu inutile et a été retiré. demandeur_id/ownership cheval/cohérence
//   concours sont revérifiés côté RPC (auth.uid(), jamais un paramètre
//   client) — mêmes règles que la RLS 114, ré-appliquées explicitement car
//   la RPC (SECURITY DEFINER) bypasse RLS sur ses écritures internes.
//
// BOX-2 : lecture temps réel des recherches 'open' des AUTRES (useOpenBox
//   Recherches), pour que l'offreur les voie depuis « Je propose ». LECTURE
//   SEULE — AUCUNE réponse, AUCUNE acceptation (ça reste pour un lot suivant,
//   miroir de Transport Lot 3+). RLS box_recherches_select_auth (114) permet
//   déjà à tout authentifié de lire toute recherche, quel que soit son statut
//   — filtrage `status='open'` + exclusion des siennes propres fait ici,
//   côté client, comme pour Transport Lot 2. Realtime déjà actif : box_
//   recherches + box_recherche_chevaux sont dans la publication supabase_
//   realtime depuis la migration 114 elle-même (§10) — aucune migration 117
//   nécessaire pour Box-2, contrairement à Transport qui avait dû attendre
//   une migration 112 dédiée.
//
// BOX-3 : réponse RÉELLE d'un offreur à une recherche ouverte (useBoxRecherche
//   Reponses.respond) — INSERT direct dans box_recherche_reponses, toujours
//   lié à une VRAIE box_annonces de l'offreur (RLS box_recherche_reponses_
//   insert_own, 114). Miroir de Transport Lot 3.
//
// BOX-4B : acceptation RÉELLE d'une réponse par le demandeur (useMyBoxRecherche
//   sReponses lecture + useAcceptBoxRechercheResponse écriture) — appelle
//   EXCLUSIVEMENT le RPC accept_box_recherche_response (SECURITY DEFINER,
//   114, déjà en place et déjà durci par 115). Ce fichier ne transmet JAMAIS
//   prix/commission/seller_id/buyer_id — tout reste autoritaire côté serveur
//   (auth.uid(), triggers 051/104). `box_recherche_reponses.status` ne
//   possède PAS de valeur 'accepted' (CHECK = pending/declined uniquement,
//   vérifié en base) : l'état d'acceptation est TOUJOURS dérivé de
//   box_reservations.recherche_reponse_id, jamais lu depuis `status`. Miroir
//   de Transport Lot 5+6 (fetchAvailableChevauxForRecherche /
//   useMyTransportRecherchesReponses) — PAS une copie : la couverture se lit
//   directement dans box_reservations (cheval_id scalaire + recherche_
//   reponse_id), sans table de jonction intermédiaire (contrairement à
//   transport_reservation_chevaux côté Transport).
//
// Miroir conceptuel de v2/adapters/transportRecherches.ts (Lot 1+2+3+4+5+6,
// 111) — PAS une copie : Box n'a pas de table transport_recherche_chevaux-
// like côté réservation (1 réservation box = 1 cheval directement, cf. mig
// 114) ; ce fichier couvre la publication (createRecherche), la lecture de
// ses propres recherches (useMyBoxRecherches), la lecture des recherches
// ouvertes des autres (useOpenBoxRecherches), la réponse d'un offreur
// (useBoxRechercheReponses) et l'acceptation par le demandeur
// (useMyBoxRecherchesReponses + useAcceptBoxRechercheResponse).
//
// `chevalIds` DOIT être filtré en amont (côté écran) aux seuls chevaux RÉELS
// (table `chevaux`, src==='real' dans UnifiedHorse) : box_recherche_chevaux.
// cheval_id porte une FK vers chevaux(id) — un id de cheval local V2
// (v2:chevaux, jamais écrit en base) ferait échouer la RPC (ownership check
// avant même l'INSERT, puisque le cheval n'existerait pas dans `chevaux`).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

export interface CreateBoxRechercheInput {
  concoursId?: string;
  lieu?: string;
  dateDebut?: string;
  dateFin?: string;
  litiereIncluse?: boolean;
  /** Chevaux RÉELS uniquement (déjà filtrés par l'appelant). Minimum 1. */
  chevalIds: string[];
}

export interface CreateBoxRechercheResult {
  id: string | null;
  error: string | null;
}

export function useBoxRecherches() {
  const { profile } = useAuth();

  const createRecherche = useCallback(
    async (input: CreateBoxRechercheInput): Promise<CreateBoxRechercheResult> => {
      if (!profile?.id) return { id: null, error: 'Non authentifié' };
      if (!input.chevalIds.length) return { id: null, error: 'Sélectionne au moins un cheval.' };

      // BOX-1A (116) : appel RPC unique, transactionnel. demandeur_id n'est
      // PAS transmis — la RPC utilise exclusivement auth.uid() côté serveur.
      const { data, error } = await supabase.rpc('create_box_recherche', {
        p_concours_id: input.concoursId || null,
        p_lieu: input.lieu || null,
        p_date_debut: input.dateDebut || null,
        p_date_fin: input.dateFin || null,
        p_litiere_incluse: input.litiereIncluse ?? true,
        p_cheval_ids: input.chevalIds,
      });

      if (error || !data) {
        return { id: null, error: error?.message ?? 'Erreur lors de la création de la recherche.' };
      }

      return { id: data as string, error: null };
    },
    [profile?.id],
  );

  return { createRecherche };
}

// ── Mes recherches (lecture seule, propriétaire uniquement) ────────────────
export interface MyBoxRecherche {
  id: string;
  concoursId: string | null;
  concoursNom: string | null;
  lieu: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  nbBox: number;
  litiereIncluse: boolean;
  status: 'open' | 'matched' | 'cancelled';
  createdAt: string;
}

interface MyBoxRechercheRow {
  id: string;
  concours_id: string | null;
  lieu: string | null;
  date_debut: string | null;
  date_fin: string | null;
  nb_box: number;
  litiere_incluse: boolean;
  status: 'open' | 'matched' | 'cancelled';
  created_at: string;
  concours: { nom: string } | { nom: string }[] | null;
}

function rowToMyRecherche(row: MyBoxRechercheRow): MyBoxRecherche {
  const concours = Array.isArray(row.concours) ? row.concours[0] : row.concours;
  return {
    id: row.id,
    concoursId: row.concours_id,
    concoursNom: concours?.nom ?? null,
    lieu: row.lieu,
    dateDebut: row.date_debut,
    dateFin: row.date_fin,
    nbBox: row.nb_box,
    litiereIncluse: row.litiere_incluse,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** « Mes box › Mes recherches » — mes propres recherches réelles uniquement. */
export function useMyBoxRecherches() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<MyBoxRecherche[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) { setList([]); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('box_recherches')
      .select('id, concours_id, lieu, date_debut, date_fin, nb_box, litiere_incluse, status, created_at, concours(nom)')
      .eq('demandeur_id', profile.id)
      .order('created_at', { ascending: false });
    if (!error) setList(((data ?? []) as unknown as MyBoxRechercheRow[]).map(rowToMyRecherche));
    setIsLoading(false);
  }, [profile?.id]);

  useAutoRefresh(load);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`box-recherches-mine-${profile.id}-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'box_recherches', filter: `demandeur_id=eq.${profile.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, load]);

  const removeRecherche = useCallback(async (id: string): Promise<{ error: string | null }> => {
    let snapshot: MyBoxRecherche[] = [];
    setList((curr) => { snapshot = curr; return curr.filter((r) => r.id !== id); });
    const { error } = await supabase.from('box_recherches').delete().eq('id', id);
    if (error) { setList(snapshot); return { error: error.message }; }
    return { error: null };
  }, []);

  return { recherches: list, isLoading, reload: load, removeRecherche };
}

// ── BOX-2 : recherches ouvertes des AUTRES (lecture seule, côté offreur) ───
export interface OpenBoxRecherche {
  id: string;
  demandeurId: string;
  concoursId: string | null;
  concoursNom: string | null;
  lieu: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  litiereIncluse: boolean;
  nbBox: number;
  createdAt: string;
}

interface OpenBoxRechercheRow {
  id: string;
  demandeur_id: string;
  concours_id: string | null;
  lieu: string | null;
  date_debut: string | null;
  date_fin: string | null;
  litiere_incluse: boolean;
  nb_box: number;
  created_at: string;
  concours: { nom: string } | { nom: string }[] | null;
}

function rowToOpenRecherche(row: OpenBoxRechercheRow): OpenBoxRecherche {
  const concours = Array.isArray(row.concours) ? row.concours[0] : row.concours;
  return {
    id: row.id,
    demandeurId: row.demandeur_id,
    concoursId: row.concours_id,
    concoursNom: concours?.nom ?? null,
    lieu: row.lieu,
    dateDebut: row.date_debut,
    dateFin: row.date_fin,
    litiereIncluse: row.litiere_incluse,
    nbBox: row.nb_box,
    createdAt: row.created_at,
  };
}

/**
 * BOX-2 — recherches box 'open' visibles par tout authentifié (RLS
 * box_recherches_select_auth), hors les siennes propres. Lecture seule :
 * aucune réponse, aucune acceptation, aucune écriture. Realtime câblé sur
 * box_recherches + box_recherche_chevaux (déjà dans supabase_realtime depuis
 * 114 — nb_box étant dérivé par trigger, un ajout/retrait de cheval doit
 * rafraîchir la liste, même logique que Transport Lot 2).
 */
export function useOpenBoxRecherches() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<OpenBoxRecherche[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error: qErr } = await supabase
      .from('box_recherches')
      .select('id, demandeur_id, concours_id, lieu, date_debut, date_fin, litiere_incluse, nb_box, created_at, concours:concours_id(nom)')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (qErr) {
      setError(qErr.message);
      setList([]);
    } else {
      setError(null);
      const rows = (data ?? []) as unknown as OpenBoxRechercheRow[];
      setList(rows.map(rowToOpenRecherche).filter((r) => r.demandeurId !== profile?.id));
    }
    setIsLoading(false);
  }, [profile?.id]);

  useAutoRefresh(load);

  useEffect(() => {
    const channel = supabase
      .channel(`box-recherches-open-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'box_recherches' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'box_recherche_chevaux' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, channelId]);

  return { recherches: list, isLoading, error, reload: load };
}

// ── BOX-3 : réponse d'un offreur à une recherche ouverte ────────────────────
export interface BoxRechercheReponse {
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

function rowToReponse(row: ReponseRow): BoxRechercheReponse {
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

export interface RespondToBoxRechercheInput {
  rechercheId: string;
  annonceId: string;
  message?: string;
}

export interface RespondToBoxRechercheResult {
  id: string | null;
  error: string | null;
}

/**
 * BOX-3 — réponses de l'offreur courant à des recherches box ouvertes.
 * Miroir exact de useTransportRechercheReponses (Transport Lot 3) : simple
 * INSERT REST, pas de RPC nécessaire — la RLS box_recherche_reponses_
 * insert_own (114) revérifie déjà tout côté serveur (offreur_id=auth.uid()
 * ET annonce_id lui appartient réellement ET la recherche est encore 'open'
 * ET anti auto-réponse). Le front ne fait que proposer les VRAIES annonces
 * de l'utilisateur (useMyBoxAnnonces), jamais un id arbitraire.
 * Pas d'acceptation ici : la réponse reste 'pending' — RPC accept_box_
 * recherche_response (114) déjà en place côté serveur, câblage front = lot
 * suivant, pas celui-ci.
 */
export function useBoxRechercheReponses() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<BoxRechercheReponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) { setList([]); return; }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('box_recherche_reponses')
      .select('id, recherche_id, annonce_id, offreur_id, message, status, created_at')
      .eq('offreur_id', profile.id);
    if (!error) setList(((data ?? []) as ReponseRow[]).map(rowToReponse));
    setIsLoading(false);
  }, [profile?.id]);

  useAutoRefresh(load);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`box-recherche-reponses-${profile.id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'box_recherche_reponses' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, profile?.id, channelId]);

  const respond = useCallback(
    async (input: RespondToBoxRechercheInput): Promise<RespondToBoxRechercheResult> => {
      if (!profile?.id) return { id: null, error: 'Non authentifié' };
      const { data, error } = await supabase
        .from('box_recherche_reponses')
        .insert({
          recherche_id: input.rechercheId,
          annonce_id: input.annonceId,
          offreur_id: profile.id,
          message: input.message || null,
        })
        .select('id')
        .single();
      if (error || !data) return { id: null, error: error?.message ?? 'Erreur lors de l\'envoi de la réponse.' };
      return { id: data.id, error: null };
    },
    [profile?.id],
  );

  return { myReponses: list, isLoading, respond };
}

// ── BOX-4B : réponses reçues par le demandeur + couverture + acceptation ───
export interface ReceivedBoxReponseAnnonce {
  id: string;
  lieu: string;
  prixNuitHT: number | null;
  nbBoxesDisponibles: number | null;
}

export interface ReceivedBoxReponse {
  id: string;
  offreurId: string;
  /** Jamais 'accepted' — cette valeur n'existe pas dans le schéma (114).
   *  « Déjà accepté » se lit via chevalIdsAcceptes (dérivé de box_reservations),
   *  jamais via ce champ. */
  status: 'pending' | 'declined';
  message: string | null;
  createdAt: string;
  annonce: ReceivedBoxReponseAnnonce | null;
  /** Chevaux déjà couverts par une réservation issue précisément de CETTE
   *  réponse (recherche_reponse_id) — dérivé à chaque chargement, jamais stocké. */
  chevalIdsAcceptes: string[];
}

export interface BoxRechercheCoverageCheval {
  id: string;
  nom: string;
  couvert: boolean;
}

export interface MyBoxRechercheEntry {
  id: string;
  lieu: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  nbBox: number;
  status: 'open' | 'matched' | 'cancelled';
  concoursId: string | null;
  concoursNom: string | null;
  createdAt: string;
}

export interface MyBoxRechercheWithReponses {
  recherche: MyBoxRechercheEntry;
  /** Tous les chevaux du périmètre figé de la recherche, chacun avec son état
   *  de couverture réel (recalculé depuis box_reservations, jamais stocké). */
  chevaux: BoxRechercheCoverageCheval[];
  reponses: ReceivedBoxReponse[];
}

interface MyBoxRechercheRow2 {
  id: string;
  lieu: string | null;
  date_debut: string | null;
  date_fin: string | null;
  nb_box: number;
  status: string;
  concours_id: string | null;
  created_at: string;
  concours: { nom: string } | { nom: string }[] | null;
}

interface ReceivedBoxReponseRow {
  id: string;
  recherche_id: string;
  offreur_id: string;
  status: string;
  message: string | null;
  created_at: string;
  annonce: { id: string; lieu: string; prix_nuit_ht: number | null; nb_boxes_disponibles: number | null }
    | { id: string; lieu: string; prix_nuit_ht: number | null; nb_boxes_disponibles: number | null }[]
    | null;
}

/**
 * BOX-4B — pour chaque recherche du demandeur courant, les réponses réelles
 * reçues (jointes à l'annonce de l'offreur) + la couverture réelle par cheval.
 * RLS box_recherche_reponses_select_parties : le demandeur voit les réponses
 * de SES recherches uniquement. LECTURE SEULE côté couverture — recalculée à
 * chaque load() directement depuis box_reservations (cheval_id scalaire +
 * recherche_reponse_id, PAS de table de jonction côté Box, contrairement à
 * Transport 111 — cf. 114 : conception assumée « 1 réservation = 1 cheval »).
 */
export function useMyBoxRecherchesReponses() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<MyBoxRechercheWithReponses[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) { setList([]); return; }
    setIsLoading(true);

    const { data: recherchesData, error: rErr } = await supabase
      .from('box_recherches')
      .select('id, lieu, date_debut, date_fin, nb_box, status, concours_id, created_at, concours:concours_id(nom)')
      .eq('demandeur_id', profile.id)
      .order('created_at', { ascending: false });

    if (rErr || !recherchesData || recherchesData.length === 0) {
      setList([]);
      setIsLoading(false);
      return;
    }

    const rows = recherchesData as unknown as MyBoxRechercheRow2[];
    const ids = rows.map((r) => r.id);

    const { data: reponsesData, error: repErr } = await supabase
      .from('box_recherche_reponses')
      .select('id, recherche_id, offreur_id, status, message, created_at, annonce:box_annonces(id, lieu, prix_nuit_ht, nb_boxes_disponibles)')
      .in('recherche_id', ids)
      .order('created_at', { ascending: false });
    const reponsesRows = repErr ? [] : ((reponsesData ?? []) as unknown as ReceivedBoxReponseRow[]);

    const { data: rechevauxData } = await supabase
      .from('box_recherche_chevaux')
      .select('recherche_id, cheval_id, cheval:chevaux(id, nom)')
      .in('recherche_id', ids);

    // Couverture : directement depuis box_reservations (cheval_id scalaire +
    // recherche_reponse_id), mêmes statuts « consommants » que la RPC/
    // fn_recompute_box_recherche_status (114) : PAS 'pending'.
    const { data: reservationsData } = await supabase
      .from('box_reservations')
      .select('recherche_id, cheval_id, recherche_reponse_id')
      .in('recherche_id', ids)
      .in('status', ['accepted', 'awaiting_payment', 'paid', 'completed']);

    const coveredKeys = new Set<string>(); // `${recherche_id}::${cheval_id}`
    const reponseCoveredCheval = new Map<string, string[]>(); // reponse_id -> chevalIds
    for (const row of (reservationsData ?? []) as { recherche_id: string; cheval_id: string | null; recherche_reponse_id: string | null }[]) {
      if (!row.cheval_id) continue;
      coveredKeys.add(`${row.recherche_id}::${row.cheval_id}`);
      if (row.recherche_reponse_id) {
        const arr = reponseCoveredCheval.get(row.recherche_reponse_id) ?? [];
        arr.push(row.cheval_id);
        reponseCoveredCheval.set(row.recherche_reponse_id, arr);
      }
    }

    const rechevauxRows = (rechevauxData ?? []) as unknown as {
      recherche_id: string;
      cheval_id: string;
      cheval: { id: string; nom: string } | { id: string; nom: string }[] | null;
    }[];

    const result: MyBoxRechercheWithReponses[] = rows.map((row) => {
      const concours = Array.isArray(row.concours) ? row.concours[0] : row.concours;
      const recherche: MyBoxRechercheEntry = {
        id: row.id,
        lieu: row.lieu,
        dateDebut: row.date_debut,
        dateFin: row.date_fin,
        nbBox: row.nb_box,
        status: row.status as 'open' | 'matched' | 'cancelled',
        concoursId: row.concours_id,
        concoursNom: concours?.nom ?? null,
        createdAt: row.created_at,
      };
      const reponses: ReceivedBoxReponse[] = reponsesRows
        .filter((rep) => rep.recherche_id === row.id)
        .map((rep) => {
          const a = Array.isArray(rep.annonce) ? rep.annonce[0] : rep.annonce;
          return {
            id: rep.id,
            offreurId: rep.offreur_id,
            status: rep.status as 'pending' | 'declined',
            message: rep.message,
            createdAt: rep.created_at,
            annonce: a ? { id: a.id, lieu: a.lieu, prixNuitHT: a.prix_nuit_ht, nbBoxesDisponibles: a.nb_boxes_disponibles } : null,
            chevalIdsAcceptes: reponseCoveredCheval.get(rep.id) ?? [],
          };
        });
      const chevaux: BoxRechercheCoverageCheval[] = rechevauxRows
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
      .channel(`box-mes-recherches-reponses-${profile.id}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'box_recherche_reponses' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'box_recherches' }, () => load())
      // Une acceptation insère/transite box_reservations : doit rafraîchir la
      // couverture affichée, sans quoi l'écran resterait figé après « Accepter ».
      .on('postgres_changes', { event: '*', schema: 'public', table: 'box_reservations' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, profile?.id, channelId]);

  return { items: list, isLoading, reload: load };
}

// ── BOX-4B : chevaux non couverts d'une recherche (pour le panneau d'acceptation) ──
export interface BoxRechercheChevalOption {
  id: string;
  nom: string;
}

/**
 * BOX-4B — chevaux du périmètre FIGÉ de la recherche (box_recherche_chevaux)
 * qui ne sont PAS déjà couverts par une réservation vivante de cette
 * recherche. Mêmes statuts « consommants » que la RPC (114) : accepted/
 * awaiting_payment/paid/completed — jamais pending. Fonction simple (pas un
 * hook) : appelée à la demande (ouverture du panneau de sélection).
 */
export async function fetchAvailableChevauxForBoxRecherche(
  rechercheId: string,
): Promise<{ chevaux: BoxRechercheChevalOption[]; error: string | null }> {
  const { data: chevauxRows, error: cErr } = await supabase
    .from('box_recherche_chevaux')
    .select('cheval_id, cheval:chevaux(id, nom)')
    .eq('recherche_id', rechercheId);
  if (cErr) return { chevaux: [], error: cErr.message };

  const { data: reservations, error: resErr } = await supabase
    .from('box_reservations')
    .select('cheval_id')
    .eq('recherche_id', rechercheId)
    .in('status', ['accepted', 'awaiting_payment', 'paid', 'completed']);
  if (resErr) return { chevaux: [], error: resErr.message };

  const coveredIds = new Set((reservations ?? []).map((r) => r.cheval_id as string).filter(Boolean));

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

// ── BOX-4B : acceptation réelle (RPC exclusif, aucun calcul front) ─────────
export interface AcceptBoxRechercheReponseInput {
  reponseId: string;
  chevalIds: string[];
}

export interface AcceptBoxRechercheReponseResult {
  reservationIds: string[] | null;
  error: string | null;
}

/**
 * BOX-4B — appelle EXCLUSIVEMENT accept_box_recherche_response (114). Ne
 * transmet NI prix NI commission NI seller_id NI buyer_id — la RPC
 * (SECURITY DEFINER) les détermine entièrement côté serveur (auth.uid() pour
 * le demandeur, trigger 051 pour prix/commission/seller_id, trigger 104 pour
 * la capacité). Le front ne fait que proposer les chevaux non couverts
 * (fetchAvailableChevauxForBoxRecherche) — toute règle métier est revérifiée
 * et appliquée côté serveur, jamais recalculée ici.
 */
export function useAcceptBoxRechercheResponse() {
  const accept = useCallback(
    async (input: AcceptBoxRechercheReponseInput): Promise<AcceptBoxRechercheReponseResult> => {
      if (!input.chevalIds.length) return { reservationIds: null, error: 'Sélectionne au moins un cheval.' };
      const { data, error } = await supabase.rpc('accept_box_recherche_response', {
        p_reponse_id: input.reponseId,
        p_cheval_ids: input.chevalIds,
      });
      if (error) return { reservationIds: null, error: error.message };
      return { reservationIds: (data as string[]) ?? [], error: null };
    },
    [],
  );

  return { accept };
}
