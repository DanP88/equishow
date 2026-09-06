// ─────────────────────────────────────────────────────────────────────────────
// v2/state/concoursLocal — état « Mon concours » LOCAL (front-only).
//
// Remplace, pour la V2, les écritures réelles de useConcoursPresence /
// useConcoursFollow (V1) qui, elles, écrivent dans Supabase.
//   → « J'y serai », « Suivre », « Préparer mon concours » sont 100 % locaux
//     (AsyncStorage `v2:concours-local`). AUCUNE écriture PROD.
//
// Singleton + useSyncExternalStore (pattern useAuth / v2/capabilities).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from '../lib/persist';

const KEY = 'concours-local';

/**
 * État d'un besoin (transport / box / coach) pour un concours :
 *  - 'unset'     : « à organiser » (défaut, non décidé)
 *  - 'done'      : « organisé » / « coach prévu »
 *  - 'searching' : « je cherche »
 *  - 'offering'  : « je propose » (transport/box pour tous · coaching si capacité coach)
 *  - 'none'      : « pas nécessaire »
 */
export type NeedChoice = 'unset' | 'done' | 'searching' | 'offering' | 'none';

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

// ── libellés / statut visuel partagés (fiche + préparer) ─────────────────────
export type PrepStatus = 'ready' | 'todo' | 'searching' | 'offering' | 'skip';

export function needStatus(n: NeedChoice): PrepStatus {
  return n === 'done' ? 'ready' : n === 'searching' ? 'searching' : n === 'offering' ? 'offering' : n === 'none' ? 'skip' : 'todo';
}
export const NEED_LABEL: Record<NeedChoice, string> = {
  unset: 'À organiser', done: 'Organisé', searching: 'Je cherche', offering: 'Je propose', none: 'Pas nécessaire',
};
export const STATUS_META: Record<PrepStatus, { label: string; dot: string; tone: 'ready' | 'todo' | 'searching' | 'offering' | 'skip' }> = {
  ready:     { label: '✅ Prêt',            dot: '#16A34A', tone: 'ready' },
  todo:      { label: '🟠 À organiser',     dot: '#F97316', tone: 'todo' },
  searching: { label: '🔎 Recherche',       dot: '#3B82F6', tone: 'searching' },
  offering:  { label: '📣 Je propose',      dot: '#7C3AED', tone: 'offering' },
  skip:      { label: '➖ Pas nécessaire',  dot: '#9CA3AF', tone: 'skip' },
};

/** true si l'élément compte comme « décidé » dans le compteur de préparation. */
function decided(n: NeedChoice) { return n !== 'unset'; }

/** Détail de préparation : 5 éléments, chacun ready/decided ou non. */
export function prepDetail(e: ConcoursLocalEntry) {
  const items = [
    { key: 'cheval', decided: !!e.chevalId },
    { key: 'epreuves', decided: e.epreuves.length > 0 },
    { key: 'transport', decided: decided(e.needTransport) },
    { key: 'box', decided: decided(e.needBox) },
    { key: 'coach', decided: decided(e.needCoach) },
  ];
  return { items, score: items.filter((i) => i.decided).length, total: items.length };
}

export function prepScore(e: ConcoursLocalEntry): number {
  return prepDetail(e).score;
}

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
    prep: prepDetail(entry),
    prepScore: prepScore(entry),
    followingIds: Object.keys(s.map).filter((id) => s.map[id].following),
    goingIds: Object.keys(s.map).filter((id) => s.map[id].going),
    toggleFollow,
    setGoing,
    update,
  };
}
