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
// F14 → v2 : ignore l'état non versionné (smokes F8/F13).
// F14.1 → v3 : `setGoing` ne force plus `following` (bug « La Baule reste suivi
//   après avoir retiré « J'y serai » »). Bump → repart d'un état propre.
const SCHEMA_VERSION = 3;

export type NeedModule = 'transport' | 'box' | 'coach';

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
  /** @deprecated F8 : conservé synchronisé sur `selectedHorseIds[0]` pour les
   *  consommateurs mono-cheval (bookings, rappels). Source de vérité =
   *  `selectedHorseIds`. */
  chevalId: string | null;
  /** F8 — chevaux qui participent à CE concours (choix fait dans « Préparer
   *  mon concours › Cheval »). Propre à chaque concours. */
  selectedHorseIds: string[];
  epreuves: string[];
  needTransport: NeedChoice;
  needBox: NeedChoice;
  needCoach: NeedChoice;
  /** F14 — chevaux concernés PAR MODULE (sous-ensemble de `selectedHorseIds`).
   *  Ex : transport pour Tornado uniquement, box pour Tornado + Tomas. */
  horsesByNeed: Record<NeedModule, string[]>;
}

const EMPTY: ConcoursLocalEntry = {
  following: false, going: false, chevalId: null, selectedHorseIds: [], epreuves: [],
  needTransport: 'unset', needBox: 'unset', needCoach: 'unset',
  horsesByNeed: { transport: [], box: [], coach: [] },
};

/** Normalise une entrée chargée depuis le storage (rétro-compat). */
function reviveEntry(e: Partial<ConcoursLocalEntry> | undefined): ConcoursLocalEntry {
  const merged = { ...EMPTY, ...(e ?? {}) };
  if (!Array.isArray(merged.selectedHorseIds)) merged.selectedHorseIds = [];
  if (merged.selectedHorseIds.length === 0 && merged.chevalId) {
    merged.selectedHorseIds = [merged.chevalId];
  }
  merged.chevalId = merged.selectedHorseIds[0] ?? null;
  const hbn = (merged.horsesByNeed ?? {}) as Partial<Record<NeedModule, string[]>>;
  const clamp = (arr?: string[]) => (Array.isArray(arr) ? arr.filter((x) => merged.selectedHorseIds.includes(x)) : []);
  merged.horsesByNeed = { transport: clamp(hbn.transport), box: clamp(hbn.box), coach: clamp(hbn.coach) };
  return merged;
}

const MODULE_FIELD: Record<NeedModule, 'needTransport' | 'needBox' | 'needCoach'> = {
  transport: 'needTransport', box: 'needBox', coach: 'needCoach',
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
  todo:      { label: '🟠 À organiser',     dot: '#EE9E84', tone: 'todo' },
  searching: { label: '🔎 Recherche',       dot: '#3B82F6', tone: 'searching' },
  offering:  { label: '📣 Je propose',      dot: '#7C3AED', tone: 'offering' },
  skip:      { label: '➖ Pas nécessaire',  dot: '#9CA3AF', tone: 'skip' },
};

/**
 * Un module (transport/box/coach) compte comme « décidé » (F14) si :
 *  - un choix a été fait (need ≠ 'unset'), ET
 *  - soit le choix est « pas nécessaire », soit aucun cheval n'est sélectionné
 *    pour le concours, soit ≥ 1 cheval est rattaché à ce module.
 * → une valeur par défaut ne peut jamais faire monter le compteur.
 */
function moduleDecided(e: ConcoursLocalEntry, m: NeedModule): boolean {
  const need = e[MODULE_FIELD[m]];
  if (need === 'unset') return false;
  if (need === 'none') return true;
  if ((e.selectedHorseIds?.length ?? 0) === 0) return true;
  return (e.horsesByNeed?.[m]?.length ?? 0) > 0;
}

