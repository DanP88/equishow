import { useState, useCallback } from 'react';
import { avisStore, AvisItem, getAvisForUser, getAvisMoyenne, hasAlreadyReviewed, addAvis } from '../data/store';
import { userStore } from '../data/store';

export type Avis = AvisItem;

export const useAvis = (destinataireId?: string) => {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  const avis = destinataireId ? getAvisForUser(destinataireId) : [];
  const averageRating = destinataireId ? getAvisMoyenne(destinataireId).toFixed(1) : '0';
  const totalReviews = avis.length;

  const createAvis = useCallback(async (
    destId: string,
    note: number,
    commentaire?: string,
    type: 'coach' | 'transport' | 'box' | 'stage' = 'coach',
    refId?: string
  ) => {
    if (!destId) return { error: 'Destinataire manquant' };
    if (hasAlreadyReviewed(userStore.id, destId, refId)) return { error: 'Avis déjà déposé' };
    addAvis({
      auteur_id: userStore.id,
      auteur_nom: `${userStore.prenom} ${userStore.nom}`,
      auteur_initiales: `${userStore.prenom[0]}${userStore.nom[0]}`.toUpperCase(),
      auteur_couleur: userStore.avatarColor,
      destinataire_id: destId,
      note,
      commentaire: commentaire?.trim() || null,
      type,
      ref_id: refId,
    });
    refresh();
    return { error: null };
  }, [refresh]);

  const deleteAvis = useCallback(async (id: string) => {
    avisStore.list = avisStore.list.filter(a => a.id !== id);
    refresh();
  }, [refresh]);

  return {
    avis,
    isLoading: false,
    error: null,
    averageRating,
    totalReviews,
    createAvis,
    deleteAvis,
  };
};
