// ─────────────────────────────────────────────────────────────────────────────
// v2/mocks/f2 — DONNÉES DE DÉMONSTRATION résiduelles (repli « non connecté »).
//
// ⚠️ `__mock: true`. Rien ne vient de Supabase. Utilisées UNIQUEMENT en repli
// quand la personne n'est pas connectée / qu'aucune donnée réelle n'existe :
//   · MOCK_ACTIONS       → repli « À traiter » (v2/adapters/todo)
//   · MOCK_AGENDA        → repli agenda (v2/adapters/agenda)
//   · MOCK_STUDENT_HORSES→ « chevaux que je coache » (pas de source réelle
//                          avant Phase 2 : coaching récurrent / élèves)
// Les autres mocks F2 ont été remplacés par des adapters réels (F5→F12).
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
  { __mock: true, id: 'a3', icon: '🎓', label: '2 demandes de coaching reçues', cap: 'coach', target: '/(v2)/coach?face=eleves' },
  { __mock: true, id: 'a4', icon: '📋', label: '1 concours en brouillon à publier', cap: 'organisateur', target: '/(v2)/concours?tab=organises' },
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

// (MOCK_COACH_DEMANDS / MOCK_CONVERSATIONS / MOCK_COACHES_ON_CONCOURS / MOCK_COMMUNITY
//  supprimés en F12 : remplacés par les adapters réels — v2/adapters/{coach,messaging,community}.)
