// ─────────────────────────────────────────────────────────────────────────────
// v2/state/chevauxLocal — CHEVAUX V2 créés localement (F8, front-only).
//
// AsyncStorage `v2:chevaux`. Sert le CAS B (« aucun cheval » → « Ajouter un
// cheval ») sans jamais écrire dans `public.chevaux` (V1 `createCheval` fait un
// INSERT Supabase — INTERDIT en V2).
//
//   - IDs préfixés `v2c-` → aucune collision possible avec les UUID réels.
//   - Champs = sous-ensemble lisible de `Cheval` (identité + sport), suffisant
//     pour la préparation d'un concours. Pas de santé / gestion / photos.
//
// Singleton + useSyncExternalStore. Miroir des autres stores locaux V2.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from '../lib/persist';

const KEY = 'chevaux';

/** Suivi santé local (F11) — dates du dernier rappel, format 'YYYY-MM-DD'. */
export interface LocalSante {
  grippe?: string;
  rhino?: string;
  vermifuge?: string;
  marechal?: string;
  dentiste?: string;
  osteo?: string;
}

export interface LocalCheval {
  id: string;            // `v2c-…`
  nom: string;
  race?: string;
  robe?: string;
  sexe?: string;         // 'Hongre' | 'Jument' | 'Étalon' | ''
  anneeNaissance?: number;
  taille?: string;       // cm
  discipline?: string;
  sante?: LocalSante;
  couleur: string;       // pastille (déterministe)
  createdAt: string;
}

const PALETTE = ['#7C3AED', '#0369A1', '#16A34A', '#DB2777', '#D97706', '#0891B2'];
function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

interface Store { list: LocalCheval[]; hydrated: boolean }
let state: Store = { list: [], hydrated: false };

const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const getSnapshot = () => state;

function persist() { void saveJSON(KEY, state.list); }
function set(list: LocalCheval[]) { state = { ...state, list }; emit(); persist(); }

let initialized = false;
function initOnce() {
  if (initialized) return;
  initialized = true;
  void (async () => {
    const list = await loadJSON<LocalCheval[]>(KEY, []);
    state = { list: Array.isArray(list) ? list : [], hydrated: true };
    emit();
  })();
}
initOnce();

const uid = () => `v2c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export type LocalChevalInput = Omit<LocalCheval, 'id' | 'couleur' | 'createdAt'>;

export function addLocalCheval(input: LocalChevalInput): LocalCheval {
  const id = uid();
  const rec: LocalCheval = { ...input, id, couleur: colorFor(input.nom || id), createdAt: new Date().toISOString() };
  set([...state.list, rec]);
  return rec;
}
export function updateLocalCheval(id: string, patch: Partial<LocalChevalInput>) {
  set(state.list.map((c) => (c.id === id ? { ...c, ...patch, couleur: patch.nom ? colorFor(patch.nom) : c.couleur } : c)));
}
export function removeLocalCheval(id: string) {
  set(state.list.filter((c) => c.id !== id));
}
export function getLocalCheval(id: string): LocalCheval | undefined {
  return state.list.find((c) => c.id === id);
}
export function clearLocalChevaux() { set([]); }

/** true si l'id désigne un cheval local V2 (vs un cheval réel Supabase). */
export function isLocalHorseId(id?: string | null): boolean {
  return !!id && id.startsWith('v2c-');
}

export function useChevauxLocal() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ready: s.hydrated,
    chevaux: s.list,
    add: addLocalCheval,
    update: updateLocalCheval,
    remove: useCallback(removeLocalCheval, []),
    get: getLocalCheval,
  };
}
