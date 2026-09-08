// ─────────────────────────────────────────────────────────────────────────────
// v2/state/concoursChevalCoach — association TEMPORAIRE  Concours + Cheval + Coach.
//
//   « Coach de MON cheval pour CE concours » — distincte du coach permanent
//   (chevaux.gestion.responsable) qu'elle ne modifie JAMAIS.
//
// FRONT-ONLY · AsyncStorage `v2:concours-cheval-coach` · 0 écriture Supabase.
// Structure : { [concoursId]: { [chevalId]: CoachAssoc } }
// Un cheval = un coach par concours (dernier gagne). Plusieurs chevaux d'un
// même concours peuvent avoir des coachs différents.
//
// Phase 2 (après validation) : table additive `concours_cheval_coach`.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from '../lib/persist';

const KEY = 'concours-cheval-coach';

export interface CoachAssoc {
  /** vrai users.id du coach si connu (annonce / réservation). */
  coachUserId?: string;
  coachNom: string;
  coachInitiales?: string;
  coachCouleur?: string;
  /** id de l'annonce de coaching liée à ce concours, si connue. */
  annonceId?: string;
  source: 'reservation' | 'manuel';
  createdAt: string;
}

type Map2 = Record<string, Record<string, CoachAssoc>>;
interface Store { map: Map2; hydrated: boolean }

let state: Store = { map: {}, hydrated: false };
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const getSnapshot = () => state;

function persist() { void saveJSON(KEY, { map: state.map }); }
function set(map: Map2) { state = { ...state, map }; emit(); persist(); }

let initialized = false;
function initOnce() {
  if (initialized) return;
  initialized = true;
  void (async () => {
    const d = await loadJSON<{ map?: Map2 }>(KEY, {});
    state = { map: d.map ?? {}, hydrated: true };
    emit();
  })();
}
initOnce();

// ── mutations ──────────────────────────────────────────────────────────────
export function setChevalCoach(concoursId: string, chevalId: string, assoc: Omit<CoachAssoc, 'createdAt'>) {
  const rec: CoachAssoc = { ...assoc, createdAt: new Date().toISOString() };
  const forConcours = { ...(state.map[concoursId] ?? {}), [chevalId]: rec };
  set({ ...state.map, [concoursId]: forConcours });
}
export function setManyChevalCoach(concoursId: string, chevalIds: string[], assoc: Omit<CoachAssoc, 'createdAt'>) {
  const now = new Date().toISOString();
  const forConcours = { ...(state.map[concoursId] ?? {}) };
  for (const cid of chevalIds) forConcours[cid] = { ...assoc, createdAt: now };
  set({ ...state.map, [concoursId]: forConcours });
}
export function removeChevalCoach(concoursId: string, chevalId: string) {
  const forConcours = { ...(state.map[concoursId] ?? {}) };
  delete forConcours[chevalId];
  set({ ...state.map, [concoursId]: forConcours });
}

// ── hooks ──────────────────────────────────────────────────────────────────
/** Associations pour UN concours (côté fiche concours / étape post-réservation). */
export function useConcoursChevalCoach(concoursId?: string) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const byCheval = (concoursId && s.map[concoursId]) || {};

  const set1 = useCallback((chevalId: string, a: Omit<CoachAssoc, 'createdAt'>) => {
    if (concoursId) setChevalCoach(concoursId, chevalId, a);
  }, [concoursId]);
  const setMany = useCallback((chevalIds: string[], a: Omit<CoachAssoc, 'createdAt'>) => {
    if (concoursId) setManyChevalCoach(concoursId, chevalIds, a);
  }, [concoursId]);
  const remove1 = useCallback((chevalId: string) => {
    if (concoursId) removeChevalCoach(concoursId, chevalId);
  }, [concoursId]);

  return {
    ready: s.hydrated,
    byCheval: byCheval as Record<string, CoachAssoc>,
    list: Object.entries(byCheval).map(([chevalId, assoc]) => ({ chevalId, assoc })),
    set: set1,
    setMany,
    remove: remove1,
  };
}

/** Tous les concours où CE cheval a un coach associé (côté fiche cheval). */
export function useChevalCoachAssoc(chevalId?: string) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const list: { concoursId: string; assoc: CoachAssoc }[] = [];
  if (chevalId) {
    for (const [concoursId, forConcours] of Object.entries(s.map)) {
      const a = forConcours[chevalId];
      if (a) list.push({ concoursId, assoc: a });
    }
  }
  return { ready: s.hydrated, list };
}
