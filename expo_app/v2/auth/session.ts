// ─────────────────────────────────────────────────────────────────────────────
// v2/auth/session — SESSION SIMULÉE (PHASE 1 · FRONT-ONLY).
//
// Permet de prototyper le parcours d'entrée V2 d'un NOUVEL utilisateur sans
// jamais toucher Supabase Auth :
//   - AUCUN supabase.auth.signUp / signInWithPassword ;
//   - AUCUN utilisateur réel créé ;
//   - AUCUN email envoyé.
//
// Le « compte » vit uniquement dans AsyncStorage (clé `v2:session`), propre à
// l'appareil. Coexiste avec la vraie session Supabase (useAuth) : si un vrai
// utilisateur est connecté, la V2 l'utilise ; sinon on peut simuler un compte.
//
// Pattern singleton identique à hooks/useAuth.ts et v2/capabilities/store.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { loadJSON, removeKey, saveJSON } from '../lib/persist';

const STORAGE_KEY = 'session';

export interface V2SimAccount {
  /** Toujours true — marque explicite « ceci est simulé ». */
  simulated: true;
  /** Id local factice (jamais un vrai auth.uid()). */
  accountId: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  createdVia: 'signup' | 'login';
  createdAt: string;
}

export interface V2SessionState {
  account: V2SimAccount | null;
  hydrated: boolean;
}

let state: V2SessionState = { account: null, hydrated: false };

const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
export const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
export const getSnapshot = () => state;

function setState(patch: Partial<V2SessionState>, persist = true) {
  state = { ...state, ...patch };
  emit();
  if (persist) {
    if (state.account) void saveJSON(STORAGE_KEY, state.account);
    else void removeKey(STORAGE_KEY);
  }
}

let initialized = false;
export function initV2SessionOnce() {
  if (initialized) return;
  initialized = true;
  void (async () => {
    const acc = await loadJSON<V2SimAccount | null>(STORAGE_KEY, null);
    setState({ account: acc && acc.simulated ? acc : null, hydrated: true }, false);
  })();
}

function genId() {
  return `v2-sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Actions (toutes FRONT-ONLY, aucune requête réseau) ─────────────────────

export function signUpSim(fields: {
  prenom: string; nom: string; email: string; telephone?: string;
}): V2SimAccount {
  const account: V2SimAccount = {
    simulated: true,
    accountId: genId(),
    prenom: fields.prenom.trim(),
    nom: fields.nom.trim(),
    email: fields.email.trim(),
    telephone: fields.telephone?.trim() || undefined,
    createdVia: 'signup',
    createdAt: new Date().toISOString(),
  };
  setState({ account });
  return account;
}

export function logInSim(email: string): V2SimAccount {
  // Connexion simulée : on ne vérifie rien, on fabrique un compte « existant ».
  const account: V2SimAccount = {
    simulated: true,
    accountId: genId(),
    prenom: '',
    nom: '',
    email: email.trim(),
    createdVia: 'login',
    createdAt: new Date().toISOString(),
  };
  setState({ account });
  return account;
}

export function signOutSim() {
  setState({ account: null });
}
