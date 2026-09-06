// ─────────────────────────────────────────────────────────────────────────────
// v2/capabilities — MODÈLE DES CAPACITÉS (fondation omni-activités)
//
// Une PERSONNE possède 1 à 3 CAPACITÉS SIMULTANÉES. Ce ne sont PAS des modes :
// aucune notion de « rôle actif », aucun « passer en … ». Toutes les capacités
// actives coexistent en permanence dans toute l'app.
//
// `admin` n'est PAS une capacité V2 (reste un concept V1 hors périmètre).
// ─────────────────────────────────────────────────────────────────────────────

/** Les 3 activités sélectionnables. */
export type Capability = 'cavalier' | 'coach' | 'organisateur';

export const ALL_CAPABILITIES: readonly Capability[] = ['cavalier', 'coach', 'organisateur'] as const;

/**
 * Statut d'une capacité détenue :
 *  - 'active'  : utilisable immédiatement.
 *  - 'pending' : demandée, en attente de validation (organisateur uniquement en
 *                Phase 1 — validation admin SIMULÉE côté front, aucun email réel).
 */
export type CapabilityStatus = 'active' | 'pending';

/**
 * D'où vient l'état courant des capacités :
 *  - 'real'         : dérivé du vrai `users.role` (backend, lecture seule).
 *  - 'simulated'    : l'utilisateur a modifié ses activités via l'onboarding V2.
 *  - 'dev-override' : forcé depuis le panneau DEV (test des combinaisons).
 */
export type CapabilitySource = 'real' | 'simulated' | 'dev-override';

/** Map capacité → statut. Une capacité absente de la map = non détenue. */
export type CapabilityMap = Partial<Record<Capability, CapabilityStatus>>;

export interface CapabilityState {
  /** Capacités détenues + leur statut. */
  map: CapabilityMap;
  /** Origine de `map` (pour l'affichage « simulé / temporaire »). */
  source: CapabilitySource;
  /** Vrai rôle backend au dernier sync (lecture seule, jamais écrit en PROD). */
  realRole: Capability | 'admin';
  /** ISO — dernière modification locale. */
  updatedAt: string;
  /** true tant que la 1ʳᵉ hydratation AsyncStorage n'est pas terminée. */
  hydrated: boolean;
}

export const CAPABILITY_LABEL: Record<Capability, string> = {
  cavalier: 'Cavalier',
  coach: 'Coach',
  organisateur: 'Organisateur',
};

export const CAPABILITY_TAGLINE: Record<Capability, string> = {
  cavalier: 'Je participe à des concours et j’organise mes déplacements.',
  coach: 'J’accompagne et coache des cavaliers en concours.',
  organisateur: 'J’organise ou gère des concours.',
};

/** Couleur d'accent par capacité (aligne V1 : cavalier orange, coach violet, org bleu). */
export const CAPABILITY_COLOR: Record<Capability, string> = {
  cavalier: '#F97316',
  coach: '#7C3AED',
  organisateur: '#0369A1',
};
