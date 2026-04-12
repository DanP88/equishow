export type StatutConcours = 'ouvert' | 'complet' | 'ferme' | 'termine' | 'brouillon';
export type StatutEpreuve = 'a_venir' | 'en_cours' | 'termine';

export interface ResultatEpreuve {
  rang: number;
  cavalier: string;
  cheval: string;
  score: string;
  points: number;
}

export interface Epreuve {
  id: string;
  nom: string;
  heure: string;
  statut: StatutEpreuve;
  resultats: ResultatEpreuve[];
}

export interface InfosComplementaires {
  restauration?: string;
  parking?: string;
  coaching?: boolean;
  securite?: string;
  veterinaire?: boolean;
  soinsChevauxDisponibles?: boolean;
  douches?: boolean;
  wifi?: boolean;
  autre?: string;
}

export interface Concours {
  id: string;
  nom: string;
  dateDebut: Date;
  dateFin: Date;
  lieu: string;
  adresseComplete?: string;
  codePostal?: string;
  ville?: string;
  discipline: string;
  disciplines: string[];
  epreuves: string[];
  typesCavaliers: string[]; // 'poney', 'amateur', 'pro', 'loisir', etc.
  organisateurId: string;
  organisateurNom: string;
  statut: StatutConcours;
  nbPlaces: number;
  nbInscrits: number;
  description?: string;
  photoUrl?: string;
  prix?: number;
  region?: string;
  horaireDebut?: string; // "09:00"
  horaireFin?: string;   // "18:00"
  meteo?: string;
  enLive: boolean;
  infosComplementaires?: InfosComplementaires;
  niveaux?: string[];
  pricesParCategorie?: { [key: string]: number };
}