/** Détail de préparation : 5 éléments, chacun ready/decided ou non. */
export function prepDetail(e: ConcoursLocalEntry) {
  const items = [
    { key: 'cheval', decided: (e.selectedHorseIds?.length ?? 0) > 0 || !!e.chevalId },
    { key: 'epreuves', decided: e.epreuves.length > 0 },
    { key: 'transport', decided: moduleDecided(e, 'transport') },
    { key: 'box', decided: moduleDecided(e, 'box') },
    { key: 'coach', decided: moduleDecided(e, 'coach') },
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

function persist() { void saveJSON(KEY, { __v: SCHEMA_VERSION, map: state.map }); }
function setEntry(id: string, patch: Partial<ConcoursLocalEntry>) {
  const cur = state.map[id] ?? EMPTY;
  const next: ConcoursLocalEntry = { ...cur, ...patch };
  // F8 : `chevalId` synchronisé sur le 1ᵉʳ cheval sélectionné.
  // F14 : les chevaux d'un module ne peuvent pas dépasser la sélection concours.
  if ('selectedHorseIds' in patch) {
    next.selectedHorseIds = [...new Set(Array.isArray(patch.selectedHorseIds) ? patch.selectedHorseIds : [])];
    next.chevalId = next.selectedHorseIds[0] ?? null;
    const keep = (arr: string[]) => arr.filter((x) => next.selectedHorseIds.includes(x));
    next.horsesByNeed = {
      transport: keep(next.horsesByNeed.transport),
      box: keep(next.horsesByNeed.box),
      coach: keep(next.horsesByNeed.coach),
    };
  }
  state = { ...state, map: { ...state.map, [id]: next } };
  emit();
  persist();
}

/** F8 — définit les chevaux qui participent à ce concours (multi). */
export function setConcoursHorses(id: string, ids: string[]) {
  setEntry(id, { selectedHorseIds: [...new Set(ids)] });
}

/** F14 — chevaux rattachés à un module (transport/box/coach) pour ce concours. */
export function setModuleHorses(id: string, m: NeedModule, ids: string[]) {
  const cur = state.map[id] ?? EMPTY;
  const clean = [...new Set(ids)].filter((x) => cur.selectedHorseIds.includes(x));
  setEntry(id, { horsesByNeed: { ...cur.horsesByNeed, [m]: clean } });
}

/** Setter brut inter-stores (ex: transportLocal resynchronise « Mon concours »). */
export function setConcoursEntry(id: string, patch: Partial<ConcoursLocalEntry>) {
  setEntry(id, patch);
}
/** Lecture brute d'une entrée (hors composant). */
export function getConcoursEntry(id: string): ConcoursLocalEntry {
  return reviveEntry(state.map[id]);
}

let initialized = false;
function initOnce() {
  if (initialized) return;
  initialized = true;
  void (async () => {
    const raw = await loadJSON<any>(KEY, null);
    const map: Record<string, ConcoursLocalEntry> = {};
    // F14 : n'accepte QUE le format versionné courant. Tout état antérieur
    // (dont les données de smoke qui forçaient un concours en « suivi ») est
    // ignoré — l'Accueil repart d'un état vide propre.
    if (raw && typeof raw === 'object' && raw.__v === SCHEMA_VERSION && raw.map && typeof raw.map === 'object') {
      for (const [id, e] of Object.entries(raw.map as Record<string, Partial<ConcoursLocalEntry>>)) map[id] = reviveEntry(e);
    }
    state = { map, hydrated: true };
    emit();
    persist();
  })();
}
initOnce();

export function useConcoursLocal(concoursId?: string) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const entry = (concoursId && s.map[concoursId]) || EMPTY;

  const setHorses = useCallback((ids: string[]) => {
    if (!concoursId) return;
    setEntry(concoursId, { selectedHorseIds: [...new Set(ids)] });
  }, [concoursId]);

  const toggleHorse = useCallback((horseId: string) => {
    if (!concoursId) return;
    const cur = state.map[concoursId]?.selectedHorseIds ?? [];
    setEntry(concoursId, { selectedHorseIds: cur.includes(horseId) ? cur.filter((x) => x !== horseId) : [...cur, horseId] });
  }, [concoursId]);

  const toggleFollow = useCallback(() => {
    if (!concoursId) return;
    setEntry(concoursId, { following: !(state.map[concoursId]?.following) });
  }, [concoursId]);

  // F14.1 — « J'y serai » et « Suivre » sont DEUX intentions indépendantes.
  // `setGoing` ne touche PLUS `following` (sinon un concours restait « suivi »
  // à vie après un simple aller-retour sur « J'y serai »).
  const setGoing = useCallback((going: boolean) => {
    if (!concoursId) return;
    setEntry(concoursId, { going });
  }, [concoursId]);

  const update = useCallback((patch: Partial<ConcoursLocalEntry>) => {
    if (!concoursId) return;
    setEntry(concoursId, patch);
  }, [concoursId]);

  const toggleModuleHorse = useCallback((m: NeedModule, horseId: string) => {
    if (!concoursId) return;
    const cur = state.map[concoursId]?.horsesByNeed?.[m] ?? [];
    setModuleHorses(concoursId, m, cur.includes(horseId) ? cur.filter((x) => x !== horseId) : [...cur, horseId]);
  }, [concoursId]);

  const setModule = useCallback((m: NeedModule, ids: string[]) => {
    if (!concoursId) return;
    setModuleHorses(concoursId, m, ids);
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
    setHorses,
    toggleHorse,
    setModuleHorses: setModule,
    toggleModuleHorse,
  };
}
