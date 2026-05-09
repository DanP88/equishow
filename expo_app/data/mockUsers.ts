import { UserAuth } from '../types/user';

// Real UUIDs for mock users
const UUID_CAVALIER = '550e8400-e29b-41d4-a716-446655440001';
const UUID_CAVALIER2 = '550e8400-e29b-41d4-a716-446655440099';
const UUID_COACH = '550e8400-e29b-41d4-a716-446655440002';
const UUID_ORG = '550e8400-e29b-41d4-a716-446655440003';
const UUID_COACH2 = '550e8400-e29b-41d4-a716-446655440004';
const UUID_COACH3 = '550e8400-e29b-41d4-a716-446655440005';
const UUID_ADMIN = '550e8400-e29b-41d4-a716-446655440006';

export const mockUsers: Record<string, UserAuth> = {
  cavalier: {
    id: UUID_CAVALIER,
    email: 'sarah.l@equishow.test',
    prenom: 'Sarah',
    nom: 'Lefebvre',
    role: 'cavalier',
    planId: 'gratuit',
    disciplines: ['CSO', 'Dressage'],
    region: 'Auvergne-Rhône-Alpes',
    avatarUrl: '',
  },
  cavalier2: {
    id: UUID_CAVALIER2,
    email: 'cavalier2@equishow.test',
    prenom: 'Sophie',
    nom: 'Dupont',
    role: 'cavalier',
    planId: 'gratuit',
    disciplines: ['Obstacles', 'Dressage'],
    region: 'Île-de-France',
    avatarUrl: '',
  },
  coach: {
    id: UUID_COACH,
    email: 'emilie.l@equishow.test',
    prenom: 'Émilie',
    nom: 'Laurent',
    role: 'coach',
    planId: 'coachPro',
    disciplines: ['CSO', 'Hunter'],
    region: 'Auvergne-Rhône-Alpes',
    avatarUrl: '',
  },
  organisateur: {
    id: UUID_ORG,
    email: 'julien.m@equishow.test',
    prenom: 'Julien',
    nom: 'Mercier',
    role: 'organisateur',
    planId: 'gratuit',
    disciplines: ['CSO', 'CCE', 'Dressage'],
    region: 'Auvergne-Rhône-Alpes',
    avatarUrl: '',
  },
  admin: {
    id: UUID_ADMIN,
    email: 'admin@equishow.fr',
    prenom: 'Admin',
    nom: 'Equishow',
    role: 'admin',
    planId: 'gratuit',
    disciplines: [],
    region: 'National',
    avatarUrl: '',
  },
};

// Additional coaches for display
export const ADDITIONAL_COACHES = {
  coach2: {
    id: UUID_COACH2,
    email: 'marc.d@equishow.test',
    prenom: 'Marc',
    nom: 'Dubois',
    role: 'coach' as const,
    planId: 'coachPro',
    disciplines: ['CCE', 'Dressage'],
    region: 'Auvergne-Rhône-Alpes',
    avatarUrl: '',
  },
  coach3: {
    id: UUID_COACH3,
    email: 'sophie.l@equishow.test',
    prenom: 'Sophie',
    nom: 'Laurent',
    role: 'coach' as const,
    planId: 'coachPro',
    disciplines: ['CSO', 'Dressage', 'Hunter'],
    region: 'Auvergne-Rhône-Alpes',
    avatarUrl: '',
  },
};

const AVATAR_COLOR: Record<string, string> = {
  coach: '#7C3AED',
  organisateur: '#0369A1',
  admin: '#6B7280',
  cavalier: '#F97316',
};

export function getUserById(id: string): {
  id: string; prenom: string; nom: string; pseudo: string;
  initiales: string; avatarColor: string; role: string;
  disciplines: string[]; region: string;
} | null {
  const all = { ...mockUsers, ...ADDITIONAL_COACHES };
  const found = Object.values(all).find(u => u.id === id);
  if (!found) return null;
  return {
    id: found.id,
    prenom: found.prenom,
    nom: found.nom,
    pseudo: `${found.prenom}${found.nom.charAt(0)}`,
    initiales: `${found.prenom.charAt(0)}${found.nom.charAt(0)}`,
    avatarColor: AVATAR_COLOR[found.role] ?? '#F97316',
    role: found.role,
    disciplines: found.disciplines ?? [],
    region: found.region ?? '',
  };
}

type TestAccount = {
  accountKey: 'cavalier' | 'cavalier2' | 'coach' | 'organisateur' | 'admin';
  role: 'cavalier' | 'coach' | 'organisateur' | 'admin';
  email: string;
  label: string;
  icon: string;
  description?: string;
};

// Comptes de test : disponibles uniquement en build de développement.
// En build production le tableau est vide → boutons "Comptes de test" et
// shortcut login admin/coach disparaissent du bundle, et tout appel à
// userStore.switchAccount(...) deviendra un no-op (cf. data/store.ts).
export const TEST_ACCOUNTS: TestAccount[] = __DEV__
  ? [
      {
        accountKey: 'cavalier',
        role: 'cavalier',
        email: 'sarah.l@equishow.test',
        label: 'Sarah Lefebvre',
        icon: '🏇',
        description: 'Cavalier test #1',
      },
      {
        accountKey: 'cavalier2',
        role: 'cavalier',
        email: 'cavalier2@equishow.test',
        label: 'Sophie Dupont',
        icon: '🏇',
        description: 'Cavalier test #2 - Annonces: Trajet, Van, Box',
      },
      {
        accountKey: 'coach',
        role: 'coach',
        email: 'emilie.l@equishow.test',
        label: 'Émilie Laurent',
        icon: '🎓',
      },
      {
        accountKey: 'organisateur',
        role: 'organisateur',
        email: 'julien.m@equishow.test',
        label: 'Club Équestre de Lyon',
        icon: '🏟️',
      },
      {
        accountKey: 'admin',
        role: 'admin',
        email: 'admin@equishow.fr',
        label: 'Admin Equishow',
        icon: '⚙️',
      },
    ]
  : [];
