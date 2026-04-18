// Types de services avec commissions configurables
export type ServiceType = 'trajet' | 'location' | 'cours' | 'box';

export interface CommissionConfig {
  trajet: number;
  location: number;
  cours: number;
  box: number;
}

// Commissions de la plateforme (modifiables par l'admin)
let APP_COMMISSIONS: CommissionConfig = {
  trajet: 0.05,      // 5% par défaut
  location: 0.05,    // 5% par défaut
  cours: 0.05,       // 5% par défaut
  box: 0.05,         // 5% par défaut
};

// Listeners pour les changements de commissions
const commissionChangeListeners: Set<() => void> = new Set();

export function getCommission(serviceType: ServiceType = 'trajet'): number {
  return APP_COMMISSIONS[serviceType];
}

export function getCommissions(): CommissionConfig {
  return { ...APP_COMMISSIONS };
}

export function setCommission(serviceType: ServiceType, commission: number): void {
  const validCommission = Math.max(0, Math.min(commission, 1)); // Entre 0 et 100%
  APP_COMMISSIONS[serviceType] = validCommission;
  notifyCommissionChange();
}

export function setCommissions(commissions: Partial<CommissionConfig>): void {
  Object.keys(commissions).forEach((key) => {
    const serviceType = key as ServiceType;
    const commission = commissions[serviceType];
    if (commission !== undefined) {
      APP_COMMISSIONS[serviceType] = Math.max(0, Math.min(commission, 1));
    }
  });
  notifyCommissionChange();
}

export function onCommissionChange(callback: () => void): () => void {
  commissionChangeListeners.add(callback);
  return () => {
    commissionChangeListeners.delete(callback);
  };
}

function notifyCommissionChange() {
  commissionChangeListeners.forEach(callback => callback());
}

export function prixTTC(prixHT: number, serviceType: ServiceType = 'trajet'): number {
  // TTC = HT + Commission + TVA(20%)
  const commission = getCommission(serviceType);
  const tva = 0.20;
  return Math.round(prixHT * (1 + commission + tva) * 100) / 100;
}

export function getCommissionMontant(prixHT: number, serviceType: ServiceType = 'trajet'): number {
  return Math.round(prixHT * getCommission(serviceType) * 100) / 100;
}

export function getTVAMontant(prixHT: number): number {
  return Math.round(prixHT * 0.20 * 100) / 100;
}

// Backward compatibility
export const COMMISSION = getCommission('trajet');

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
  // Nouveaux champs pour transport
  typeTransport?: 'trajet' | 'location'; // trajet classique ou location de van
  adresseVan?: string; // Adresse précise du van
  heureDepart?: string; // Heure du départ (ex: "14:30")
  allerRetour?: boolean; // true si aller-retour, false si aller simple
  dateRetour?: Date; // Date du retour si allerRetour
  // Champs pour location du van
  kmInclus?: number; // Nombre de kilomètres inclus dans le tarif journalier
  tarifKmSupplémentaire?: number; // Tarif par km supplémentaire
  cautionRéparation?: number; // Montant de la caution réparation
  cautionNettoyage?: number; // Montant de la caution nettoyage
  datesDisponibles?: Date[]; // Dates où le van est disponible
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

export interface CoachStage {
  id: string;
  auteurId: string;
  auteurNom: string;
  auteurPseudo: string;
  auteurInitiales: string;
  auteurCouleur: string;
  titre: string;
  description: string;
  disciplines: string[];
  niveaux: string[];
  dateDebut: Date;
  dateFin: Date;
  nbJours: number;
  prixTTC: number;
  places: number;
  placesDisponibles: number;
  concours?: string;
  region?: string;
}

export interface StageReservation {
  id: string;
  stageId: string;
  stageTitre: string;
  coachId: string;
  coachNom: string;
  cavalierNom: string;
  cavalierPseudo: string;
  cavalierInitiales: string;
  cavalierCouleur: string;
  cavalierUserId: string;
  nombreParticipants: number;
  prixTotal: number;
  message: string;
  statut: 'pending' | 'accepted' | 'rejected';
  dateReservation: Date;
}

export interface CourseDemande {
  id: string;
  annonceId: string;
  annonceTitre: string;
  concoursNom?: string;
  coachId: string;
  coachNom: string;
  cavalierNom: string;
  cavalierPseudo: string;
  cavalierInitiales: string;
  cavalierCouleur: string;
  cavalierUserId: string;
  discipline: string;
  niveau: string;
  dateDebut: Date;
  dateFin: Date;
  nbJours: number;
  cheval: string;
  message: string;
  prixParJour: number;
  prix: number;
  statut: 'pending' | 'accepted' | 'rejected';
  dateCreation: Date;
}

export interface CoachAgendaEvent {
  id: string;
  coachId: string;
  type: 'course' | 'stage';
  titre: string;
  cavalierNom: string;
  cavalierPseudo: string;
  cavalierCouleur: string;
  discipline?: string;
  niveau?: string;
  date: Date;
  concours?: string;
  lieu?: string;
  description?: string;
  prix?: number;
}

export interface TransportReservation {
  id: string;
  transportId: string;
  sellerId: string;
  buyerId: string;
  titre: string;
  villeDepart: string;
  villeArrivee: string;
  nbPlaces: number;
  message: string;
  prixTotalHT: number;
  commissionPlateform: number;
  prixTotalTTC: number;
  statut: 'pending' | 'accepted' | 'rejected' | 'awaiting_payment' | 'paid';
  dateCreation: Date;
}

export interface BoxReservation {
  id: string;
  boxId: string;
  sellerId: string;
  buyerId: string;
  titre: string;
  lieu: string;
  nbNuits: number;
  dateDebut: Date;
  dateFin: Date;
  message: string;
  prixTotalHT: number;
  commissionPlateform: number;
  prixTotalTTC: number;
  statut: 'pending' | 'accepted' | 'rejected' | 'awaiting_payment' | 'paid';
  dateCreation: Date;
}
