---
name: stripe-connect-expert
description: Reason about Equishow's Stripe Connect + escrow flows — seller onboarding, escrow hold/release, commissions, refunds, disputes, webhooks. Use when touching payments, checkout, or Edge payment functions.
---

# Stripe Connect Expert (Equishow)

Modèle **Separate Charges & Transfers** (escrow custom). Contexte complet : `docs/stripe.md`. Logique partagée : `supabase/functions/_shared/escrow.ts`.

## Domaines
- **Onboarding vendeur** — `create-stripe-onboarding-link`, `complete-seller-onboarding`, `check-seller-status`. Signal `seller_not_onboarded`. 🔴 live non validé.
- **Escrow** — paiement → `held` → release (auto cron J0/H+24, manuel buyer, admin) → `transfer` → résa `completed`. Modèle « silence = release ». `release_trigger ∈ {manual_buyer, auto_cron, admin}` (CHECK).
- **Commissions** — `get_commission_rate(service_type)` ajoutée au checkout, visible en modale récap. Montant **serveur-authoritative** (jamais imposé par le client). Sans TVA.
- **Remboursements** — `process-refund` (buyer OU admin, RLS-aware). Sentinelle mismatch refund/reversal = 0.
- **Litiges** — `manage-dispute` + `payment_disputes` (anti-doublon UNIQUE). Notif admins+vendeur, résolution→acheteur, aging 48h.
- **Webhooks** — `webhook-stripe` idempotent (`stripe_webhook_events`). **Toujours `--no-verify-jwt`** (auth = signature HMAC) sinon 401 → paiements `pending`.

## Règles d'or
- Ne jamais réintroduire de TVA (incident mig 036).
- `release_trigger` = `auto_cron` côté cron, pas `cron` (incident 066).
- Tester en mode **test** (carte 4242), comptes `.app` réels (pas quick-login mock).
- Diag cron pg_net = `net._http_response.status_code`, pas `cron.job_run_details`.

## Sortie attendue
Flux concerné + impact sur `payments`/escrow + risque P0–P3 + plan de test E2E (paiement→held→release→transfer→completed) + rollback.
