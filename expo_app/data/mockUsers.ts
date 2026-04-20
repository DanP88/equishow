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
    email: 'sarah.lefebvre@email.fr',
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
    accountKey: 'cavalier' as const,
    role: 'cavalier' as const,
    email: 'sarah.lefebvre@email.fr',
    password: 'test123',
    label: 'Sarah Lefebvre',
    icon: '🏇',
    description: 'Cavalier test #1',
  },
  {
    accountKey: 'cavalier2' as const,
    role: 'cavalier' as const,
    email: 'cavalier2@equishow.test',
    password: 'test123',
    label: 'Sophie Dupont',
    icon: '🏇',
    description: 'Cavalier test #2 - Annonces: Trajet, Van, Box',
  },
  {
    accountKey: 'coach' as const,
    role: 'coach' as const,
    email: 'emilie.laurent@email.fr',
    password: 'test123',
    label: 'Émilie Laurent',
    icon: '🎓',
  },
  {
    accountKey: 'organisateur' as const,
    role: 'organisateur' as const,
    email: 'contact@ceclyon.fr',
    password: 'test123',
    label: 'Club Équestre de Lyon',
    icon: '🏟️',
  },
  {
    accountKey: 'admin' as const,
    role: 'admin' as const,
    email: 'admin@equishow.fr',
    password: 'admin123',
    label: 'Admin Equishow',
    icon: '⚙️',
  },
];
