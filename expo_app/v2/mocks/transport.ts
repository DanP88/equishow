// v2/mocks/transport — jeux de DÉMONSTRATION (prototype non connecté seulement).
// __mock: true. Jamais mêlés à des données réelles pour un compte connecté.
export interface MockTransport {
  __mock: true;
  id: string;
  conducteur: string;
  initiales: string;
  couleur: string;
  note: number;
  trajets: number;         // nb de trajets réalisés (preuve sociale)
  depart: string;
  destination: string;
  date: string;            // 'YYYY-MM-DD'
  heure: string;
  allerRetour: boolean;
  places: number;
  placesTotal: number;
  prix: number;            // € par place
  concoursNom?: string;
  peutTransporterCavalier: boolean;
  description?: string;
}

export const MOCK_TRANSPORTS: MockTransport[] = [
  {
    __mock: true, id: 'demo-t1', conducteur: 'Marc Dubois', initiales: 'MD', couleur: '#0369A1',
    note: 4.9, trajets: 23, depart: 'Nantes', destination: 'La Baule', date: '2026-09-11', heure: '07:00',
    allerRetour: true, places: 2, placesTotal: 3, prix: 45, concoursNom: 'Jumping de La Baule',
    peutTransporterCavalier: true, description: 'Van 2 places + sellerie. Départ tôt, retour dimanche soir.',
  },
  {
    __mock: true, id: 'demo-t2', conducteur: 'Claire Mercier', initiales: 'CM', couleur: '#7C3AED',
    note: 4.7, trajets: 11, depart: 'Rennes', destination: 'La Baule', date: '2026-09-11', heure: '06:30',
    allerRetour: false, places: 1, placesTotal: 2, prix: 38, concoursNom: 'Jumping de La Baule',
    peutTransporterCavalier: false, description: 'Aller simple, 1 place restante.',
  },
  {
    __mock: true, id: 'demo-t3', conducteur: 'Thomas Renard', initiales: 'TR', couleur: '#16A34A',
    note: 4.8, trajets: 34, depart: 'Angers', destination: 'La Baule', date: '2026-09-12', heure: '08:15',
    allerRetour: true, places: 3, placesTotal: 4, prix: 40, concoursNom: 'Jumping de La Baule',
    peutTransporterCavalier: true,
  },
];
