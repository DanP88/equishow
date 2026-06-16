/**
 * PROTOTYPE LOCAL — Vision « Concours contexte + Mon déplacement ».
 * Données 100% mockées, isolées du reste de l'app. Aucune dépendance DB / Supabase.
 * Branche jetable : feature/local-concours-deplacement-prototype.
 *
 * Ce module ne modifie AUCUNE donnée existante. Il est consommé uniquement
 * par les écrans sous app/proto/*.
 */

export type ProtoPresenceStatut = 'confirme' | 'interesse';

export interface ProtoConcours {
  id: string;
  nom: string;
  emoji: string;
  dateLabel: string;
  lieu: string;
  departement: string;
  numeroFFE: string;
  lienFFE: string;       // fictif
  discipline: string;
  couleur: string;       // bandeau discipline
  vues: number;
  followers: number;
  nbBoxes: number;
  nbTransports: number;
  nbCoachs: number;
}

// 🏆 3 concours de démonstration
export const PROTO_CONCOURS: ProtoConcours[] = [
  {
    id: 'p-fontainebleau',
    nom: 'Jumping de Fontainebleau',
    emoji: '🏆',
    dateLabel: '12 – 14 juillet 2026',
    lieu: 'Grand Parquet, Fontainebleau',
    departement: '77',
    numeroFFE: '202677045',
    lienFFE: 'https://ffecompet.ffe.com/concours/202677045',
    discipline: 'CSO',
    couleur: '#16A34A',
    vues: 1342,
    followers: 87,
    nbBoxes: 8,
    nbTransports: 5,
    nbCoachs: 12,
  },
  {
    id: 'p-deauville',
    nom: 'CSO de Deauville',
    emoji: '🏆',
    dateLabel: '19 – 21 juillet 2026',
    lieu: 'Pôle International du Cheval, Deauville',
    departement: '14',
    numeroFFE: '202614088',
    lienFFE: 'https://ffecompet.ffe.com/concours/202614088',
    discipline: 'CSO',
    couleur: '#16A34A',
    vues: 643,
    followers: 41,
    nbBoxes: 3,
    nbTransports: 2,
    nbCoachs: 5,
  },
  {
    id: 'p-lyon',
    nom: 'Grand Régional de Lyon',
    emoji: '🏆',
    dateLabel: '2 – 4 août 2026',
    lieu: 'Eurexpo, Lyon',
    departement: '69',
    numeroFFE: '202669112',
    lienFFE: 'https://ffecompet.ffe.com/concours/202669112',
    discipline: 'Dressage',
    couleur: '#7C3AED',
    // Concours « mince » volontaire → sert à tester la variante anti cold-start
    vues: 58,
    followers: 4,
    nbBoxes: 0,
    nbTransports: 0,
    nbCoachs: 1,
  },
];

export function getProtoConcours(id: string): ProtoConcours | undefined {
  return PROTO_CONCOURS.find((c) => c.id === id);
}

// 🎓 Fiche coach mockée avec présence concours
export interface ProtoCoachPresence {
  concoursId: string;
  nom: string;
  dateLabel: string;
  statut: ProtoPresenceStatut;
}

export const PROTO_COACH = {
  nom: 'Sophie Martin',
  initiales: 'SM',
  couleur: '#7C3AED',
  note: 4.9,
  nbAvis: 37,
  certifie: true,
  region: 'Île-de-France',
  disciplines: ['Dressage', 'CSO'],
  niveau: 'Pro',
  tarif: 65,
  presences: [
    { concoursId: 'p-fontainebleau', nom: 'Fontainebleau', dateLabel: '12-14 juil', statut: 'confirme' as ProtoPresenceStatut },
    { concoursId: 'p-deauville',     nom: 'Deauville',     dateLabel: '19-21 juil', statut: 'confirme' as ProtoPresenceStatut },
    { concoursId: 'p-lyon',          nom: 'Lyon',          dateLabel: '2-4 août',   statut: 'interesse' as ProtoPresenceStatut },
  ] as ProtoCoachPresence[],
};

// 🏆 Mes concours (vue organisateur)
export interface ProtoOrgConcours {
  id: string;
  nom: string;
  dateLabel: string;
  lieu: string;
  statut: 'valide' | 'attente';
  vues: number;
  nbBoxes: number;
  nbTransports: number;
  nbCoachs: number;
}

export const PROTO_ORG_CONCOURS: ProtoOrgConcours[] = [
  { id: 'p-fontainebleau', nom: 'Jumping de Fontainebleau', dateLabel: '12-14 juil', lieu: 'Fontainebleau (77)', statut: 'valide', vues: 1342, nbBoxes: 8, nbTransports: 5, nbCoachs: 12 },
  { id: 'p-deauville',     nom: 'CSO de Deauville',         dateLabel: '19-21 juil', lieu: 'Deauville (14)',     statut: 'attente', vues: 0, nbBoxes: 0, nbTransports: 0, nbCoachs: 0 },
];

// 🏆 État simulé du « déplacement » courant (cross-sell + Mon déplacement)
export interface ProtoDeplacement {
  concoursId: string;
  box: boolean;
  transport: boolean;
  coach: boolean;
}

// Scénario par défaut du proto : box réservé, reste à compléter.
export const PROTO_DEPLACEMENT_DEFAULT: ProtoDeplacement = {
  concoursId: 'p-fontainebleau',
  box: true,
  transport: false,
  coach: false,
};
