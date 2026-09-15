// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/community — fils Communauté V2 (F10 + lot likes/commentaires).
//
// Lecture de useCommunautePosts(scope) (V1, 3 espaces avec RLS DB). Écritures
// RÉELLES : publier (CommunauteV2.Composer), liker/commenter un post (via
// useCommunautePosts.toggleLike/addComment, câblés directement dans l'écran).
// Repli démo si non connecté OU fil vide.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCommunautePosts, PostScope } from '../../hooks/useCommunautePosts';
import { communityPhotoUrl } from '../../lib/communityPhotos';

export interface V2Comment {
  id: string;
  auteur: string;
  initiales: string;
  couleur: string;
  texte: string;
  quand: string;
  likes: number;
  likedByMe: boolean;
  photoUrls: string[]; // 109 — URLs publiques dérivées des chemins Storage
}

export interface V2Post {
  id: string;
  auteur: string;
  initiales: string;
  couleur: string;
  contenu: string;
  quand: string;       // relatif « Il y a 2h »
  likes: number;
  likedByMe: boolean;
  commentaires: V2Comment[];
  photos: number;
  photoUrls: string[]; // URLs publiques dérivées des chemins Storage (mig 108)
  mine: boolean;       // post de l'utilisateur courant (→ suppression possible)
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

const d = (o: Omit<V2Post, 'photoUrls' | 'mine' | 'likedByMe' | 'commentaires'> & { commentaires: number }): V2Post => ({
  ...o, photoUrls: [], mine: false, likedByMe: false,
  commentaires: Array.from({ length: o.commentaires }, (_, i) => ({
    id: `${o.id}-c${i}`, auteur: 'Membre', initiales: 'ME', couleur: '#7C3AED',
    texte: 'Commentaire de démonstration.', quand: 'Il y a 1 h', likes: 0, likedByMe: false, photoUrls: [],
  })),
});
const DEMO: Record<PostScope, V2Post[]> = {
  community: [
    d({ id: 'dc1', auteur: 'Sophie D.', initiales: 'SD', couleur: '#7C3AED', contenu: 'Quelqu’un a fait le paddock ce matin à Fontainebleau ? Le sol est comment ?', quand: 'Il y a 2 h', likes: 4, commentaires: 3, photos: 0 }),
    d({ id: 'dc2', auteur: 'Marc L.', initiales: 'ML', couleur: '#0369A1', contenu: 'Cherche co-voiturage retour dimanche depuis La Baule vers Nantes.', quand: 'Il y a 5 h', likes: 2, commentaires: 1, photos: 0 }),
    d({ id: 'dc3', auteur: 'Émilie R.', initiales: 'ER', couleur: '#16A34A', contenu: 'Pensez au carnet de vaccination pour l’entrée sur site 🐴', quand: 'Hier', likes: 11, commentaires: 2, photos: 0 }),
  ],
  coach: [
    d({ id: 'dk1', auteur: 'Caroline M.', initiales: 'CM', couleur: '#DB2777', contenu: 'Retour d’expérience sur la prépa mentale avant un Grand Prix Amateur ?', quand: 'Il y a 3 h', likes: 6, commentaires: 4, photos: 0 }),
  ],
  organisateur: [
    d({ id: 'do1', auteur: 'Haras des Pins', initiales: 'HP', couleur: '#D97706', contenu: 'Comment gérez-vous les inscriptions de dernière minute le jour J ?', quand: 'Il y a 1 j', likes: 3, commentaires: 5, photos: 0 }),
  ],
};

export interface V2Community {
  ready: boolean;
  demo: boolean;
  posts: V2Post[];
  // Écritures RÉELLES, mêmes fonctions/instance que la lecture ci-dessus — la
  // mise à jour optimiste de useCommunautePosts retombe donc directement dans
  // `posts` sans attendre le round-trip realtime (fix "pas assez instantané").
  toggleLike: (postId: string) => Promise<{ error: string | null }>;
  addComment: (postId: string, texte: string, imagePaths?: string[]) => Promise<{ error: string | null }>;
  deletePost: (postId: string) => Promise<{ error: string | null }>;
  createPost: (contenu: string, imagePaths?: string[]) => Promise<{ error: string | null }>;
}

export function useV2Community(scope: PostScope): V2Community {
  const { isSignedIn, isLoading: authLoading, profile } = useAuth();
  const { posts, isLoading, toggleLike, addComment, deletePost, createPost } = useCommunautePosts(scope);
  const me = (profile as any)?.id as string | undefined;

  const real = useMemo<V2Post[]>(() => (posts ?? []).map((p: any) => {
    const paths: string[] = Array.isArray(p.imageUrls) ? p.imageUrls : [];
    const comments: any[] = Array.isArray(p.commentaires) ? p.commentaires : [];
    return {
      id: p.id,
      auteur: p.auteur || 'Membre EquiShow',
      initiales: p.initiales || (p.auteur || '?').slice(0, 2).toUpperCase(),
      couleur: p.couleur || '#7C3AED',
      contenu: p.contenu ?? '',
      quand: p.date instanceof Date ? timeAgo(p.date) : '',
      likes: p.likes ?? 0,
      likedByMe: !!me && Array.isArray(p.likedBy) && p.likedBy.includes(me),
      commentaires: comments.map((c) => ({
        id: c.id,
        auteur: c.auteur || 'Membre EquiShow',
        initiales: c.initiales || (c.auteur || '?').slice(0, 2).toUpperCase(),
        couleur: c.couleur || '#7C3AED',
        texte: c.texte ?? '',
        quand: c.date ?? '',
        likes: c.likes ?? 0,
        likedByMe: !!me && Array.isArray(c.likedBy) && c.likedBy.includes(me),
        photoUrls: (Array.isArray(c.imageUrls) ? c.imageUrls : []).map(communityPhotoUrl).filter(Boolean),
      })),
      photos: paths.length,
      photoUrls: paths.map(communityPhotoUrl).filter(Boolean),
      mine: !!me && p.auteurId === me,
    };
  }), [posts, me]);

  // Dernière liste réelle connue — évite de faire clignoter la section vers
  // la démo (ou vers vide) pendant un rechargement ou une transition de session.
  const lastReal = useRef<V2Post[]>([]);
  if (real.length) lastReal.current = real;

  const noSession = useMemo(() => ({ error: 'Connecte-toi pour interagir.' }), []);
  const noop = useMemo(() => async () => noSession, [noSession]);

  return useMemo(() => {
    // Connecté (ou auth encore en cours) : JAMAIS de démo. On montre le réel,
    // sinon la dernière liste connue, sinon vide (la section affiche un skelette).
    if (isSignedIn || authLoading) {
      const list = real.length ? real : lastReal.current;
      return { ready: isSignedIn && !authLoading && !isLoading, demo: false, posts: list, toggleLike, addComment, deletePost, createPost };
    }
    // Vraiment déconnecté : démonstration de découverte (lecture seule).
    return { ready: true, demo: true, posts: DEMO[scope] ?? [], toggleLike: noop, addComment: noop, deletePost: noop, createPost: noop };
  }, [isSignedIn, authLoading, isLoading, real, scope, toggleLike, addComment, deletePost, createPost, noop]);
}
