// ─────────────────────────────────────────────────────────────────────────────
// v2/state/concoursLocal — état « Mon concours » SIMULÉ (F2, front-only).
//
// Remplace, pour la V2, les écritures réelles de useConcoursPresence /
// useConcoursFollow (V1) qui, elles, écrivent dans Supabase.
//   → « J'y serai », « Suivre », « Préparer mon concours » sont ici 100 % locaux
//     (AsyncStorage `v2:concours-local`). AUCUNE écriture PROD.
//
// Singleton + useSyncExternalStore (pattern useAuth / v2/capabilities).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from '../lib/persist';

const KEY = 'concours-local';

export type NeedChoice = 'unset' | 'done' | 'searching' | 'none';

export interface ConcoursLocalEntry {
  following: boolean;
  going: boolean;
  chevalId: string | null;
  epreuves: string[];
  needTransport: NeedChoice;
  needBox: NeedChoice;
  needCoach: NeedChoice;
}

const EMPTY: ConcoursLocalEntry = {
  following: false, going: false, chevalId: null, epreuves: [],
  needTransport: 'unset', needBox: 'unset', needCoach: 'unset',
};

type Store = { map: Record<string, ConcoursLocalEntry>; hydrated: boolean };
let state: Store = { map: {}, hydrated: false };

const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const getSnapshot = () => state;

function persist() { void saveJSON(KEY, state.map); }
function setEntry(id: string, patch: Partial<ConcoursLocalEntry>) {
  const cur = state.map[id] ?? EMPTY;
  state = { ...state, map: { ...state.map, [id]: { ...cur, ...patch } } };
  emit();
  persist();
}

let initialized = false;
function initOnce() {
  if (initialized) return;
  initialized = true;
  void (async () => {
    const map = await loadJSON<Record<string, ConcoursLocalEntry>>(KEY, {});
    state = { map: map ?? {}, hydrated: true };
    emit();
  })();
}
initOnce();

/** Nombre de items « préparés » sur 5 (cheval, épreuves, transport, box, coach). */
export function prepScore(e: ConcoursLocalEntry): number {
  let n = 0;
  if (e.chevalId) n++;
  if (e.epreuves.length) n++;
  if (e.needTransport !== 'unset') n++;
  if (e.needBox !== 'unset') n++;
  if (e.needCoach !== 'unset') n++;
  return n;
}

export function useConcoursLocal(concoursId?: string) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const entry = (concoursId && s.map[concoursId]) || EMPTY;

  const toggleFollow = useCallback(() => {
    if (!concoursId) return;
    setEntry(concoursId, { following: !(state.map[concoursId]?.following) });
  }, [concoursId]);

  const setGoing = useCallback((going: boolean) => {
    if (!concoursId) return;
    setEntry(concoursId, { going, following: going || state.map[concoursId]?.following || false });
  }, [concoursId]);

  const update = useCallback((patch: Partial<ConcoursLocalEntry>) => {
    if (!concoursId) return;
    setEntry(concoursId, patch);
  }, [concoursId]);

  return {
    ready: s.hydrated,
    entry,
    prepScore: prepScore(entry),
    followingIds: Object.keys(s.map).filter((id) => s.map[id].following),
    goingIds: Object.keys(s.map).filter((id) => s.map[id].going),
    toggleFollow,
    setGoing,
    update,
  };
}
