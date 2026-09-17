// ─────────────────────────────────────────────────────────────────────────────
// v2/state/concoursLocal — état « Mon concours ».
//
// PHASE 1B (mig 110) — RÉEL pour : going ("J'y serai"), following ("Suivre"),
//   selectedHorseIds (multi-cheval), epreuves, et la transition 'none' de
//   needTransport/needBox/needCoach ("pas nécessaire"). Ces champs sont
//   maintenant sourcés depuis Supabase via `useConcoursParticipation`
//   (elle-même construite sur les hooks V1 useConcoursPresence/useConcoursFollow,
//   réutilisés tels quels) puis MIROITÉS dans le store local ci-dessous, pour
//   que les consommateurs synchrones existants (getConcoursEntry, prepScore,
//   v2/adapters/todo.ts) continuent de fonctionner sans changement : le store
//   local devient un CACHE synchrone, plus la source de vérité, pour ces
//   champs précis.
//
// TOUJOURS LOCAL (AsyncStorage `v2:concours-local`, AUCUNE écriture PROD) :
//   needTransport/needBox/needCoach (hors 'none'), horsesByNeed, demandsByNeed
//   — les vrais statuts Transport/Box/Coach seront dérivés des tables métier
//   réelles dans une phase ultérieure, pas avant.
//
// followingIds/goingIds (agrégats multi-concours, ex. Accueil "prochain
// concours pertinent") restent alimentés par ce cache local — ils ne
// reflètent un concours donné qu'une fois sa page visitée dans la session
// courante. Rebrancher ces agrégats sur une vraie requête multi-lignes est
// HORS PÉRIMÈTRE de la Phase 1B (périmètre : un concours à la fois).
//
// Singleton + useSyncExternalStore (pattern useAuth / v2/capabilities).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from '../lib/persist';
import { useConcoursParticipation, type SkipModule } from './concoursParticipation';
import { useMyConcoursIndex } from './myConcoursIndex';

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
export type NeedChoice = 'unset' | 'done' | 'searching' | 'offering' | 'none' | 'pending';

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
  /** F16 — demandes en cours PAR MODULE, indexées par `horseId` :
   *   'pending'   = demande envoyée, le prestataire (transporteur/loueur/coach)
   *                 n'a pas encore validé (ni le paiement séquestre effectué) ;
   *   'confirmed' = validée + payée.
   *  Permet de garder les contrôles habituels du module pour réserver un AUTRE
   *  prestataire pour un AUTRE cheval du même concours (Dan en attente, Romy
   *  encore à organiser). */
  demandsByNeed: Record<NeedModule, Record<string, 'pending' | 'confirmed'>>;
}

const EMPTY: ConcoursLocalEntry = {
  following: false, going: false, chevalId: null, selectedHorseIds: [], epreuves: [],
  needTransport: 'unset', needBox: 'unset', needCoach: 'unset',
  horsesByNeed: { transport: [], box: [], coach: [] },
  demandsByNeed: { transport: {}, box: {}, coach: {} },
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
  const dbn = (merged.demandsByNeed ?? {}) as Partial<Record<NeedModule, Record<string, unknown>>>;
  const clampMap = (m?: Record<string, unknown>): Record<string, 'pending' | 'confirmed'> => {
    const out: Record<string, 'pending' | 'confirmed'> = {};
    if (m && typeof m === 'object') {
      for (const [k, v] of Object.entries(m)) {
        if (merged.selectedHorseIds.includes(k) && (v === 'pending' || v === 'confirmed')) out[k] = v;
      }
    }
    return out;
  };
  merged.demandsByNeed = { transport: clampMap(dbn.transport), box: clampMap(dbn.box), coach: clampMap(dbn.coach) };
  // F16 — le statut module `'pending'` ne vaut plus que si AUCUN cheval n'est
  // sélectionné pour le concours. Sinon (état écrit par une version antérieure,
  // ou demande faite avant sélection) → rétro-compat vers `'searching'`, le
  // suivi réel étant désormais par cheval (`demandsByNeed`).
  if (merged.selectedHorseIds.length > 0) {
    for (const m of ['transport', 'box', 'coach'] as NeedModule[]) {
      const f = MODULE_FIELD[m];
      if (merged[f] === 'pending') merged[f] = 'searching';
    }
  }
  return merged;
}

