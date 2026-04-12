import { createClient } from '@supabase/supabase-js';
import { mockChevaux } from './mockChevaux';
import { Cheval } from '../types/cheval';
import { TransportAnnonce, BoxAnnonce, CoachProfil, CoachAnnonce } from '../types/service';
import { Concours } from '../types/concours';
import { mockTransports, mockBoxes, mockCoachs, mockCoachAnnonces } from './mockServices';
import { mockConcours } from './mockConcours';
import { mockUsers } from './mockUsers';

// Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase configuration missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const chevauxStore: { list: Cheval[] } = { list: [...mockChevaux] };

// Interface for userStore with switchAccount method
export interface UserStore {
  id: string;
  prenom: string;
  nom: string;
  pseudo: string;
  email: string;
  role: 'cavalier' | 'coach' | 'organisateur';
  plan: string;
  region: string;
  disciplines: string[];
  bio: string;
  avatarColor: string;
  switchAccount(accountKey: 'cavalier' | 'coach' | 'organisateur'): boolean;
  onRoleChange(callback: () => void): () => void;
}

// Helper function to get avatar color by role
function getAvatarColorForRole(role: 'cavalier' | 'coach' | 'organisateur'): string {
  if (role === 'coach') return '#7C3AED';
  if (role === 'organisateur') return '#0369A1';
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
    role: user.role as 'cavalier' | 'coach' | 'organisateur',
    plan: 'Gratuit',
    region: user.region || 'Non défini',
    disciplines: user.disciplines,
    bio: '',
    avatarColor: getAvatarColorForRole(user.role),
    switchAccount(accountKey: 'cavalier' | 'coach' | 'organisateur') {
      const newUser = mockUsers[accountKey];
      if (!newUser) return false;

      this.id = newUser.id;
      this.prenom = newUser.prenom;
      this.nom = newUser.nom;
      this.pseudo = `${newUser.prenom}${newUser.nom.charAt(0)}`;
      this.email = newUser.email;
      this.role = newUser.role as 'cavalier' | 'coach' | 'organisateur';
      this.region = newUser.region || 'Non défini';
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
    }
  };
  return store;
};

export const userStore = createUserStore();

// Stores partagés pour les annonces (s'alimentent depuis les formulaires)
export const transportsStore: { list: TransportAnnonce[] } = { list: [...mockTransports] };
export const boxesStore: { list: BoxAnnonce[] } = { list: [...mockBoxes] };
export const coachesStore: { list: CoachProfil[] } = { list: [...mockCoachs] };
export const coachAnnoncesStore: { list: CoachAnnonce[] } = { list: [...mockCoachAnnonces] };
export const concoursStore: { list: Concours[] } = { list: [...mockConcours] };
