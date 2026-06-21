# docs/stripe.md — Stripe Connect & Escrow

> Détail extrait de CLAUDE.md. Modèle **Separate Charges & Transfers** (escrow custom : fonds retenus puis transférés au vendeur).

## Onboarding vendeur
- Edge : `create-stripe-onboarding-link`, `complete-seller-onboarding`, `check-seller-status`. Écran `stripe-onboarding.tsx`.
- 🔴 onboarding live non validé. Signal alerting `seller_not_onboarded`.

## Connect
- Comptes connectés vendeurs. Bypass Connect en mode test (Edge `create-checkout-session`).

## Checkout
- `create-checkout-session` / `verify-checkout-session` / `checkout.tsx` / `checkout-success.tsx`.
- Montant **serveur-authoritative** (le client n'impose jamais le prix ; recalc triggers DB).

## Escrow
- Logique partagée `supabase/functions/_shared/escrow.ts` (module-agnostique).
- Cycle : paiement → fonds `held` → release (auto cron J0/H+24, manuel buyer, ou admin) → `transfer` vers vendeur → résa `completed` (trigger).
- Modèle « silence = release ». Crons : `equishow_escrow_release_hourly`, `equishow_escrow_buyer_notify` (*/30), `equishow_escrow_alert` (*/30). Edge : `release-payment`, `escrow-cron-release`.

## Commissions
- `get_commission_rate(service_type)` ajoute la commission au checkout ; affichée au cavalier dans la **modale récap** avant Stripe. ~9 % observé (200→218, 500→545) — _taux exact par type à confirmer_.
- Dashboard `admin-commissions.tsx`.

## Remboursements / litiges
- Remboursement : `process-refund` (buyer OU admin, RLS-aware). Sentinelle mismatch refund/reversal = 0.
- Litiges : `manage-dispute` + table `payment_disputes` + `admin-disputes.tsx`. Notif ouverture → admins + vendeur ; résolution → acheteur. Alerting aging 48h.

## Webhooks ⚠️
- `webhook-stripe` (idempotence via `stripe_webhook_events`).
- **Toujours déployer `--no-verify-jwt`** : auth = signature HMAC `verifyStripeSignature`. Sinon gateway 401 → paiements bloqués `pending`. Pérennisé dans `supabase/config.toml`.

## Boost coach
- `create-boost-checkout` → `coach_boost_purchases` → `fn_apply_boost`. Cron `equishow_boost_certified_daily`.

## Pièges historiques
- Mig 036 : retrait TVA (modèle sans HT/TTC) — bug « 112,50 € vs 94,50 € ».
- Mig 066 : `release_trigger` doit valoir `auto_cron` (pas `cron`) sinon CHECK rejette → release cassée.