const MODULE_FIELD: Record<NeedModule, 'needTransport' | 'needBox' | 'needCoach'> = {
  transport: 'needTransport', box: 'needBox', coach: 'needCoach',
};

// ── libellés / statut visuel partagés (fiche + préparer) ─────────────────────
export type PrepStatus = 'ready' | 'todo' | 'searching' | 'offering' | 'skip' | 'pending';

export function needStatus(n: NeedChoice): PrepStatus {
  return n === 'done' ? 'ready'
    : n === 'pending' ? 'pending'
    : n === 'searching' ? 'searching'
    : n === 'offering' ? 'offering'
    : n === 'none' ? 'skip'
    : 'todo';
}
export const NEED_LABEL: Record<NeedChoice, string> = {
  unset: 'À organiser', done: 'Organisé', searching: 'Je cherche', offering: 'Je propose', none: 'Pas nécessaire',
  pending: 'En attente',
};
export const STATUS_META: Record<PrepStatus, { label: string; dot: string; tone: 'ready' | 'todo' | 'searching' | 'offering' | 'skip' | 'pending' }> = {
  ready:     { label: '✅ Prêt',            dot: '#16A34A', tone: 'ready' },
  todo:      { label: '🟠 À organiser',     dot: '#EE9E84', tone: 'todo' },
  searching: { label: '🔎 Recherche',       dot: '#3B82F6', tone: 'searching' },
  offering:  { label: '📣 Je propose',      dot: '#7C3AED', tone: 'offering' },
  skip:      { label: '➖ Pas nécessaire',  dot: '#9CA3AF', tone: 'skip' },
  pending:   { label: '⏳ En attente',      dot: '#D97706', tone: 'pending' },
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
    const keepMap = (m: Record<string, 'pending' | 'confirmed'>) =>
      Object.fromEntries(Object.entries(m ?? {}).filter(([k]) => next.selectedHorseIds.includes(k)));
    const dbn = next.demandsByNeed ?? EMPTY.demandsByNeed;
    next.demandsByNeed = { transport: keepMap(dbn.transport), box: keepMap(dbn.box), coach: keepMap(dbn.coach) };
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

// ── F16 — demandes « en attente prestataire » par module / par cheval ────────

/**
 * Demande envoyée pour `horseIds` sur le module `m` : ces chevaux passent en
 * « ⏳ En attente ». Le module N'est PAS marqué « Organisé » — les contrôles
 * habituels restent disponibles pour réserver un autre prestataire pour les
 * autres chevaux du concours.
 *  - `horseIds` vide (aucun cheval au concours) → repli sur le statut module
 *    `'pending'` (rétro-compat).
 */
export function markDemandPending(id: string, m: NeedModule, horseIds: string[]) {
  const cur = reviveEntry(state.map[id]);
  const field = MODULE_FIELD[m];
  let clean = [...new Set(horseIds)].filter((x) => cur.selectedHorseIds.includes(x));
  // Demande sans cheval précisé mais des chevaux existent au concours → on la
  // rattache à TOUS les chevaux sélectionnés (jamais de statut module figé
  // quand un suivi par cheval est possible).
  if (clean.length === 0 && cur.selectedHorseIds.length > 0) clean = [...cur.selectedHorseIds];
  if (clean.length === 0) {
    if (cur[field] !== 'done') {
      const patch: Partial<ConcoursLocalEntry> = {};
      patch[field] = 'pending';
      setEntry(id, patch);
    }
    return;
  }
  const map = { ...cur.demandsByNeed[m] };
  for (const h of clean) if (map[h] !== 'confirmed') map[h] = 'pending';
  const patch: Partial<ConcoursLocalEntry> = {
    demandsByNeed: { ...cur.demandsByNeed, [m]: map },
    horsesByNeed: { ...cur.horsesByNeed, [m]: [...new Set([...cur.horsesByNeed[m], ...clean])] },
  };
  // Une demande implique « je cherche » ; ne jamais rétrograder un choix explicite.
  if (cur[field] === 'unset' || cur[field] === 'pending') patch[field] = 'searching';
  setEntry(id, patch);
}

/**
 * Le prestataire a validé (+ paiement séquestre) pour `horseIds`. Le module
 * passe « Organisé » / « Coach prévu » uniquement quand TOUS les chevaux
 * concernés sont confirmés et qu'aucune demande n'est plus en attente.
 */
export function markDemandConfirmed(id: string, m: NeedModule, horseIds: string[]) {
  const cur = reviveEntry(state.map[id]);
  const field = MODULE_FIELD[m];
  let clean = [...new Set(horseIds)].filter((x) => cur.selectedHorseIds.includes(x));
  if (clean.length === 0 && cur.selectedHorseIds.length > 0) clean = [...cur.selectedHorseIds];
  if (clean.length === 0) {
    const patch: Partial<ConcoursLocalEntry> = {};
    patch[field] = 'done';
    setEntry(id, patch);
    return;
  }
  const map = { ...cur.demandsByNeed[m] };
  for (const h of clean) map[h] = 'confirmed';
  const patch: Partial<ConcoursLocalEntry> = {
    demandsByNeed: { ...cur.demandsByNeed, [m]: map },
    horsesByNeed: { ...cur.horsesByNeed, [m]: [...new Set([...cur.horsesByNeed[m], ...clean])] },
  };
  // « Organisé » / « Coach prévu » AUTOMATIQUE uniquement quand TOUS les chevaux
  // du concours sont confirmés (et aucune demande en attente). Sinon on laisse
  // les contrôles habituels : l'utilisateur peut réserver pour un autre cheval,
  // ou marquer « Organisé » manuellement s'il n'en veut pas pour les autres.
  const anyPending = Object.values(map).some((v) => v === 'pending');
  const allSelectedConfirmed = cur.selectedHorseIds.length > 0
    && cur.selectedHorseIds.every((h) => map[h] === 'confirmed');
  if (!anyPending && allSelectedConfirmed && cur[field] !== 'none' && cur[field] !== 'offering') patch[field] = 'done';
  setEntry(id, patch);
}

/** Annule une demande : retire ces chevaux du suivi du module. */
export function clearDemand(id: string, m: NeedModule, horseIds: string[]) {
  const cur = reviveEntry(state.map[id]);
  const map = { ...cur.demandsByNeed[m] };
  for (const h of horseIds) delete map[h];
  const patch: Partial<ConcoursLocalEntry> = { demandsByNeed: { ...cur.demandsByNeed, [m]: map } };
  // Plus aucune demande ni cheval rattaché → le module redevient « à organiser ».
  if (Object.keys(map).length === 0 && cur.horsesByNeed[m].every((h) => horseIds.includes(h))) {
    const field = MODULE_FIELD[m];
    if (cur[field] === 'searching' || cur[field] === 'pending') patch[field] = 'unset';
  }
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
  // PHASE 1B — source de vérité réelle pour going/following/chevaux/épreuves/
  // *_skip (mig 110). Cf. commentaire d'en-tête du fichier.
  const participation = useConcoursParticipation(concoursId);
  // PHASE 1B (correction) — goingIds/followingIds RECONSTRUITS DEPUIS SUPABASE,
  // jamais depuis le cache local. Ne dépend pas d'avoir déjà ouvert chaque
  // fiche : une seule requête par utilisateur, à froid comme à chaud.
  const myIndex = useMyConcoursIndex();
  const entry = (concoursId && s.map[concoursId]) || EMPTY;

  // Miroir Supabase → store local synchrone (getConcoursEntry, prepScore,
  // todo.ts continuent de fonctionner sans changement). needTransport/Box/Coach
  // ne sont forcés à 'none' QUE si le flag skip correspondant est vrai — les
  // autres valeurs (unset/searching/offering/done/pending) restent celles déjà
  // en local (100% local, hors périmètre 1B).
  useEffect(() => {
    if (!concoursId || !participation.ready) return;
    const cur = state.map[concoursId] ?? EMPTY;
    setEntry(concoursId, {
      going: participation.going,
      following: participation.following,
      selectedHorseIds: participation.horseIds,
      epreuves: participation.epreuves,
      needTransport: participation.transportSkip ? 'none' : cur.needTransport,
      needBox: participation.boxSkip ? 'none' : cur.needBox,
      needCoach: participation.coachSkip ? 'none' : cur.needCoach,
    });
  }, [
    concoursId, participation.ready, participation.going, participation.following,
    participation.horseIds, participation.epreuves,
    participation.transportSkip, participation.boxSkip, participation.coachSkip,
  ]);

  const setHorses = useCallback((ids: string[]) => {
    if (!concoursId) return;
    void participation.setHorseIds([...new Set(ids)]);
  }, [concoursId, participation]);

  const toggleHorse = useCallback((horseId: string) => {
    if (!concoursId) return;
    if (participation.horseIds.includes(horseId)) void participation.removeHorse(horseId);
    else void participation.addHorse(horseId);
  }, [concoursId, participation]);

  const toggleFollow = useCallback(() => {
    if (!concoursId) return;
    void participation.toggleFollow();
  }, [concoursId, participation]);

  // F14.1 — « J'y serai » et « Suivre » sont DEUX intentions indépendantes.
  // `setGoing` ne touche PLUS `following` (sinon un concours restait « suivi »
  // à vie après un simple aller-retour sur « J'y serai »).
  const setGoing = useCallback((going: boolean) => {
    if (!concoursId) return;
    void participation.setGoing(going);
  }, [concoursId, participation]);

  const update = useCallback((patch: Partial<ConcoursLocalEntry>) => {
    if (!concoursId) return;
    if ('epreuves' in patch && patch.epreuves) {
      void participation.setEpreuves(patch.epreuves);
      return;
    }
    // Transition vers/depuis 'none' = décision "pas nécessaire" (mig 110,
    // transport_skip/box_skip/coach_skip UNIQUEMENT). Toute autre valeur du
    // champ reste 100% locale (pas de réservation réelle rebranchée en 1B).
    const SKIP_FIELDS: Array<['needTransport' | 'needBox' | 'needCoach', SkipModule]> = [
      ['needTransport', 'transport'], ['needBox', 'box'], ['needCoach', 'coach'],
    ];
    const cur = state.map[concoursId] ?? EMPTY;
    for (const [field, m] of SKIP_FIELDS) {
      if (!(field in patch)) continue;
      const wasNone = cur[field] === 'none';
      const willBeNone = patch[field] === 'none';
      if (willBeNone && !wasNone) void participation.setSkip(m, true);
      else if (!willBeNone && wasNone) void participation.setSkip(m, false);
    }
    setEntry(concoursId, patch);
  }, [concoursId, participation]);

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
    ready: s.hydrated && (!concoursId || participation.ready),
    entry,
    prep: prepDetail(entry),
    prepScore: prepScore(entry),
    followingIds: myIndex.followingIds,
    goingIds: myIndex.goingIds,
    myIndexReady: myIndex.ready,
    toggleFollow,
    setGoing,
    update,
    setHorses,
    toggleHorse,
    setModuleHorses: setModule,
    toggleModuleHorse,
  };
}
