// ─────────────────────────────────────────────────────────────────────────────
// v2/capabilities/store — SINGLETON module-level (pattern identique à useAuth).
//
// Une seule source de vérité des capacités pour TOUTE la V2, partagée sans
// Context Provider : navigation, accueil, agenda, concours, transport, box,
// coach, chevaux, notifications, messagerie, communauté, profil, organisateur…
//
// PHASE 1 — FRONT-ONLY :
//  - seed initial = vrai `users.role` (via userStore, lecture seule) ;
//  - toute modification (onboarding V2, panneau DEV) reste LOCALE (AsyncStorage,
//    clé `v2:capabilities`) et n'appelle JAMAIS `change_user_role` ni aucune
//    écriture Supabase ;
//  - la validation « organisateur » est SIMULÉE (statut 'pending', aucun email).
// ─────────────────────────────────────────────────────────────────────────────
import { userStore } from '../../data/store';
import { loadJSON, removeKey, saveJSON } from '../lib/persist';
import {
  ALL_CAPABILITIES,
  Capability,
  CapabilityMap,
  CapabilitySource,
  CapabilityState,
} from './types';

const STORAGE_KEY = 'capabilities';

type Persisted = { map: CapabilityMap; source: CapabilitySource; updatedAt: string };

function realRoleNow(): Capability | 'admin' {
  const r = userStore.role;
  return r === 'coach' || r === 'organisateur' || r === 'admin' ? r : 'cavalier';
}

/** Seed « real » : la seule capacité garantie par le backend = le rôle courant. */
function seedFromRealRole(): CapabilityMap {
  const r = realRoleNow();
  // admin n'est pas une capacité V2 → on retombe sur cavalier pour la démo.
  const cap: Capability = r === 'admin' ? 'cavalier' : r;
  return { [cap]: 'active' };
}

let state: CapabilityState = {
  map: seedFromRealRole(),
  source: 'real',
  realRole: realRoleNow(),
  updatedAt: new Date().toISOString(),
  hydrated: false,
};

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function getSnapshot(): CapabilityState {
  return state;
}

function setState(patch: Partial<CapabilityState>, persist = true) {
  state = { ...state, ...patch, updatedAt: new Date().toISOString() };
  emit();
  if (persist && state.source !== 'real') {
    void saveJSON(STORAGE_KEY, {
      map: state.map,
      source: state.source,
      updatedAt: state.updatedAt,
    } satisfies Persisted);
  }
}

// ── Hydratation unique ──────────────────────────────────────────────────────
let initialized = false;
export function initCapabilitiesOnce() {
  if (initialized) return;
  initialized = true;

  void (async () => {
    const stored = await loadJSON<Persisted | null>(STORAGE_KEY, null);
    if (stored && stored.map && Object.keys(stored.map).length > 0) {
      setState(
        { map: stored.map, source: stored.source ?? 'simulated', realRole: realRoleNow(), hydrated: true },
        false,
      );
    } else {
      setState({ map: seedFromRealRole(), source: 'real', realRole: realRoleNow(), hydrated: true }, false);
    }
  })();

  // Le vrai rôle backend peut changer (login, refetch). On garde `realRole` à
  // jour ; si l'utilisateur n'a rien simulé, on resuit le rôle réel.
  userStore.onRoleChange(() => {
    const next = realRoleNow();
    if (state.source === 'real') {
      setState({ map: seedFromRealRole(), realRole: next }, false);
    } else {
      setState({ realRole: next }, false);
    }
  });
}

// ── Actions (toutes FRONT-ONLY en Phase 1) ──────────────────────────────────

/** Remplace l'ensemble des capacités (panneau DEV, presets de test). */
export function setExact(caps: Capability[], source: CapabilitySource = 'dev-override') {
  const map: CapabilityMap = {};
  for (const c of caps) {
    // organisateur ajouté via un preset DEV = directement 'active' (on teste la
    // cible ; le flux « pending » se teste via l'onboarding ou requestCapability).
    map[c] = 'active';
  }
  if (Object.keys(map).length === 0) map.cavalier = 'active'; // jamais 0 capacité
  setState({ map, source });
}

/**
 * Demande d'ajout d'une capacité (onboarding V2 / bouton « ajouter une activité »).
 *  - cavalier / coach : activées immédiatement (gating réel = Phase 2).
 *  - organisateur     : passe en 'pending' (validation admin SIMULÉE).
 * Retourne le statut résultant pour que l'appelant affiche la bonne pop-up.
 */
export function requestCapability(cap: Capability): 'active' | 'pending' {
  const status = cap === 'organisateur' ? 'pending' : 'active';
  setState({ map: { ...state.map, [cap]: status }, source: 'simulated' });
  return status;
}

/** Retire une capacité (Paramètres → Mes activités). Ne descend jamais sous 1. */
export function removeCapability(cap: Capability) {
  const next: CapabilityMap = { ...state.map };
  delete next[cap];
  if (Object.keys(next).length === 0) return; // garde-fou : au moins 1 capacité
  setState({ map: next, source: 'simulated' });
}

/** Force une capacité en 'active' (utilisé par l'approbation organisateur simulée). */
export function enableCapability(cap: Capability) {
  setState({ map: { ...state.map, [cap]: 'active' }, source: 'simulated' });
}

/** SIMULE l'approbation admin de la demande organisateur (panneau DEV). */
export function approveOrganisateur() {
  if (state.map.organisateur === 'pending') enableCapability('organisateur');
}

/** Applique un set complet issu de l'onboarding (organisateur → pending). */
export function applyOnboardingSelection(caps: Capability[]): { organisateurPending: boolean } {
  const map: CapabilityMap = {};
  for (const c of caps) map[c] = c === 'organisateur' ? 'pending' : 'active';
  if (Object.keys(map).length === 0) map.cavalier = 'active';
  setState({ map, source: 'simulated' });
  return { organisateurPending: map.organisateur === 'pending' };
}

/** Efface toute simulation → retour aux capacités dérivées du vrai rôle backend. */
export function resetToReal() {
  void removeKey(STORAGE_KEY);
  setState({ map: seedFromRealRole(), source: 'real', realRole: realRoleNow() }, false);
}

/** Liste ordonnée des capacités (statut inclus). */
export function orderedCapabilities(map: CapabilityMap): Capability[] {
  return ALL_CAPABILITIES.filter((c) => map[c] != null);
}
