---
name: release-manager
description: Drive an Equishow release end-to-end — CI, Supabase migrations, Vercel deploy, recette, rollback. Use when preparing a PR, merging to main, or shipping a migration to prod.
---

# Release Manager (Equishow)

Pilote une mise en prod. Main protégée (ruleset, squash-only). Prod = **merge sur `main`** (push branche = Preview 401).

## Pipeline
1. **Branche** `feat/*` ou `fix/*` depuis `main` à jour.
2. **CI** — Build Application + Test Suite requis (bloquants) ; lint/security/database advisory. Vercel Preview verte.
3. **Migrations** — appliquer prod AVANT/en cohérence avec le merge front : `supabase db query -f NNN.sql --linked` + `supabase migration repair --status applied NNN --linked`. Jamais `db push`. Harness rollback validé d'abord.
4. **Edge** — `supabase functions deploy <fn>` ; `webhook-stripe`/`send-push` = `--no-verify-jwt`.
5. **Merge** — squash → `main` → Vercel Production (2 projets). Vérifier bundle servi (hard refresh, cache).
6. **Recette** — E2E du module (Stripe test 4242, comptes `.app`), escrow held→release→completed, realtime/badges.
7. **Cleanup** — supprimer la branche.

## Rollback
- DB : exécuter `NNN_*_rollback.sql` + `migration repair --status reverted`.
- Front/web : revert commit/PR → Vercel redéploie le bundle précédent.
- Edge : redeploy version précédente. Stripe live↔test = swap secrets + redeploy.
- Cron : `cron.unschedule('<nom>')`.

## Vérifs avant GO
- `migration list` aligné local↔remote.
- Crons actifs (`net._http_response.status_code`, pas `job_run_details`).
- Stripe mode (test/live) confirmé pour le contexte.
- Commit : terminer par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commiter/pousser uniquement si demandé.

## Sortie attendue
Checklist cochée (PR/Merge/Deploy) + risque P0–P3 + plan de recette + rollback prêt.
