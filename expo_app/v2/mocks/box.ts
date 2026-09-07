// v2/mocks/box — jeux de DÉMONSTRATION (prototype non connecté seulement).
// __mock: true. Jamais mêlés à des données réelles pour un compte connecté.
export interface MockBox {
  __mock: true;
  id: string;
  hote: string;
  initiales: string;
  couleur: string;
  note: number;
  lieu: string;
  distanceKm: number;      // distance au site du concours (preuve de proximité)
  dateDebut: string;       // 'YYYY-MM-DD'
  dateFin: string;
  nbBox: number;
  nbBoxDisponibles: number;
  prixNuit: number;        // € par box et par nuit
  litiereIncluse: boolean;
  equipements?: string;
  concoursNom?: string;
  description?: string;
}

export const MOCK_BOXES: MockBox[] = [
  {
    __mock: true, id: 'demo-b1', hote: 'Écurie du Golfe', initiales: 'EG', couleur: '#0369A1',
    note: 4.8, lieu: 'Saint-André-des-Eaux', distanceKm: 6,
    dateDebut: '2026-09-10', dateFin: '2026-09-13', nbBox: 4, nbBoxDisponibles: 3, prixNuit: 25,
    litiereIncluse: true, equipements: 'Paddock, douche chevaux, point d\'eau',
    concoursNom: 'Jumping de La Baule', description: 'Boxes en dur 3×3, foin à disposition, gardiennage nuit.',
  },
  {
    __mock: true, id: 'demo-b2', hote: 'Haras de Kerlan', initiales: 'HK', couleur: '#7C3AED',
    note: 4.6, lieu: 'Guérande', distanceKm: 11,
    dateDebut: '2026-09-11', dateFin: '2026-09-13', nbBox: 2, nbBoxDisponibles: 1, prixNuit: 22,
    litiereIncluse: false, equipements: 'Rond de longe, sellerie fermée',
    concoursNom: 'Jumping de La Baule', description: 'Litière copeaux en supplément (8 €/box).',
  },
  {
    __mock: true, id: 'demo-b3', hote: 'Centre équestre de La Baule', initiales: 'CB', couleur: '#16A34A',
    note: 4.9, lieu: 'La Baule-Escoublac', distanceKm: 2,
    dateDebut: '2026-09-10', dateFin: '2026-09-14', nbBox: 6, nbBoxDisponibles: 4, prixNuit: 30,
    litiereIncluse: true, equipements: 'Sur site, carrière éclairée, van parking',
    concoursNom: 'Jumping de La Baule',
  },
];
