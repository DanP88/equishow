// ─────────────────────────────────────────────────────────────────────────────
// v2/state/coachContactLocal — « Contacter » un coach, SIMULÉ (phase front-only).
//
//   Aucune ligne `conversations` n'est créée en base pendant cette phase.
//   On enregistre juste l'intention localement pour que le parcours soit
//   testable (une entrée apparaît en tête de la Messagerie V2, étiquetée
//   « simulé »). Phase 2 : brancher getOrCreateConversation (messagerie réelle).
//
// AsyncStorage `v2:coach-contact`.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from '../lib/persist';

const KEY = 'coach-contact';

export interface CoachContactDraft {
  id: string;
  coachUserId?: string;
  coachNom: string;
  coachInitiales: string;
  coachCouleur: string;
  concoursId?: string;
  concoursNom?: string;
  createdAt: string;
}

interface Store { list: CoachContactDraft[]; hydrated: boolean }
let state: Store = { list: [], hydrated: false };
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const getSnapshot = () => state;

function persist() { void saveJSON(KEY, { list: state.list }); }

let initialized = false;
function initOnce() {
  if (initialized) return;
  initialized = true;
  void (async () => {
    const d = await loadJSON<{ list?: CoachContactDraft[] }>(KEY, {});
    state = { list: d.list ?? [], hydrated: true };
    emit();
  })();
}
initOnce();

const uid = () => `v2cc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/** Enregistre une intention de contact (dédupliquée par coach + concours). */
export function contactCoach(d: Omit<CoachContactDraft, 'id' | 'createdAt'>): CoachContactDraft {
  const existing = state.list.find(
    (x) => x.coachNom === d.coachNom && x.concoursId === d.concoursId,
  );
  if (existing) return existing;
  const rec: CoachContactDraft = { ...d, id: uid(), createdAt: new Date().toISOString() };
  state = { ...state, list: [rec, ...state.list] };
  emit(); persist();
  return rec;
}

export function useCoachContacts() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const contact = useCallback((d: Omit<CoachContactDraft, 'id' | 'createdAt'>) => contactCoach(d), []);
  return { ready: s.hydrated, contacts: s.list, contact };
}
