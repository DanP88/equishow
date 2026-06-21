# docs/incidents.md — Incidents historiques

> Détail extrait de CLAUDE.md. Format : Date · Symptôme · Cause · Correction · Prévention. CLAUDE.md n'en garde qu'une version condensée.

## 2026-06-14 — Signup « permission denied for table users » (PR #26)
- *Symptôme* : crash à l'inscription.
- *Cause* : upsert front post-`auth.signUp` en `anon` (confirmation email ON → pas de session), alors que la row est déjà provisionnée par `handle_new_user_v2`.
- *Correction* : suppression de l'écriture front (pas de migration).
- *Prévention* : ne jamais écrire `public.users` côté client au signup ; laisser le trigger DB. Pas une régression RLS.

## 2026-06-11 — Cron auto-release escrow cassé (mig 066)
- *Symptôme* : fonds jamais libérés automatiquement.
- *Cause* : `escrow-cron-release` écrivait `release_trigger:"cron"` ⛔ CHECK (attend `auto_cron`) + timeout pg_net 5s.
- *Correction* : `cron`→`auto_cron`, `timeout_milliseconds:=30000`, mutex `escrow_cron_lock`.
- *Prévention* : respecter les CHECK enums ; diag cron via `net._http_response.status_code`, PAS `cron.job_run_details`.

## 2026-06-08 — Surbooking transport (F1, mig 060)
- *Symptôme* : places jamais décrémentées + place fantôme au remboursement.
- *Cause* : parcours `pending→paid` saute `accepted` ; F1 ne consommait qu'au `pending→accepted`.
- *Correction* : `fn_availability_transport` symétrique sur S={accepted,awaiting_payment,paid,completed} + backfill (060b).
- *Prévention* : raisonner en **ensemble de statuts consommants**, pas en transition unique. Stage et Box couverts par la migration 062, avec logique symétrique inspirée du patron 060.

## 2026-06-17 — Import concours CSV écrivait 0 ligne (mig 079)
- *Symptôme* : import « terminé » mais 0 concours.
- *Cause* : `ON CONFLICT(numero_ffe)` → 42P10 (index partiel non inférable) + RLS admin `is_admin()` false + erreurs avalées front + dédup contre store mémoire pollué.
- *Correction* : vraie `UNIQUE(numero_ffe)` + policies admin `role='admin'` + dédup contre la base + compteurs séparés + bouton vider cache.
- *Prévention* : index partiel non inférable par ON CONFLICT ; RLS admin = `role='admin'`.

## 2026-06-16 — Radar org `column tr.status does not exist` (mig 077)
- *Symptôme* : Radar plantait.
- *Cause* : `fn_org_concours_radar` lisait `tr.status` mais `transport_reservations` a `statut` (FR).
- *Correction* : `tr.statut` + trigger notif admins à la création de claim.
- *Prévention* : `transport_reservations` = `statut`, les autres tables = `status`.

## 2026-05-20 — Stripe « 112,50 € vs 94,50 € » (mig 036)
- *Symptôme* : montant gonflé au checkout.
- *Cause* : TVA dans les triggers d'autorité serveur.
- *Correction* : retrait TVA (modèle sans HT/TTC).
- *Prévention* : pas de logique TVA ; seller_amount + platform_fee.

## Webhook Stripe `verify_jwt`
- *Symptôme* : paiements bloqués `pending` (gateway 401 avant le code).
- *Cause* : `webhook-stripe` déployé avec `verify_jwt=true`.
- *Prévention* : **toujours `--no-verify-jwt`** (auth = signature HMAC). Pérennisé dans `config.toml`. Idem `send-push` (`x-push-secret`).

## Migrations — « 011/012 jamais appliquées »
- *Cause* : artefact MCP/InstallCom (MCP voyait le mauvais projet).
- *Prévention* : toujours passer par le CLI Supabase, jamais le MCP. Vrai projet = `vhkjvnpxcqlmpokrgymx`.
