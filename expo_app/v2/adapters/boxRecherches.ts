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
//   insert_own, 114). Miroir de Transport Lot 3. AUCUNE acceptation ici (RPC
//   accept_box_recherche_response déjà en place côté serveur depuis 114, mais
//   pas encore appelée par le front — lot suivant).
//
// Miroir conceptuel de v2/adapters/transportRecherches.ts (Lot 1+2+3, 111) —
// PAS une copie : Box n'a pas de table transport_recherche_chevaux-like côté
// réservation (1 réservation box = 1 cheval directement, cf. mig 114) ; ce
// fichier couvre la publication (createRecherche), la lecture de ses propres
// recherches (useMyBoxRecherches), la lecture des recherches ouvertes des
// autres (useOpenBoxRecherches) et la réponse d'un offreur (useBoxRecherche
// Reponses). AUCUNE acceptation.
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
