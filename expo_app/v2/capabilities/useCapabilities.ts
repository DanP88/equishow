// ─────────────────────────────────────────────────────────────────────────────
// useCapabilities() — LE hook de l'omni-activité. Fondation réutilisée par toutes
// les surfaces V2 (navigation, accueil, agenda, concours, transport, box, coach,
// chevaux, notifications, messagerie, communauté, profil, organisateur…).
//
// Principe : PAS de « rôle actif ». On répond à deux questions :
//   1. Quelles capacités possède cette personne ?      → has() / capabilities
//   2. (par surface) quelle relation à cet objet ?     → géré par chaque surface
//
// PHASE 1 : lecture du singleton front-only. Aucune écriture PROD, aucun
// change_user_role. Voir v2/capabilities/store.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';
import {
  Capability,
  CapabilityMap,
  CapabilitySource,
  CapabilityStatus,
} from './types';
import {
  applyOnboardingSelection,
  approveOrganisateur,
  getSnapshot,
  initCapabilitiesOnce,
  orderedCapabilities,
  removeCapability,
  requestCapability,
  resetToReal,
  setExact,
  subscribe,
} from './store';

// Démarre l'hydratation dès le 1ᵉʳ import.
initCapabilitiesOnce();

export interface UseCapabilities {
  /** Hydratation AsyncStorage terminée ? (évite un flash au cold start) */
  ready: boolean;
  /** Capacités ACTIVES, ordre canonique cavalier → coach → organisateur. */
  capabilities: Capability[];
  /** Toutes les capacités détenues (actives + pending) dans l'ordre canonique. */
  held: Capability[];
  /** Map brute capacité → statut. */
  map: CapabilityMap;
  /** Origine de l'état : 'real' | 'simulated' | 'dev-override'. */
  source: CapabilitySource;
  /** Vrai rôle backend (lecture seule, jamais modifié en Phase 1). */
  realRole: Capability | 'admin';
  /** Nombre de capacités actives. */
  count: number;

  // ── prédicats ────────────────────────────────────────────────────────────
  /** Capacité détenue ET active. */
  has: (c: Capability) => boolean;
  /** Au moins une des capacités passées est active. */
  hasAny: (...c: Capability[]) => boolean;
  /** Toutes les capacités passées sont actives. */
  hasAll: (...c: Capability[]) => boolean;
  /** Capacité détenue mais en attente de validation (organisateur). */
  isPending: (c: Capability) => boolean;
  status: (c: Capability) => CapabilityStatus | undefined;
  /** Aucune capacité active, uniquement une demande organisateur en attente. */
  onlyPending: boolean;
  /** true si la personne cumule au moins 2 capacités actives (cas omni). */
  isMultiCapability: boolean;

  // ── actions (FRONT-ONLY en Phase 1) ──────────────────────────────────────
  /** Ajoute une capacité. organisateur → 'pending'. Retourne le statut obtenu. */
  request: (c: Capability) => 'active' | 'pending';
  /** Retire une capacité (jamais en dessous de 1). */
  remove: (c: Capability) => void;
  /** Applique une sélection d'onboarding (organisateur → pending). */
  applyOnboarding: (caps: Capability[]) => { organisateurPending: boolean };
  /** SIMULE l'approbation admin de la demande organisateur. */
  approveOrganisateur: () => void;
  /** Force un set exact (panneau DEV / presets). */
  setExact: (caps: Capability[]) => void;
  /** Efface la simulation → retour aux capacités du vrai rôle backend. */
  resetToReal: () => void;
}

export function useCapabilities(): UseCapabilities {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const active = orderedCapabilities(s.map).filter((c) => s.map[c] === 'active');
  const held = orderedCapabilities(s.map);

  const has = (c: Capability) => s.map[c] === 'active';
  const isPending = (c: Capability) => s.map[c] === 'pending';

  return {
    ready: s.hydrated,
    capabilities: active,
    held,
    map: s.map,
    source: s.source,
    realRole: s.realRole,
    count: active.length,

    has,
    hasAny: (...c) => c.some(has),
    hasAll: (...c) => c.every(has),
    isPending,
    status: (c) => s.map[c],
    onlyPending: active.length === 0 && held.length > 0,
    isMultiCapability: active.length >= 2,

    request: requestCapability,
    remove: removeCapability,
    applyOnboarding: applyOnboardingSelection,
    approveOrganisateur,
    setExact,
    resetToReal,
  };
}
