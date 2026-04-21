import { createClient } from '@supabase/supabase-js';
import { mockChevaux } from './mockChevaux';
import { Cheval } from '../types/cheval';
import { TransportAnnonce, BoxAnnonce, CoachProfil, CoachAnnonce, CoachStage, StageReservation, CourseDemande, CoachAgendaEvent, TransportReservation, BoxReservation } from '../types/service';
import { Concours } from '../types/concours';
import { Notification } from '../types/notification';
import { mockTransports, mockBoxes, mockCoachs, mockCoachAnnonces, mockCoachStages } from './mockServices';
import { mockConcours } from './mockConcours';
import { mockUsers } from './mockUsers';

// Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase configuration missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const chevauxStore: { list: Cheval[] } = { list: [...mockChevaux] };

// Interface for userStore with switchAccount method
export interface UserStore {
  id: string;
  prenom: string;
  nom: string;
  pseudo: string;
  email: string;
  role: 'cavalier' | 'coach' | 'organisateur' | 'admin';
  plan: string;
  region: string;
  disciplines: string[];
  bio: string;
  avatarColor: string;
  switchAccount(accountKey: 'cavalier' | 'cavalier2' | 'coach' | 'coach2' | 'coach3' | 'organisateur' | 'admin'): boolean;
  onRoleChange(callback: () => void): () => void;
}

// Helper function to get avatar color by role
function getAvatarColorForRole(role: 'cavalier' | 'coach' | 'organisateur' | 'admin'): string {
  if (role === 'coach') return '#7C3AED';
  if (role === 'organisateur') return '#0369A1';
  if (role === 'admin') return '#6B7280';
  return '#F97316';
}

// Listeners for role changes
const roleChangeListeners: Set<() => void> = new Set();

// Store utilisateur avec support du changement de compte
const createUserStore = (): UserStore => {
  const user = mockUsers.cavalier;
  const store: UserStore = {
    id: user.id,
    prenom: user.prenom,
    nom: user.nom,
    pseudo: `${user.prenom}${user.nom.charAt(0)}`,
    email: user.email,
    role: user.role as 'cavalier' | 'coach' | 'organisateur' | 'admin',
    plan: 'Gratuit',
    region: user.region || 'Non défini',
    disciplines: user.disciplines,
    bio: '',
    avatarColor: getAvatarColorForRole(user.role),
    switchAccount(accountKey: 'cavalier' | 'cavalier2' | 'coach' | 'coach2' | 'coach3' | 'organisateur' | 'admin') {
      let newUser = (mockUsers as any)[accountKey];
      // Handle coach2 and coach3 from ADDITIONAL_COACHES
      if (!newUser && (accountKey === 'coach2' || accountKey === 'coach3')) {
        const { ADDITIONAL_COACHES } = require('./mockUsers');
        newUser = ADDITIONAL_COACHES[accountKey];
      }
      if (!newUser) return false;

      this.id = newUser.id;
      this.prenom = newUser.prenom;
      this.nom = newUser.nom;
      this.pseudo = `${newUser.prenom}${newUser.nom.charAt(0)}`;
      this.email = newUser.email;
      this.role = newUser.role as 'cavalier' | 'coach' | 'organisateur' | 'admin';
      this.region = newUser.region || 'Non défini';
      this.disciplines = newUser.disciplines;
      this.avatarColor = getAvatarColorForRole(newUser.role);

      // Notifier tous les listeners du changement de rôle
      roleChangeListeners.forEach(callback => callback());

      return true;
    },
    onRoleChange(callback: () => void) {
      roleChangeListeners.add(callback);
      return () => {
        roleChangeListeners.delete(callback);
      };
    }
  };
  return store;
};

export const userStore = createUserStore();

// Stores partagés pour les annonces (s'alimentent depuis les formulaires)
export const transportsStore: { list: TransportAnnonce[] } = { list: [...mockTransports] };
export const boxesStore: { list: BoxAnnonce[] } = { list: [...mockBoxes] };
export const coachesStore: { list: CoachProfil[] } = { list: [...mockCoachs] };
export const coachAnnoncesStore: { list: CoachAnnonce[] } = { list: [...mockCoachAnnonces] };
export const coachStagesStore: { list: CoachStage[] } = { list: [...mockCoachStages] };
export const concoursStore: { list: Concours[] } = { list: [...mockConcours] };

