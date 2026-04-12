export type TypeCheval = 'cheval' | 'poney';

export type Temperament = 'calme' | 'nerveux' | 'sensible' | 'energique' | 'joueur' | 'timide';

export type ComportementTransport = 'calme' | 'stresse' | 'chargementDifficile' | 'autre';

export type HabitudesVie = 'pre' | 'box' | 'mix';

export type Sociabilite = 'okCongeneres' | 'dominant' | 'solitaire' | 'autre';

export type NiveauPratique = 'poney' | 'club' | 'amateur' | 'pro';

export type NiveauTravail = 'debutant' | 'confirme' | 'avance' | 'autre';

export type FrequenceTravail = '1x' | '2x' | '3x' | '4x' | 'quotidien';

export type TypeLitiere = 'paille' | 'copeaux' | 'paillette' | 'autre';

export type TypeFerrure = 'ferre4Fers' | 'ferre2Fers' | 'nuPied' | 'plastique' | 'autre';

export type VaccinStatus = 'valide' | 'expireBientot' | 'expire' | 'inconnu';

export interface SuiviSante {
  dateVaccinGrippe?: Date;
  dateVaccinRhino?: Date;
  dateVermifuge?: Date;
  dateMarechal?: Date;
  typeFerrure?: TypeFerrure;
  dateDentiste?: Date;
  dateOsteo?: Date;
  antecedents?: string;
  allergies?: string;
  pathologies?: string;
}

export interface LienUtilisateur {
  nom: string;
  userId?: string;
  email?: string;
}

export interface GestionCheval {
  proprietaire?: LienUtilisateur;
  demiPensionnaire?: LienUtilisateur;
  responsable?: LienUtilisateur;
  ecurieActuelle?: string;
  typeLitiere?: TypeLitiere;
}

export interface ConcourInscrit {
  id: string;
  nom: string;
  date: Date;
  lieu: string;
  discipline: string;
  numEngagement?: string;
}

export interface Cheval {
  id: string;
  nom: string;
  proprietaireId: string;
  type: TypeCheval;
  race?: string;
  robe?: string;
  anneeNaissance?: number;
  photoUrl?: string;
  photoColor?: string;
  sexe?: string;
  taille?: string;
  numeroSire?: string;
  temperament: Temperament[];
  comportementTransport?: ComportementTransport;
  habitudes?: HabitudesVie;
  sociabilite?: Sociabilite;
  particularitesPhysiques?: string;
  disciplines: string[];
  niveauPratique?: NiveauPratique;
  niveauTravail?: NiveauTravail;
  frequenceTravail?: FrequenceTravail;
  objectifs?: string;
  sante?: SuiviSante;
  gestion?: GestionCheval;
  concours: ConcourInscrit[];
}

// Labels
export const TypeChevalLabel: Record<TypeCheval, string> = {
  cheval: 'Cheval',
  poney: 'Poney',
};

export const TypeChevalEmoji: Record<TypeCheval, string> = {
  cheval: '🐴',
  poney: '🦄',
};

export function getChevalAge(anneeNaissance?: number): string {
  if (!anneeNaissance) return '';
  const age = new Date().getFullYear() - anneeNaissance;
  return `${age} ans`;
}

export function getChevalSubtitle(cheval: Cheval): string {
  const parts = [cheval.race, cheval.robe, getChevalAge(cheval.anneeNaissance)].filter(Boolean);
  return parts.join(' · ');
}
