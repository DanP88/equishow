// ─────────────────────────────────────────────────────────────────────────────
// ACCÈS TESTEURS — Configuration d'expiration
//
// Pour changer la date limite : modifier EXPIRATION_DATE ci-dessous.
// Pour désactiver le blocage sans toucher au code :
//   → Ajouter EXPO_PUBLIC_DISABLE_TEST_EXPIRATION=true dans Vercel (env Production)
//
// Logique :
//   production  → lien testeurs WhatsApp, bloqué après expiration
//   preview     → lien privé pour toi, jamais bloqué
//   development → jamais bloqué
// ─────────────────────────────────────────────────────────────────────────────

export const EXPIRATION_DATE = new Date('2026-05-01T23:59:59');

const env = process.env.EXPO_PUBLIC_VERCEL_ENV ?? 'development';
const disableExpiration = process.env.EXPO_PUBLIC_DISABLE_TEST_EXPIRATION === 'true';

export const isTestAccessExpired: boolean =
  env === 'production' &&
  !disableExpiration &&
  new Date() > EXPIRATION_DATE;