// Store des notifications
export const notificationsStore: { list: Notification[] } = { list: [] };

// Store des réservations de stages
export const stageReservationsStore: { list: StageReservation[] } = { list: [] };

// Store des demandes de cours
export const courseDemandesStore: { list: CourseDemande[] } = { list: [] };

// Store des réservations de transport
export const transportReservationsStore: { list: TransportReservation[] } = { list: [] };

// Store des réservations de box
export const boxReservationsStore: { list: BoxReservation[] } = { list: [] };

// Store de l'agenda des coachs
export const coachAgendaStore: { list: CoachAgendaEvent[] } = { list: [] };

// Types pour la messagerie
export interface Message {
  id: string;
  senderId: string;   // userId de l'expéditeur
  texte: string;
  heure: string;      // heure d'envoi (string affichage)
  ts: number;         // timestamp pour tri
}

export interface Conversation {
  id: string;
  participants: [string, string]; // [userId1, userId2]
  // Infos affichage pour chaque participant
  userA: { id: string; nom: string; pseudo: string; couleur: string; initiales: string };
  userB: { id: string; nom: string; pseudo: string; couleur: string; initiales: string };
  sujet: string;
  annonce?: string;
  annonceType?: 'transport' | 'box' | 'coach';
  messages: Message[];
  unreadBy: Record<string, number>; // { [userId]: nombre non lus }
  dernierMsg: string;
  heure: string;
}

// Store global des conversations — partagé entre tous les comptes de la session
export const messagesStore: { list: Conversation[] } = { list: [] };

/** Trouve ou crée une conversation entre deux users */
export function getOrCreateConversation(
  myId: string, myNom: string, myPseudo: string, myCouleur: string, myInitiales: string,
  otherId: string, otherNom: string, otherPseudo: string, otherCouleur: string, otherInitiales: string,
  sujet?: string, annonce?: string, annonceType?: 'transport' | 'box' | 'coach',
): Conversation {
  const existing = messagesStore.list.find(
    c => c.participants.includes(myId) && c.participants.includes(otherId)
  );
  if (existing) return existing;

  const conv: Conversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    participants: [myId, otherId],
    userA: { id: myId, nom: myNom, pseudo: myPseudo, couleur: myCouleur, initiales: myInitiales },
    userB: { id: otherId, nom: otherNom, pseudo: otherPseudo, couleur: otherCouleur, initiales: otherInitiales },
    sujet: sujet ?? '💬 Discussion',
    annonce,
    annonceType,
    messages: [],
    unreadBy: { [myId]: 0, [otherId]: 0 },
    dernierMsg: '',
    heure: '',
  };
  messagesStore.list = [conv, ...messagesStore.list];
  return conv;
}

/** Envoie un message dans une conversation */
export function sendMessageToConv(convId: string, senderId: string, texte: string) {
  const conv = messagesStore.list.find(c => c.id === convId);
  if (!conv) return;
  const now = new Date();
  const heure = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const msg: Message = { id: `m_${Date.now()}`, senderId, texte, heure, ts: now.getTime() };
  conv.messages = [...conv.messages, msg];
  conv.dernierMsg = texte;
  conv.heure = heure;
  // Incrémenter non-lus pour l'autre participant
  conv.participants.forEach(pid => {
    if (pid !== senderId) {
      conv.unreadBy[pid] = (conv.unreadBy[pid] ?? 0) + 1;
    }
  });
  // Créer une notification messagerie pour l'autre
  const senderInfo = senderId === conv.userA.id ? conv.userA : conv.userB;
  const otherId = conv.participants.find(p => p !== senderId)!;
  const notif = {
    id: `notif_msg_${Date.now()}`,
    destinataireId: otherId,
    type: 'message' as const,
    titre: `💬 Message de @${senderInfo.pseudo}`,
    message: texte.length > 60 ? texte.slice(0, 60) + '…' : texte,
    status: 'pending' as const,
    lu: false,
    dateCreation: now,
    auteurId: senderId,
    auteurNom: senderInfo.nom,
    auteurPseudo: senderInfo.pseudo,
    auteurInitiales: senderInfo.initiales,
    auteurCouleur: senderInfo.couleur,
    donnees: { convId },
  };
  notificationsStore.list = [notif, ...notificationsStore.list];
}

