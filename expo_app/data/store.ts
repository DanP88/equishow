// Types CoachProfil/CoachAnnonce/etc. retirés de store.ts P24 phase 5
// (plus de stores mock à typer — utilisés directement par les hooks Supabase).
import { Concours, ConcoursCSV, ImportBatch, ImportError } from '../types/concours';
// mockCoachs/Annonces/Stages retirés P24 phase 5 — données live via Supabase.
import { mockConcours } from './mockConcours';
import { mockConcoursCsv } from './mockConcoursCsv';
import { mockUsers } from './mockUsers';

// ⚠️ Instance Supabase UNIQUE : on re-export depuis lib/supabase.ts pour ne pas créer
// un 2e GoTrueClient (cause des "Lock was stolen by another request" et auth qui rate).
// Tous les imports `import { supabase } from '../data/store'` continuent de fonctionner.
export { supabase } from '../lib/supabase';

// Interface for userStore with switchAccount method
export interface UserStore {
  id: string;
  prenom: string;
  nom: string;
  pseudo: string;
  email: string;
  role: 'cavalier' | 'coach' | 'organisateur' | 'admin';
  plan: string;
  region: string;
  disciplines: string[];
  bio: string;
  avatarColor: string;
  switchAccount(accountKey: 'cavalier' | 'cavalier2' | 'coach' | 'coach2' | 'coach3' | 'organisateur' | 'admin'): boolean;
  onRoleChange(callback: () => void): () => void;
  applyRemoteProfile(remote: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
    role: 'cavalier' | 'coach' | 'organisateur' | 'admin';
    region?: string | null;
    disciplines?: string[] | null;
    plan?: string | null;
  }): void;
}

// Helper function to get avatar color by role
function getAvatarColorForRole(role: 'cavalier' | 'coach' | 'organisateur' | 'admin'): string {
  if (role === 'coach') return '#7C3AED';
  if (role === 'organisateur') return '#0369A1';
  if (role === 'admin') return '#6B7280';
  return '#F97316';
}

// Listeners for role changes
const roleChangeListeners: Set<() => void> = new Set();

// Store utilisateur avec support du changement de compte
const createUserStore = (): UserStore => {
  const user = mockUsers.cavalier;
  const store: UserStore = {
    id: user.id,
    prenom: user.prenom,
    nom: user.nom,
    pseudo: `${user.prenom}${user.nom.charAt(0)}`,
    email: user.email,
    role: user.role as 'cavalier' | 'coach' | 'organisateur' | 'admin',
    plan: 'Gratuit',
    region: user.region || '',
    disciplines: user.disciplines,
    bio: '',
    avatarColor: getAvatarColorForRole(user.role),
    switchAccount(accountKey: 'cavalier' | 'cavalier2' | 'coach' | 'coach2' | 'coach3' | 'organisateur' | 'admin') {
      // Hors build de développement, switchAccount est un no-op pour empêcher
      // qu'on puisse changer de rôle/identité depuis la console navigateur en prod.
      if (!__DEV__) {
        console.warn('switchAccount is disabled in production builds');
        return false;
      }
      let newUser = (mockUsers as any)[accountKey];
      // Handle coach2 and coach3 from ADDITIONAL_COACHES
      if (!newUser && (accountKey === 'coach2' || accountKey === 'coach3')) {
        const { ADDITIONAL_COACHES } = require('./mockUsers');
        newUser = ADDITIONAL_COACHES[accountKey];
      }
      if (!newUser) return false;

      this.id = newUser.id;
      this.prenom = newUser.prenom;
      this.nom = newUser.nom;
      this.pseudo = `${newUser.prenom}${newUser.nom.charAt(0)}`;
      this.email = newUser.email;
      this.role = newUser.role as 'cavalier' | 'coach' | 'organisateur' | 'admin';
      this.region = newUser.region || '';
      this.disciplines = newUser.disciplines;
      this.avatarColor = getAvatarColorForRole(newUser.role);

      // Notifier tous les listeners du changement de rôle
      roleChangeListeners.forEach(callback => callback());

      return true;
    },
    onRoleChange(callback: () => void) {
      roleChangeListeners.add(callback);
      return () => {
        roleChangeListeners.delete(callback);
      };
    },
    applyRemoteProfile(remote) {
      this.id = remote.id;
      this.prenom = remote.prenom;
      this.nom = remote.nom;
      this.pseudo = `${remote.prenom}${(remote.nom ?? '').charAt(0)}`;
      this.email = remote.email;
      this.role = remote.role;
      this.region = remote.region || '';
      this.disciplines = remote.disciplines || [];
      // plan : source de vérité = DB ; fallback 'Gratuit' si absent (sécurité).
      this.plan = remote.plan || 'Gratuit';
      this.avatarColor = getAvatarColorForRole(remote.role);
      roleChangeListeners.forEach(callback => callback());
    }
  };
  return store;
};

