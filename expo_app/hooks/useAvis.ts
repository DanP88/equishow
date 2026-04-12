import { useEffect, useState } from 'react';
import supabase from '../lib/supabase';
import { useAuth } from './useAuth';

export interface Avis {
  id: string;
  auteur_id: string;
  auteur_nom: string;
  destinataire_id: string;
  note: number;
  commentaire: string | null;
  created_at: string;
  updated_at: string;
}

export const useAvis = (destinataireId?: string) => {
  const { profile } = useAuth();
  const [avis, setAvis] = useState<Avis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = destinataireId || profile?.id;

  // Fetch avis for a user
  useEffect(() => {
    if (!userId) {
      setAvis([]);
      setIsLoading(false);
      return;
    }

    const fetchAvis = async () => {
      try {
        setIsLoading(true);
        const { data, error: err } = await supabase
          .from('avis')
          .select('*')
          .eq('destinataire_id', userId)
          .order('created_at', { ascending: false });

        if (err) throw err;
        setAvis(data || []);
      } catch (err: any) {
        console.error('❌ Error fetching avis:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvis();

    // Real-time subscription
    const channel = supabase
      .channel(`avis:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'avis',
          filter: `destinataire_id=eq.${userId}`,
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setAvis((prev) => {
              const exists = prev.find((a) => a.id === payload.new.id);
              if (exists && payload.eventType === 'UPDATE') {
                return prev.map((a) => (a.id === payload.new.id ? payload.new : a));
              }
              if (payload.eventType === 'INSERT') {
                return [payload.new as Avis, ...prev];
              }
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            setAvis((prev) => prev.filter((a) => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Create avis
  const createAvis = async (destinataire_id: string, note: number, commentaire?: string) => {
    if (!profile) throw new Error('User not authenticated');

    try {
      const { data, error: err } = await supabase
        .from('avis')
        .insert({
          auteur_id: profile.id,
          auteur_nom: `${profile.prenom} ${profile.nom}`,
          destinataire_id,
          note,
          commentaire: commentaire || null,
        })
        .select()
        .single();

      if (err) throw err;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  // Update avis
  const updateAvis = async (avisId: string, note: number, commentaire?: string) => {
    try {
      const { data, error: err } = await supabase
        .from('avis')
        .update({
          note,
          commentaire: commentaire || null,
        })
        .eq('id', avisId)
        .eq('auteur_id', profile?.id)
        .select()
        .single();

      if (err) throw err;
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  };

  // Delete avis
  const deleteAvis = async (avisId: string) => {
    try {
      const { error: err } = await supabase
        .from('avis')
        .delete()
        .eq('id', avisId)
        .eq('auteur_id', profile?.id);

      if (err) throw err;
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  };

  // Calculate average rating
  const averageRating = avis.length > 0
    ? (avis.reduce((sum, a) => sum + a.note, 0) / avis.length).toFixed(1)
    : '0';

  return {
    avis,
    isLoading,
    error,
    averageRating,
    totalReviews: avis.length,
    createAvis,
    updateAvis,
    deleteAvis,
  };
};
