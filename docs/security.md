# Sécurité — Equishow

## Principes

1. **Deny by default** — RLS activé sur toutes les tables, 0 accès sans policy.
2. **Zéro confiance frontend** — sécurité dans la DB, jamais dans Flutter.
3. **Zéro clé sensible côté client** — seule la clé `anon` dans Flutter.

## Variables d'environnement

| Variable                    | Flutter | CI/Backend |
|-----------------------------|---------|------------|
| `SUPABASE_URL`              | ✅      | ✅         |
| `SUPABASE_ANON_KEY`         | ✅      | ✅         |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌      | ✅         |

## Modèle RLS

| Table              | Utilisateur | Admin   |
|--------------------|-------------|---------|
| `profiles`         | Ses données | Tout    |
| `roles`            | Lecture     | CRUD    |
| `user_consents`    | Ses données | Lecture |
| `audit_logs`       | ❌          | Lecture |
| `security_events`  | Ses events  | Tout    |
| `analytics_events` | Insert      | Lecture |
| `activity_logs`    | Ses logs    | Lecture |

## Système de rôles & escalade de privilège (MAJ 2026-07-12)

**Source de vérité autoritative = `users.role`** (`cavalier`/`coach`/`organisateur`/`admin`). Bascule via RPC `change_user_role` (SECURITY DEFINER, bloque l'auto-promotion admin). Admin = `users.role='admin'` — c'est ce que lisent le front, les Edge Functions et les policies admin récentes (mig 079+).

**Système legacy parallèle** (mig 001) : `profiles.role_id` → table `roles` → fonction `is_admin()` (SECURITY DEFINER). **Non utilisé par le front ni les Edge Functions** ; seules quelques policies RLS l'appellent encore (`profiles`, `roles`, `user_consents`, `audit_logs`, `security_events`, `analytics_events`, `activity_logs`, `concours_categories`). Conservé mais **sécurisé** ; simplification recommandée (retrait au profit de `users.role`) — voir audit dédié.

### Deux escalades de privilège corrigées (2026-07-12)

| Mig | PR | Faille | Correctif |
|---|---|---|---|
| **093** | #82 | **P0 self-admin `users.role`** : policy `users_update_own` = `USING (id=auth.uid())` **sans `WITH CHECK`** (Postgres réutilise USING, ne portant que sur `id`) + grant `UPDATE(role)` à `authenticated` + 0 trigger ⇒ `update users set role='admin' where id=auth.uid()` contournait `change_user_role`. Impact : escalade admin → refund/dispute/release escrow + PII. | Trigger `BEFORE UPDATE trg_users_guard_role` (`tg_users_guard_role`, **SECURITY INVOKER**) : neutralise `new.role:=old.role` si changement + `current_user='authenticated'` + appelant non admin. `change_user_role` (definer owner=postgres), `service_role`, admin : intacts. |
| **094** | #83 | **F2 escalade legacy `profiles.role_id`** : (1) `roles.roles_select_authenticated` (`USING true`) → tout authentifié lit l'UUID admin ; (2) `profiles_update_own` sans `WITH CHECK` + grant **table-level** UPDATE (couvre `role_id`) → `update profiles set role_id='<admin>'` ; INSERT idem (`profiles_insert_own` ne contraint que `id`) ; (3) `is_admin()` → `true` → PII tous profils + audit_logs/security_events/consents/analytics_events/activity_logs + gestion `roles`/`concours_categories`. N'atteint PAS l'escrow (gaté `users.role`). | Permissions de colonnes : retrait du grant table-level INSERT/UPDATE à `authenticated` + re-grant **colonnes non sensibles seulement** (`role_id`/`id` exclus) ; `WITH CHECK (id=auth.uid())` sur `profiles_update_own` ; `set search_path=public` sur `is_admin()`. |

**Preuves** : harness 093 **9/9**, harness 094 **8/8** (Postgres jetable, escalade reproduite avant → neutralisée après → rollback = faille revient) ; escrow **63/63** ; `tsc` 0 ; recettes prod transactionnelles (BEGIN…ROLLBACK) 5/5 et 4/4 PASS. **Aucun élément Stripe / escrow / paiements / webhooks touché par 093 ni 094.**

**Règles durcies** : toute policy UPDATE sur table à champ sensible = `WITH CHECK` explicite ; grants **par colonne** (jamais table-level) sur une table portant un champ d'autorité ; toute fonction SECURITY DEFINER = `search_path` épinglé ; nouvelles autorisations admin basées sur `users.role='admin'`, pas sur `is_admin()`.

## RGPD

- IPs et user-agents : stockés hashés (SHA-256) uniquement
- Tokens : `flutter_secure_storage` (Keychain / Keystore)
- Droit à l'oubli : `ON DELETE CASCADE` depuis `auth.users`
- Consentement requis avant analytics (`rgpd_analytics`)
