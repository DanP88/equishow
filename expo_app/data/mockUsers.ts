import { UserAuth } from '../types/user';

// Real UUIDs for mock users
const UUID_CAVALIER = '550e8400-e29b-41d4-a716-446655440001';
const UUID_COACH = '550e8400-e29b-41d4-a716-446655440002';
const UUID_ORG = '550e8400-e29b-41d4-a716-446655440003';
const UUID_COACH2 = '550e8400-e29b-41d4-a716-446655440004';
const UUID_COACH3 = '550e8400-e29b-41d4-a716-446655440005';
const UUID_ADMIN = '550e8400-e29b-41d4-a716-446655440006';

export const mockUsers: Record<string, UserAuth> = {
  cavalier: {
    id: UUID_CAVALIER,
    email: 'sarah.lefebvre@email.fr',
    prenom: 'Sarah',
    nom: 'Lefebvre',
    role: 'cavalier',
    planId: 'gratuit',
    disciplines: ['CSO', 'Dressage'],
    region: 'Auvergne-Rhône-Alpes',
    avatarUrl: '',
  },
  coach: {
    id: UUID_COACH,
    email: 'emilie.laurent@email.fr',
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
    email: 'contact@ceclyon.fr',
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
    email: 'marc.dubois@email.fr',
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
    email: 'sophie.laurent@email.fr',
    prenom: 'Sophie',
    nom: 'Laurent',
    role: 'coach' as const,
    planId: 'coachPro',
    disciplines: ['CSO', 'Dressage', 'Hunter'],
    region: 'Auvergne-Rhône-Alpes',
    avatarUrl: '',
  },
};

export const TEST_ACCOUNTS = [
  {
    role: 'cavalier' as const,
    email: 'sarah.lefebvre@email.fr',
    password: 'test123',
    label: 'Sarah Lefebvre',
    icon: '🏇',
    description: 'Cavalier test #1',
  },
  {
    role: 'cavalier' as const,
    email: 'cavalier2@equishow.test',
    password: 'test123',
    label: 'Sophie Dupont',
    icon: '🏇',
    description: 'Cavalier test #2 - Annonces: Trajet, Van, Box',
  },
  {
    role: 'coach' as const,
    email: 'emilie.laurent@email.fr',
    password: 'test123',
    label: 'Émilie Laurent',
    icon: '🎓',
  },
  {
    role: 'organisateur' as const,
    email: 'contact@ceclyon.fr',
    password: 'test123',
    label: 'Club Équestre de Lyon',
    icon: '🏟️',
  },
  {
    role: 'admin' as const,
    email: 'admin@equishow.fr',
    password: 'admin123',
    label: 'Admin Equishow',
    icon: '⚙️',
  },
];
