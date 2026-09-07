// v2/mocks/coach — jeux de DÉMONSTRATION (prototype non connecté seulement).
// __mock: true. Jamais mêlés à des données réelles pour un compte connecté.
export interface MockCoach {
  __mock: true;
  id: string;
  nom: string;
  initiales: string;
  couleur: string;
  note: number;
  disciplines: string;       // libellé lisible
  niveaux: string;           // libellé lisible
  prixSeance: number;        // € par séance
  coachedHere: number;       // nb de cavaliers coachés sur ce concours (preuve sociale)
  places: number;            // créneaux restants
  type: 'concours' | 'regulier';
  concoursNom?: string;
  description?: string;
}

export const MOCK_COACHES: MockCoach[] = [
  {
    __mock: true, id: 'demo-c1', nom: 'Émilie Laurent', initiales: 'EL', couleur: '#7C3AED',
    note: 4.8, disciplines: 'CSO · Hunter', niveaux: 'Club → Amateur', prixSeance: 45,
    coachedHere: 6, places: 3, type: 'concours', concoursNom: 'Jumping de La Baule',
    description: 'Détente + tour de reconnaissance + débrief vidéo. Sur le paddock dès 7 h.',
  },
  {
    __mock: true, id: 'demo-c2', nom: 'Marc Dubois', initiales: 'MD', couleur: '#0369A1',
    note: 4.6, disciplines: 'CSO', niveaux: 'Amateur → Pro', prixSeance: 60,
    coachedHere: 2, places: 1, type: 'concours', concoursNom: 'Jumping de La Baule',
    description: 'Coaching compétition, préparation mentale incluse.',
  },
  {
    __mock: true, id: 'demo-c3', nom: 'Caroline Mercier', initiales: 'CM', couleur: '#16A34A',
    note: 4.9, disciplines: 'Dressage · CCE', niveaux: 'Club → Amateur', prixSeance: 40,
    coachedHere: 4, places: 4, type: 'concours', concoursNom: 'Jumping de La Baule',
  },
];
