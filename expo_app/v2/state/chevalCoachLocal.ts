// ─────────────────────────────────────────────────────────────────────────────
// v2/state/chevalCoachLocal — COACH PERMANENT du cheval (surcouche locale V2).
//
//   Reprend la notion V1 `chevaux.gestion.responsable` ({ nom, userId? }).
//   Pendant la phase FRONT-ONLY : aucune écriture de `chevaux.gestion`.
//   La V2 stocke une SURCOUCHE locale par chevalId :
//     - absent          → on affiche la valeur V1 (gestion.responsable)
//     - { … }           → coach défini/modifié dans la V2
//     - null            → coach retiré dans la V2
//
// AsyncStorage `v2:cheval-coach`. Phase 2 : flush vers `chevaux.gestion`.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from '../lib/persist';

const KEY = 'cheval-coach';

export interface CoachPermanent {
  nom: string;
  userId?: string;        // vrai users.id si sélectionné dans la liste
  initiales?: string;
  couleur?: string;
}

type OverrideMap = Record<string, CoachPermanent | null>;
interface Store { map: OverrideMap; hydrated: boolean }

let state: Store = { map: {}, hydrated: false };
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const getSnapshot = () => state;

function persist() { void saveJSON(KEY, { map: state.map }); }
function set(map: OverrideMap) { state = { ...state, map }; emit(); persist(); }

let initialized = false;
function initOnce() {
  if (initialized) return;
  initialized = true;
  void (async () => {
    const d = await loadJSON<{ map?: OverrideMap }>(KEY, {});
    state = { map: d.map ?? {}, hydrated: true };
    emit();
  })();
}
initOnce();

export function setCoachPermanent(chevalId: string, coach: CoachPermanent) {
  set({ ...state.map, [chevalId]: coach });
}
export function clearCoachPermanent(chevalId: string) {
  set({ ...state.map, [chevalId]: null }); // null = retiré explicitement dans la V2
}
export function resetCoachPermanent(chevalId: string) {
  const m = { ...state.map }; delete m[chevalId]; set(m); // retour à la valeur V1
}

/**
 * Coach permanent effectif d'un cheval.
 * @param fallback valeur V1 (`gestion.responsable`) — utilisée si aucune surcouche.
 */
export function useCoachPermanent(chevalId?: string, fallback?: CoachPermanent | null) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const override = chevalId ? s.map[chevalId] : undefined;
  const hasOverride = chevalId != null && chevalId in s.map;
  const coach: CoachPermanent | null = hasOverride ? override ?? null : (fallback ?? null);

  const setC = useCallback((c: CoachPermanent) => { if (chevalId) setCoachPermanent(chevalId, c); }, [chevalId]);
  const clearC = useCallback(() => { if (chevalId) clearCoachPermanent(chevalId); }, [chevalId]);
  const resetC = useCallback(() => { if (chevalId) resetCoachPermanent(chevalId); }, [chevalId]);

  return {
    ready: s.hydrated,
    coach,
    /** true = la valeur vient d'une modification V2 (pas de la V1). */
    edited: hasOverride,
    set: setC,
    clear: clearC,
    reset: resetC,
  };
}
