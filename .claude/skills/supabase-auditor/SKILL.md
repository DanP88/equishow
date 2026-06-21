---
name: supabase-auditor
description: Audit a Supabase migration or schema change for Equishow — RLS, rollback, FK, index, triggers, prod impact. Use before applying any migration or when reviewing DB changes.
---

# Supabase Auditor (Equishow)

Audit toute évolution Supabase avant application. Contexte projet : `docs/database.md`. Projet prod = `vhkjvnpxcqlmpokrgymx` uniquement.

## Checklist d'audit
1. **Migration additive** — pas de DROP/DELETE destructif (cleanup ultra-conservateur). Numéro > dernière appliquée.
2. **Rollback** — fichier `NNN_*_rollback.sql` présent et réellement réversible.
3. **RLS** — toute table touchée a des policies select/insert/update ciblées. Insert own (`auth.uid()=owner`), cross-user bloqué, admin = `users.role='admin'` (PAS `is_admin()` par défaut — vérifier). Hard delete bloqué si pas voulu.
4. **FK** — clés étrangères correctes (ex `→ public.users(id)`), CASCADE pensé.
5. **Index** — FK indexées, colonnes de filtre, UNIQUE anti-doublon. ⚠️ index partiel non inférable par `ON CONFLICT` (cf incident 079).
6. **Triggers** — n'entrent pas en conflit avec guards (`trg_guard_status_transition`) ni recalc montants. service_role bypass si nécessaire.
7. **Impact prod** — effet prouvé sur `payments`/escrow/reservations/realtime. Additif = 0 impact à démontrer.
8. **Realtime** — table consommée en live = publication + `replica identity full`.

## Pièges Equishow
- `transport_reservations` = `statut` (FR), pas `status`.
- `release_trigger` ∈ {manual_buyer, auto_cron, admin} (CHECK strict).
- `event_type` figé (CHECK) — pas de nouveau type analytics.

## Procédure
Harness rollback (`BEGIN; … ROLLBACK;`) sur cluster Postgres local jetable (`LC_ALL=C`) → JAMAIS la prod. Appliquer : `supabase db query -f NNN.sql --linked` + `supabase migration repair --status applied NNN --linked`. **Jamais `db push`. CLI, jamais MCP.**

## Sortie attendue
Verdict GO/NO-GO + risques P0–P3 + objets impactés + plan de recette + rollback.
