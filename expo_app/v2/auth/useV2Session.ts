// ─────────────────────────────────────────────────────────────────────────────
// useV2Session() — session d'entrée V2.
//
// Fusionne deux réalités :
//   1. la VRAIE session Supabase (useAuth) — un utilisateur déjà connecté ;
//   2. la session SIMULÉE V2 (v2/auth/session) — un nouvel utilisateur prototypé.
//
// PHASE 1 : les actions signUp/logIn/signOut n'agissent QUE sur la session
// simulée. La vraie session n'est jamais modifiée ici.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  V2SimAccount,
  getSnapshot,
  initV2SessionOnce,
  logInSim,
  signOutSim,
  signUpSim,
  subscribe,
} from './session';

initV2SessionOnce();

export type V2SessionKind = 'real' | 'simulated' | 'none';

export interface UseV2Session {
  ready: boolean;
  /** 'real' = vraie session Supabase · 'simulated' = compte V2 local · 'none'. */
  kind: V2SessionKind;
  isSignedIn: boolean;
  /** Identité affichable, quelle que soit la source. */
  identity: { prenom: string; nom: string; email: string; telephone?: string } | null;
  /** Compte simulé brut (null si session réelle ou aucune). */
  simAccount: V2SimAccount | null;

  // actions — session SIMULÉE uniquement (Phase 1)
  signUp: (f: { prenom: string; nom: string; email: string; telephone?: string }) => V2SimAccount;
  logIn: (email: string) => V2SimAccount;
  signOut: () => void;
}

export function useV2Session(): UseV2Session {
  const sim = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { isSignedIn: realSignedIn, profile } = useAuth();

  let kind: V2SessionKind = 'none';
  let identity: UseV2Session['identity'] = null;

  if (realSignedIn && profile) {
    kind = 'real';
    identity = {
      prenom: (profile as any).prenom ?? '',
      nom: (profile as any).nom ?? '',
      email: profile.email ?? '',
      telephone: (profile as any).telephone ?? undefined,
    };
  } else if (sim.account) {
    kind = 'simulated';
    identity = {
      prenom: sim.account.prenom,
      nom: sim.account.nom,
      email: sim.account.email,
      telephone: sim.account.telephone,
    };
  }

  return {
    ready: sim.hydrated,
    kind,
    isSignedIn: kind !== 'none',
    identity,
    simAccount: kind === 'simulated' ? sim.account : null,
    signUp: signUpSim,
    logIn: logInSim,
    signOut: signOutSim,
  };
}
