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
// Miroir conceptuel de v2/adapters/transportRecherches.ts (Lot 1, 111) — PAS
// une copie : Box n'a pas de table transport_recherche_chevaux-like côté
// réservation (1 réservation box = 1 cheval directement, cf. mig 114) ; ce
// fichier ne couvre QUE la publication (createRecherche) + la lecture de ses
// propres recherches (useMyBoxRecherches, pour « Mes box › Mes recherches »).
// AUCUNE lecture des recherches des AUTRES (ça, c'est Box-2 : affichage côté
// offreur — volontairement absent d'ici) ni réponse/acceptation.
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
