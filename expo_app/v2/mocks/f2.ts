// ─────────────────────────────────────────────────────────────────────────────
// v2/mocks/f2 — DONNÉES SIMULÉES pour la structure de navigation F2.
//
// ⚠️ Tout objet ici porte `__mock: true`. Rien ne vient de Supabase.
// À remplacer par des données réelles / adapters aux LOTS fonctionnels (F3+).
// Inventaire : v2/mocks/INVENTORY.md
// ─────────────────────────────────────────────────────────────────────────────
import type { Capability } from '../capabilities';

export interface MockActionItem {
  __mock: true;
  id: string;
  icon: string;
  label: string;
  cap: Capability;
  target: string;
}

/** « À traiter » — agrégé par capacité. L'Accueil filtre selon useCapabilities. */
export const MOCK_ACTIONS: MockActionItem[] = [
  { __mock: true, id: 'a1', icon: '⚠', label: '1 paiement transport en attente', cap: 'cavalier', target: '/(v2)/agenda' },
  { __mock: true, id: 'a2', icon: '💬', label: 'Réponse de Caroline (coaching)', cap: 'cavalier', target: '/(v2)/messagerie' },
  { __mock: true, id: 'a3', icon: '🎓', label: '2 demandes de coaching reçues', cap: 'coach', target: '/(v2)/service/coach?face=eleves' },
  { __mock: true, id: 'a4', icon: '📋', label: '1 concours en brouillon à publier', cap: 'organisateur', target: '/(v2)/concours?tab=organises' },
];

export interface MockCommunityPost { __mock: true; id: string; author: string; text: string; when: string }
export const MOCK_COMMUNITY: MockCommunityPost[] = [
  { __mock: true, id: 'c1', author: 'Sophie D.', text: 'Quelqu’un a fait le paddock ce matin à Fontainebleau ?', when: 'il y a 2 h' },
  { __mock: true, id: 'c2', author: 'Marc L.', text: 'Cherche co-voiturage retour dimanche depuis La Baule.', when: 'il y a 5 h' },
  { __mock: true, id: 'c3', author: 'Émilie (coach)', text: 'Petit rappel : pensez au carnet de vaccination pour l’entrée sur site.', when: 'hier' },
];

export interface MockAgendaEvent {
  __mock: true; id: string; day: string; time: string; icon: string; label: string; cap: Capability | 'concours'; concours?: string;
}
export const MOCK_AGENDA: MockAgendaEvent[] = [
  { __mock: true, id: 'e1', day: 'Samedi 12 septembre', time: '07:00', icon: '🚚', label: 'Transport — Jackson', cap: 'cavalier', concours: 'Jumping de La Baule' },
  { __mock: true, id: 'e2', day: 'Samedi 12 septembre', time: '09:00', icon: '🏠', label: 'Box — Écurie du Stade', cap: 'cavalier', concours: 'Jumping de La Baule' },
  { __mock: true, id: 'e3', day: 'Samedi 12 septembre', time: '11:30', icon: '🎓', label: 'Coaching avec Émilie', cap: 'cavalier', concours: 'Jumping de La Baule' },
  { __mock: true, id: 'e4', day: 'Samedi 12 septembre', time: '15:00', icon: '🎓', label: 'Coaching — Julie / Tornado', cap: 'coach', concours: 'Jumping de La Baule' },
  { __mock: true, id: 'e5', day: 'Samedi 12 septembre', time: '16:00', icon: '🎓', label: 'Coaching — Thomas / Rio', cap: 'coach', concours: 'Jumping de La Baule' },
  { __mock: true, id: 'e6', day: 'Samedi 12 septembre', time: 'journée', icon: '🏟', label: 'CSO Amateur du Haras de X', cap: 'organisateur', concours: 'CSO Amateur du Haras de X' },
  { __mock: true, id: 'e7', day: 'Dimanche 13 septembre', time: '08:30', icon: '🎓', label: 'Coaching — Léa / Ideal', cap: 'coach', concours: 'Jumping de La Baule' },
];

export interface MockStudentHorse { __mock: true; id: string; horse: string; rider: string; discipline: string; concours?: string }
export const MOCK_STUDENT_HORSES: MockStudentHorse[] = [
  { __mock: true, id: 's1', horse: 'Tornado', rider: 'Julie D.', discipline: 'CSO Amateur', concours: 'Jumping de La Baule' },
  { __mock: true, id: 's2', horse: 'Rio', rider: 'Thomas R.', discipline: 'CSO Amateur 1', concours: 'Jumping de La Baule' },
  { __mock: true, id: 's3', horse: 'Ideal', rider: 'Léa M.', discipline: 'CSO Club 1' },
];

export interface MockDemand { __mock: true; id: string; rider: string; horse: string; concours: string; detail: string }
export const MOCK_COACH_DEMANDS: MockDemand[] = [
  { __mock: true, id: 'd1', rider: 'Thomas R.', horse: 'Rio', concours: 'Jumping de La Baule', detail: 'Amateur 1 · 1 séance' },
  { __mock: true, id: 'd2', rider: 'Léa M.', horse: 'Ideal', concours: 'Jumping de La Baule', detail: 'Club 1 · 1 séance' },
];

export interface MockConversation { __mock: true; id: string; name: string; context: string; last: string; when: string; unread: number }
export const MOCK_CONVERSATIONS: MockConversation[] = [
  { __mock: true, id: 'm1', name: 'Marc D.', context: '🚚 Transport · La Baule', last: 'Départ 7h ça te va ?', when: '10 min', unread: 2 },
  { __mock: true, id: 'm2', name: 'Émilie L.', context: '🎓 Coaching · Amateur 1', last: 'Parfait, à samedi', when: 'hier', unread: 0 },
  { __mock: true, id: 'm3', name: 'Julie D.', context: '🎓 Vous coachez · Tornado', last: 'Merci pour la séance !', when: '2 j', unread: 0 },
];

/** Coachs « présents » sur un concours (fiche concours › Coach › Je cherche). */
export interface MockCoachOnConcours { __mock: true; id: string; name: string; note: number; disciplines: string; price: number; coachedHere: number }
export const MOCK_COACHES_ON_CONCOURS: MockCoachOnConcours[] = [
  { __mock: true, id: 'co1', name: 'Émilie L.', note: 4.8, disciplines: 'CSO · Club → Amateur', price: 45, coachedHere: 6 },
  { __mock: true, id: 'co2', name: 'Marc Dubois', note: 4.6, disciplines: 'CSO · Amateur → Pro', price: 60, coachedHere: 2 },
];
