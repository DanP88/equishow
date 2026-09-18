// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/transportRecherches — LOT 1 (branchement front V2 → migration 111).
//
// Écriture RÉELLE dans transport_recherches + transport_recherche_chevaux.
// Périmètre volontairement minimal : seule la création est câblée ici (le
// bouton « Publier ma recherche » de TransportChercheV2). Aucune lecture des
// recherches publiées, aucune réponse, aucune acceptation — lots suivants.
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
import { useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

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
