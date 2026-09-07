// ─────────────────────────────────────────────────────────────────────────────
// v2/dev/testProfiles — 3 COMPTES DE TEST (100 % SIMULÉS · FRONT-ONLY).
//
// F15 §4 : il n'existe PAS de modèle backend `user_capabilities` (les capacités
// V2 sont simulées localement, seed = `users.role`). On NE bricole donc AUCUN
// rôle en base. Ces « comptes » vivent uniquement dans AsyncStorage :
//   - identité      → session simulée (v2/auth/session, clé `v2:session`)
//   - capacités     → override DEV     (v2/capabilities/store, clé `v2:capabilities`)
//
// Aucun supabase.auth.signUp, aucun email, aucune écriture PROD, aucune Auth.
// Emails en `.test` (TLD réservé — ne résout jamais). Aucune donnée réelle.
// ─────────────────────────────────────────────────────────────────────────────
import { signOutSim, signUpSim } from '../auth/session';
import { setExact } from '../capabilities/store';
import type { Capability } from '../capabilities/types';

export interface TestProfile {
  key: 'A' | 'B' | 'C';
  label: string;
  prenom: string;
  nom: string;
  email: string;
  caps: Capability[];
}

/** Mot de passe indicatif : sans effet (comptes simulés, aucune Auth réelle). */
export const TEST_PASSWORD = 'Equishow-test-2026';

export const TEST_PROFILES: TestProfile[] = [
  {
    key: 'A',
    label: 'Cavalier seul',
    prenom: 'Test', nom: 'Cavalier',
    email: 'test.cavalier@equishow.test',
    caps: ['cavalier'],
  },
  {
    key: 'B',
    label: 'Cavalier + Coach',
    prenom: 'Test', nom: 'Cavalier Coach',
    email: 'test.cavalier.coach@equishow.test',
    caps: ['cavalier', 'coach'],
  },
  {
    key: 'C',
    label: 'Cavalier + Coach + Organisateur',
    prenom: 'Test', nom: 'Omni',
    email: 'test.omni@equishow.test',
    caps: ['cavalier', 'coach', 'organisateur'],
  },
];

/** Active un profil de test : identité simulée + capacités (org → 'active'). */
export function applyTestProfile(p: TestProfile) {
  signUpSim({ prenom: p.prenom, nom: p.nom, email: p.email });
  setExact(p.caps, 'dev-override');
}

/** Déconnecte le profil de test simulé (capacités : reset via le panneau). */
export function clearTestProfile() {
  signOutSim();
}
