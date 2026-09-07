// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/community — fils Communauté V2 (F10).
//
// LECTURE SEULE de useCommunautePosts(scope) (V1, 3 espaces avec RLS DB).
// AUCUNE écriture : publier / liker / commenter = flux Supabase → Phase 2.
// Repli démo si non connecté OU fil vide.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCommunautePosts, PostScope } from '../../hooks/useCommunautePosts';

export interface V2Post {
  id: string;
  auteur: string;
  initiales: string;
  couleur: string;
  contenu: string;
  quand: string;       // relatif « Il y a 2h »
  likes: number;
  commentaires: number;
  photos: number;
}

const FIL_META: Record<PostScope, { label: string; icon: string }> = {
  community: { label: 'Cavaliers', icon: '🐴' },
  coach: { label: 'Coachs', icon: '🎓' },
  organisateur: { label: 'Organisateurs', icon: '🏟' },
};
export function filMeta(scope: PostScope) { return FIL_META[scope]; }

function timeAgo(d: Date): string {
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  return `Il y a ${Math.floor(h / 24)} j`;
}

const DEMO: Record<PostScope, V2Post[]> = {
  community: [
    { id: 'dc1', auteur: 'Sophie D.', initiales: 'SD', couleur: '#7C3AED', contenu: 'Quelqu’un a fait le paddock ce matin à Fontainebleau ? Le sol est comment ?', quand: 'Il y a 2 h', likes: 4, commentaires: 3, photos: 0 },
    { id: 'dc2', auteur: 'Marc L.', initiales: 'ML', couleur: '#0369A1', contenu: 'Cherche co-voiturage retour dimanche depuis La Baule vers Nantes.', quand: 'Il y a 5 h', likes: 2, commentaires: 1, photos: 0 },
    { id: 'dc3', auteur: 'Émilie R.', initiales: 'ER', couleur: '#16A34A', contenu: 'Pensez au carnet de vaccination pour l’entrée sur site 🐴', quand: 'Hier', likes: 11, commentaires: 2, photos: 1 },
  ],
  coach: [
    { id: 'dk1', auteur: 'Caroline M.', initiales: 'CM', couleur: '#DB2777', contenu: 'Retour d’expérience sur la prépa mentale avant un Grand Prix Amateur ?', quand: 'Il y a 3 h', likes: 6, commentaires: 4, photos: 0 },
  ],
  organisateur: [
    { id: 'do1', auteur: 'Haras des Pins', initiales: 'HP', couleur: '#D97706', contenu: 'Comment gérez-vous les inscriptions de dernière minute le jour J ?', quand: 'Il y a 1 j', likes: 3, commentaires: 5, photos: 0 },
  ],
};

export interface V2Community { ready: boolean; demo: boolean; posts: V2Post[] }

export function useV2Community(scope: PostScope): V2Community {
  const { isSignedIn } = useAuth();
  const { posts, isLoading } = useCommunautePosts(scope);

  return useMemo(() => {
    const real: V2Post[] = (posts ?? []).map((p: any) => ({
      id: p.id,
      auteur: p.auteur || 'Membre EquiShow',
      initiales: p.initiales || (p.auteur || '?').slice(0, 2).toUpperCase(),
      couleur: p.couleur || '#7C3AED',
      contenu: p.contenu ?? '',
      quand: p.date instanceof Date ? timeAgo(p.date) : '',
      likes: p.likes ?? 0,
      commentaires: Array.isArray(p.commentaires) ? p.commentaires.length : 0,
      photos: Array.isArray(p.imageUrls) ? p.imageUrls.length : 0,
    }));
    if (isSignedIn && real.length) return { ready: !isLoading, demo: false, posts: real };
    return { ready: true, demo: true, posts: DEMO[scope] ?? [] };
  }, [isSignedIn, isLoading, posts, scope]);
}