export const userStore = createUserStore();

// Stores partagés pour les annonces.
// - transportsStore retiré P22 (hook useTransportAnnonces)
// - boxesStore retiré P23 (hook useBoxAnnonces)
// - coachesStore retiré P24 phase 5 (hook useCoachProfiles, mig 024)
// - coachAnnoncesStore retiré P24 phase 5 (hook useCoachAnnonces)
// - coachStagesStore retiré P24 phase 5 (hook useStages)
export const concoursStore: { list: Concours[] } = { list: [...mockConcours] };

// Store des concours importés via CSV
export const concoursCsvStore: {
  list: ConcoursCSV[];
  batches: ImportBatch[];
  errors: ImportError[];
} = {
  list: [...mockConcoursCsv],
  batches: [{
    id: 'batch_demo_100',
    filename: 'concours_demo_100.csv',
    imported_at: new Date().toISOString(),
    total_rows: 100,
    imported_count: 100,
    error_count: 0,
    skipped_count: 0,
  }],
  errors: [],
};

// transportReservationsStore retiré P22 (hook useMyTransportReservations).
// boxReservationsStore retiré P23 (hook useMyBoxReservations).
// stageReservationsStore retiré P24 phase 5 (hook useMyStageReservations).
// courseDemandesStore retiré P24 phase 5 (hook useMyCourseDemands).
// coachAgendaStore retiré P24 phase 5 (agenda dérivé des demandes/réservations).

// Messagerie 100% migrée sur Supabase (mig 038). L'ancien store mémoire
// (messagesStore + getOrCreateConversation/sendMessageToConv/markConvAsRead/
// totalUnreadForUser + types Message/Conversation) a été retiré. Voir
// hooks/useMessaging.ts (conversations, messages, conversation_reads, realtime).

// Types pour la communauté
export interface CommunauteComment {
  id: string;
  auteurId: string;
  auteur: string;
  initiales: string;
  couleur: string;
  texte: string;
  date: string;
  likes: number;
  likedBy: string[]; // userIds qui ont aimé ce commentaire
}

export interface CommunautePost {
  id: string;
  auteurId: string;
  auteur: string;
  initiales: string;
  couleur: string;
  contenu: string;
  date: Date;
  likes: number;
  likedBy: string[]; // userIds qui ont aimé
  commentaires: CommunauteComment[];
}

// postsStore retiré P26 — community posts migrés sur Supabase (mig 025).
// Hook : useCommunautePosts('community' | 'coach' | 'organisateur').

// ── Followers system ─────────────────────────────────────────────────────────

export interface FollowItem {
  followerId: string;
  followedId: string;
  created_at: string;
}

