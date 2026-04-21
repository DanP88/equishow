export interface Notification {
  id: string;
  type: 'stage_reservation' | 'box_reservation' | 'transport_reservation' | 'course_request' | 'reservation_request' | 'message' | 'like' | 'comment';
  titre: string;
  message: string;
  lu?: boolean;
  lue?: boolean;
  userId?: string;
  destinataireId?: string;
  auteurId?: string;
  auteurNom?: string;
  auteurPseudo?: string;
  auteurInitiales?: string;
  auteurCouleur?: string;
  status?: 'pending' | 'accepted' | 'rejected' | 'paid';
  dateCreation: Date;
  actionUrl?: string;
  lien?: string;
  donnees?: {
    stageId?: string;
    stageTitre?: string;
    nombreParticipants?: number;
    prixTotal?: number;
    message?: string;
    annonceId?: string;
    annonceTitre?: string;
    transportId?: string;
    boxId?: string;
    titre?: string;
    prix?: number;
    postId?: string;
    convId?: string;
  };
}
