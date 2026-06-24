---
name: supabase-performance-expert
description: Equishow Postgres/Supabase performance — indexes, slow queries, SQL views, RPC functions, realtime, query plans, N+1. Use when something is slow or before scaling read-heavy paths.
---

# Supabase Performance Expert (Equishow)

## Domaine
Performance Postgres/Supabase : index, requêtes lentes, vues SQL, fonctions RPC, realtime, plans de requête, N+1 côté client. Contexte : `docs/database.md`. Lecture seule par défaut (EXPLAIN, pas de DDL sans `migration-reviewer`).

## Quand l'utiliser
- Écran/liste lent, requête longue.
- Avant de scaler un chemin read-heavy (analytics, hub concours, agenda).
- Vue/RPC à optimiser ; suspicion de N+1 (boucle de requêtes front).

## Quand NE PAS l'utiliser
- Revue de migration/locks au déploiement → `migration-reviewer`. RLS/sécu → `security-auditor`. Cache/état front → `state-management-expert`.

## Checklist
1. **Index** : FK indexées ? colonnes de filtre/tri ? UNIQUE utile ? index partiel pertinent (mais piège ON CONFLICT).
2. **Plan** : `EXPLAIN (ANALYZE, BUFFERS)` (lecture seule) — seq scan sur grosse table, tri/jointure coûteux.
3. **Vues** : `v_mkt_*`/`v_funnel_*`/`v_analytics_*` `security_invoker=true` ; agrégats lourds → matérialisation à évaluer.
4. **N+1** : front qui boucle des `select` par ligne → batcher (`useUsersByIds`, `in(...)`).
5. **Realtime** : tables en publication + `replica identity full` ; ne pas sur-souscrire ; `conversation_reads`/`concours_thread_reads` volontairement hors realtime.
6. **RPC** : `security definer set search_path=public` ; éviter le travail redondant par appel.

## Livrable attendu
Diagnostic perf : **requête/écran · plan (coût/scan) · cause (index manquant/N+1/vue lourde) · correctif (index/réécriture/batch) · gain estimé · risque déploiement (→ migration-reviewer)**.