// UUIDs des comptes mock
const _CAV1 = '550e8400-e29b-41d4-a716-446655440001'; // Sarah Lefebvre
const _CAV2 = '550e8400-e29b-41d4-a716-446655440099'; // Sophie Dupont
const _COACH1 = '550e8400-e29b-41d4-a716-446655440002'; // Émilie Laurent
const _COACH2 = '550e8400-e29b-41d4-a716-446655440004'; // Marc Dubois
const _COACH3 = '550e8400-e29b-41d4-a716-446655440005'; // Sophie Martin (coach3)
const _ORG = '550e8400-e29b-41d4-a716-446655440003';   // Julien Mercier

function fw(followerId: string, followedId: string): FollowItem {
  return { followerId, followedId, created_at: new Date().toISOString() };
}

export const followStore: { list: FollowItem[] } = {
  list: [
    // Sarah suit les coachs et l'organisateur
    fw(_CAV1, _COACH1), fw(_CAV1, _COACH2), fw(_CAV1, _ORG),
    // Sophie suit Sarah et Émilie
    fw(_CAV2, _CAV1), fw(_CAV2, _COACH1),
    // Marc suit Sarah et l'org
    fw(_COACH2, _CAV1), fw(_COACH2, _ORG),
    // Émilie suit Sarah
    fw(_COACH1, _CAV1),
    // Communauté users suivent Sarah
    fw('user_thomas', _CAV1), fw('user_marie', _CAV1), fw('user_sophie', _COACH1),
  ],
};

export function isFollowing(followerId: string, followedId: string): boolean {
  return followStore.list.some(f => f.followerId === followerId && f.followedId === followedId);
}

export function getFollowers(userId: string): FollowItem[] {
  return followStore.list.filter(f => f.followedId === userId);
}

export function getFollowing(userId: string): FollowItem[] {
  return followStore.list.filter(f => f.followerId === userId);
}

/** Bascule le suivi. Retourne true si maintenant suivi, false si désabonné. */
export function toggleFollow(followerId: string, followedId: string): boolean {
  const idx = followStore.list.findIndex(f => f.followerId === followerId && f.followedId === followedId);
  if (idx >= 0) {
    followStore.list.splice(idx, 1);
    return false;
  }
  followStore.list.push(fw(followerId, followedId));
  return true;
}

/** Résout un userId en infos d'affichage (nom, initiales, couleur, rôle, pseudo) */
export function getUserInfo(id: string): {
  nom: string; initiales: string; couleur: string; role: string; pseudo: string;
} {
  const { getUserById } = require('./mockUsers');
  const u = getUserById(id);
  if (u) return { nom: `${u.prenom} ${u.nom}`.trim(), initiales: u.initiales, couleur: u.avatarColor, role: u.role, pseudo: u.pseudo };
  const community: Record<string, { nom: string; initiales: string; couleur: string; role: string; pseudo: string }> = {
    user_thomas: { nom: 'Thomas Renard', initiales: 'TR', couleur: '#0369A1', role: 'cavalier', pseudo: 'ThomasR_CCE' },
    user_marie: { nom: 'Marie Dupont', initiales: 'MD', couleur: '#7C3AED', role: 'cavalier', pseudo: 'MarieDup_KWPN' },
    user_sophie: { nom: 'Sophie Martin', initiales: 'SM', couleur: '#16A34A', role: 'coach', pseudo: 'SophieM_Coach' },
    user_emilie: { nom: 'Émilie Laurent', initiales: 'EL', couleur: '#7C3AED', role: 'cavalier', pseudo: 'EmilieL_Cav' },
    user_lucie: { nom: 'Lucie Bernard', initiales: 'LB', couleur: '#F97316', role: 'cavalier', pseudo: 'LucieBernard' },
    user_pierre: { nom: 'Pierre Morel', initiales: 'PM', couleur: '#B45309', role: 'cavalier', pseudo: 'PierreM_Equi' },
  };
  return community[id] ?? { nom: 'Utilisateur', initiales: '?', couleur: '#9CA3AF', role: 'cavalier', pseudo: id };
}
