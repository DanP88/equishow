import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type AvisType = 'coach' | 'transport' | 'box' | 'stage';

export interface Avis {
  id: string;
  auteur_id: string;
  auteur_nom: string | null;
  auteur_pseudo: string | null;
  auteur_initiales: string | null;
  auteur_couleur: string | null;
  destinataire_id: string;
  note: number;
  commentaire: string | null;
  type: AvisType | null;
  ref_id: string | null;
  created_at: string;
}

interface CreateAvisResult {
  error: string | null;
}

function describeError(message: string): string {
  if (message.includes('avis_no_self_review')) {
    return 'Vous ne pouvez pas vous laisser d’avis à vous-même.';
  }
  if (message.includes('avis_unique_general') || message.includes('avis_auteur_id_destinataire_id_ref_id_key')) {
    return 'Vous avez déjà laissé un avis.';
  }
  if (message.includes('avis_note_check')) {
    return 'Note invalide (1-5).';
  }
  return message;
}

export function useAvis(destinataireId?: string) {
  const { profile } = useAuth();
  const [list, setList] = useState<Avis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!destinataireId) {
      setList([]);
      return;
    }
    setIsLoading(true);
    const { data, error: queryErr } = await supabase
      .from('avis')
      .select('*')
      .eq('destinataire_id', destinataireId)
      .order('created_at', { ascending: false });
    if (queryErr) {
      setError(queryErr.message);
      setList([]);
    } else {
      setError(null);
      setList((data ?? []) as Avis[]);
    }
    setIsLoading(false);
  }, [destinataireId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime : nouveaux avis / suppressions sur ce destinataire.
  useEffect(() => {
    if (!destinataireId) return;
    const channel = supabase
      .channel(`avis-${destinataireId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'avis',
          filter: `destinataire_id=eq.${destinataireId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [destinataireId, load]);

  const totalReviews = list.length;
  const averageRating = totalReviews
    ? (list.reduce((sum, a) => sum + a.note, 0) / totalReviews).toFixed(1)
    : '0';

  const createAvis = useCallback(
    async (
      destId: string,
      note: number,
      commentaire?: string,
      type: AvisType = 'coach',
      refId?: string | null,
    ): Promise<CreateAvisResult> => {
      if (!destId) return { error: 'Destinataire manquant' };
      if (!profile?.id) return { error: 'Non authentifié' };
      if (note < 1 || note > 5) return { error: 'Note invalide (1-5)' };

      const { error: insertErr } = await supabase.from('avis').insert({
        auteur_id: profile.id,
        destinataire_id: destId,
        note,
        commentaire: commentaire?.trim() || null,
        type,
        ref_id: refId ?? null,
      });

      if (insertErr) {
        return { error: describeError(insertErr.message) };
      }
      return { error: null };
    },
    [profile?.id],
  );

  const deleteAvis = useCallback(async (id: string): Promise<CreateAvisResult> => {
    const { error: deleteErr } = await supabase.from('avis').delete().eq('id', id);
    if (deleteErr) return { error: deleteErr.message };
    return { error: null };
  }, []);

  return {
    avis: list,
    isLoading,
    error,
    averageRating,
    totalReviews,
    createAvis,
    deleteAvis,
    reload: load,
  };
}

/**
 * Stats d'avis pour un utilisateur (count + moyenne arrondie 1 décimale).
 * Optimisé pour les listes/cards : 1 query par utilisateur monitoré.
 */
export function useAvisStats(userId?: string) {
  const [stats, setStats] = useState<{ count: number; average: number }>({ count: 0, average: 0 });

  const load = useCallback(async () => {
    if (!userId) {
      setStats({ count: 0, average: 0 });
      return;
    }
    const { data, error } = await supabase
      .from('avis')
      .select('note')
      .eq('destinataire_id', userId);
    if (error || !data) {
      setStats({ count: 0, average: 0 });
      return;
    }
    const count = data.length;
    const average = count
      ? Math.round((data.reduce((sum, a) => sum + (a.note ?? 0), 0) / count) * 10) / 10
      : 0;
    setStats({ count, average });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`avis-stats-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'avis',
          filter: `destinataire_id=eq.${userId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  return stats;
}

/**
 * Retourne l'ensemble (Set<refId>) des avis déjà déposés par l'utilisateur courant.
 * Utile pour afficher "Avis déposé" vs "Laisser un avis" dans les listes
 * sans faire de query par item.
 */
export function useMyAvisRefs() {
  const { profile } = useAuth();
  const [refs, setRefs] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!profile?.id) {
      setRefs(new Set());
      return;
    }
    const { data, error } = await supabase
      .from('avis')
      .select('ref_id, destinataire_id')
      .eq('auteur_id', profile.id);
    if (error) {
      setRefs(new Set());
      return;
    }
    setRefs(new Set((data ?? []).filter(r => r.ref_id).map(r => r.ref_id as string)));
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`my-avis-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'avis',
          filter: `auteur_id=eq.${profile.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, load]);

  return refs;
}
