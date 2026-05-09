export type StatutConcours = 'ouvert' | 'complet' | 'ferme' | 'termine' | 'brouillon';

// ── CSV Import types ────────────────────────────────────────────────────────

export type ConcoursCSV = {
  id: string;
  nom_concours: string;
  date_debut: string | null;
  date_fin: string | null;
  date_cloture: string | null;
  organisateur_terrain: string | null;
  organisateur_financier: string | null;
  lieu: string | null;
  type_concours: string | null;
  departement: string | null;
  cre: string | null;
  numero_concours: string | null;
  etat: string | null;
  liste_epreuves: string[];
  adresse: string | null;
  source_import: 'csv';
  import_batch_id: string | null;
  created_at: string;
};

export type ImportBatch = {
  id: string;
  filename: string;
  imported_at: string;
  total_rows: number;
  imported_count: number;
  error_count: number;
  skipped_count: number;
};

export type ImportError = {
  id: string;
  batch_id: string;
  row_number: number;
  raw_data: string;
  error_message: string;
};
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
