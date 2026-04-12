export const COMMISSION = 0.09; // 9%

export function prixTTC(prixHT: number): number {
  return Math.round(prixHT * (1 + COMMISSION) * 100) / 100;
}

export interface TransportAnnonce {
  id: string;
  auteurId: string;
  auteurNom: string;
  auteurPseudo: string;
  auteurInitiales: string;
  auteurCouleur: string;
  dateTrajet: Date;
  villeDepart: string;
  villeArrivee: string;
  nbPlacesTotal: number;
  nbPlacesDisponibles: number;
  prixHT: number;
  concours?: string;
  description?: string;
}

export interface BoxAnnonce {
  id: string;
  auteurId: string;
  auteurNom: string;
  auteurPseudo: string;
  auteurInitiales: string;
  auteurCouleur: string;
  lieu: string;
  dateDebut: Date;
  dateFin: Date;
  nbBoxes: number;
  nbBoxesDisponibles: number;
  prixNuitHT: number;
  concours?: string;
  description?: string;
}

export interface CoachProfil {
  id: string;
  auteurId: string;
  nom: string;
  prenom: string;
  pseudo: string;
  initiales: string;
  couleur: string;
  disciplines: string[];
  niveaux: string[];
  region: string;
  tarifHeure: number;
  bio: string;
  nbAvis: number;
  note: number;
  disponible: boolean;
  specialites: string[];
}

export interface Disponibilite {
  jour: Date;
  debut: string; // "09:00"
  fin: string;   // "17:00"
}

export interface CoachAnnonce {
  id: string;
  auteurId: string;
  auteurNom: string;
  auteurPseudo: string;
  auteurInitiales: string;
  auteurCouleur: string;
  titre: string;
  description: string;
  type: 'concours' | 'regulier';
  discipline: string;
  niveau: string;
  dateDebut: Date;
  dateFin: Date;
  prixHeure: number;
  places: number;
  placesDisponibles: number;
  concours?: string;
  region?: string;
  disponibilites?: Disponibilite[];
}
