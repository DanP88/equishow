// ─────────────────────────────────────────────────────────────────────────────
// EquiShow V2 — FLAGS (PHASE 1 · FRONT-ONLY)
//
// Point de bascule UNIQUE entre V1 et V2.
//
//   V2_ENABLED = false  →  l'app se comporte EXACTEMENT comme la V1.
//                          Aucun écran V2 monté, aucun adaptateur actif.
//   V2_ENABLED = true   →  la V2 prend la main sur les surfaces dont le
//                          sous-flag correspondant est à true.
//
// RÈGLES PHASE 1 (rappel — voir v2/README.md) :
//   - Aucune écriture PROD depuis la V2. Toute mutation est simulée côté front
//     (v2/mocks, v2/adapters). Les lectures PROD réelles sont autorisées.
//   - Aucune modification backend / Supabase / RLS / RPC / trigger / view /
//     edge function / Stripe / escrow.
//   - Aucun build EAS/TestFlight de la V2.
//
// Supprimer entièrement la V2 = supprimer le worktree /Users/dan/equishow-v2-front
// et la branche feature/equishow-v2-front. La V1 (chore/eas-ios-testflight,
// tag v1.0.0-testflight-12) reste intacte, aucune opération backend requise.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interrupteur général. false = V1 stricte.
 *
 * ⚠️ ACTIVÉ sur la branche feature/equishow-v2-front UNIQUEMENT (worktree
 * /Users/dan/equishow-v2-front) pour rendre la V2 testable sans manipulation.
 * La branche est isolée : ceci n'atteint jamais `main` ni la V1
 * (/Users/dan/equishow). Repasser à `false` restaure le comportement V1 exact.
 */
export const V2_ENABLED = true;

/**
 * Sous-flags par surface. Ignorés tant que V2_ENABLED est false.
 * Activés un par un au fil des LOTS F1 → F11.
 */
export const V2_FLAGS = {
  capabilities: false, // F1 — compte omni-activités + onboarding
  // F2 — bottom bar + top bar + Accueil omni + groupe de routes (v2).
  //   false : l'app démarre en V1 (app/index.tsx → /(tabs)/chevaux).
  //   true  : app/index.tsx redirige vers /(v2)/accueil ; en __DEV__ la V2 est
  //           accessible SANS connexion (cf. app/_layout.tsx : garde d'auth
  //           assouplie pour le groupe (v2) uniquement en dev + V2 activée).
  navigation: true,
  agenda: false,       // F3 — agenda omni + notifications + messagerie
  monConcours: false,  // F4 — J'y serai + Mon concours + préparation
  transport: false,    // F5 — Je cherche / Je propose
  box: false,          // F6 — Je cherche / Je propose
  coach: false,        // F7 — coach lié au concours + double position
  cheval: false,       // F8 — fiche cheval recentrée + vaccination
  profil: false,       // F9 — profil unique + Mes activités + avis
  organisateur: false, // F10 — espace orga dans le compte omni + communauté
  design: false,       // F11 — iconographie, couleurs, pills
} as const;

export type V2Flag = keyof typeof V2_FLAGS;

/** Helper : true seulement si l'interrupteur général ET le sous-flag sont actifs. */
export function isV2(flag: V2Flag): boolean {
  return V2_ENABLED && V2_FLAGS[flag];
}

/**
 * Garde-fou anti-écriture PROD (PHASE 1).
 * Tout adaptateur V2 qui s'apprête à faire un insert/update/delete réel doit
 * passer par ce point : en Phase 1 il LÈVE une erreur explicite pour forcer la
 * simulation. Retiré/assoupli seulement en Phase 2 (backend V2).
 */
export const V2_ALLOW_PROD_WRITES = false;

export function assertNoProdWrite(context: string): never {
  throw new Error(
    `[V2 PHASE 1] Écriture PROD interceptée (${context}). ` +
      `Cette action doit être simulée côté front (v2/mocks|adapters). ` +
      `Voir v2/README.md.`,
  );
}