/** Marque tous les messages d'une conv comme lus pour un user */
export function markConvAsRead(convId: string, userId: string) {
  const conv = messagesStore.list.find(c => c.id === convId);
  if (conv) conv.unreadBy[userId] = 0;
}

/** Nombre total de messages non lus pour un user */
export function totalUnreadForUser(userId: string): number {
  return messagesStore.list.reduce((acc, c) => acc + (c.unreadBy[userId] ?? 0), 0);
}

// Types pour la communauté
export interface CommunauteComment {
  id: string;
  auteurId: string;
  auteur: string;
  initiales: string;
  couleur: string;
  texte: string;
  date: string;
  likes: number;
  likedBy: string[]; // userIds qui ont aimé ce commentaire
}

export interface CommunautePost {
  id: string;
  auteurId: string;
  auteur: string;
  initiales: string;
  couleur: string;
  contenu: string;
  date: Date;
  likes: number;
  likedBy: string[]; // userIds qui ont aimé
  commentaires: CommunauteComment[];
}

export const postsStore: { list: CommunautePost[] } = {
  list: [
    {
      id: 'p1',
      auteurId: 'user_marie',
      auteur: 'Marie Dupont',
      initiales: 'MD',
      couleur: '#7C3AED',
      contenu: 'Super week-end au concours de Lyon ! Éclipse a été parfaite sur le parcours 🏆',
      date: new Date(Date.now() - 2 * 3600000),
      likes: 14,
      likedBy: [],
      commentaires: [
        { id: 'c1', auteurId: 'user_thomas', auteur: 'Thomas Renard', initiales: 'TR', couleur: '#0369A1', texte: 'Bravo ! Quel beau résultat 👏', date: 'Il y a 1h', likes: 2, likedBy: [] },
        { id: 'c2', auteurId: 'user_sophie', auteur: 'Sophie Martin', initiales: 'SM', couleur: '#16A34A', texte: 'Trop contente pour vous ! À bientôt au prochain concours', date: 'Il y a 45min', likes: 1, likedBy: [] },
      ],
    },
    {
      id: 'p2',
      auteurId: 'user_thomas',
      auteur: 'Thomas Renard',
      initiales: 'TR',
      couleur: '#0369A1',
      contenu: "Quelqu'un a une recommandation pour un ostéopathe équin dans la région lyonnaise ?",
      date: new Date(Date.now() - 5 * 3600000),
      likes: 8,
      likedBy: [],
      commentaires: [
        { id: 'c1', auteurId: 'user_marie', auteur: 'Marie Dupont', initiales: 'MD', couleur: '#7C3AED', texte: 'Dr. Lefèvre à Grenoble, très bon !', date: 'Il y a 4h', likes: 0, likedBy: [] },
        { id: 'c2', auteurId: 'user_lucie', auteur: 'Lucie Bernard', initiales: 'LB', couleur: '#F97316', texte: 'Je te recommande Sophie Marchand, elle intervient sur tout le bassin lyonnais', date: 'Il y a 3h', likes: 0, likedBy: [] },
      ],
    },
    {
      id: 'p3',
      auteurId: 'user_sophiemartin',
      auteur: 'Sophie Martin',
      initiales: 'SM',
      couleur: '#16A34A',
      contenu: 'Résultats du Championnat Régional de Dressage disponibles ! Bravo à tous les participants 🎉',
      date: new Date(Date.now() - 24 * 3600000),
      likes: 32,
      likedBy: [],
      commentaires: [
        { id: 'c1', auteurId: 'user_emilie', auteur: 'Émilie Laurent', initiales: 'EL', couleur: '#7C3AED', texte: 'Quelle belle compétition, merci aux organisateurs !', date: 'hier', likes: 0, likedBy: [] },
      ],
    },
  ],
};
