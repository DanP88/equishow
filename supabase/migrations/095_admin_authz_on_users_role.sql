-- ============================================================================
-- 095 — SÉCURITÉ · REBASE DES AUTORISATIONS ADMIN SUR users.role (retrait de
--        la dépendance legacy is_admin() dans les policies RLS)
-- ============================================================================
-- CONTEXTE (audit read-only, 2026-07-12) : deux systèmes de rôles coexistent.
--   • AUTORITATIF = `users.role` (front, Edge Functions, RPC change_user_role,
--     garde mig 093). Fonction canonique `public.is_app_admin()` DÉJÀ en prod
--     (SECURITY DEFINER, search_path=public, lit UNIQUEMENT users.role), déjà
--     utilisée par 9 policies sensibles (users, payments, payment_disputes,
--     support_requests, platform_settings, coach_boost_purchases, points_config,
--     level_thresholds, user_activity_events).
--   • LEGACY = `profiles.role_id` → `roles` → `is_admin()`. Données MORTES :
--     les 6 lignes profiles ont role_id NULL ⇒ `is_admin()` renvoie `false` pour
--     TOUT LE MONDE. Le signup (handle_new_user_v2) n'écrit pas profiles ;
--     aucune fonction ne peuple role_id ; front/Edge ne lisent jamais ce système.
--
-- PROBLÈME : 10 policies dépendent encore de `is_admin()` (legacy) → l'admin
-- réel (users.role='admin') N'A AUCUN accès fonctionnel à ces tables aujourd'hui
-- (is_admin() = false). Ce lot rebase ces autorisations sur `is_app_admin()`.
--
-- PÉRIMÈTRE 095 (uniquement) : rebrancher/retirer les 10 références à is_admin().
-- ON CONSERVE is_admin(), profiles et roles intacts (suppression = 096/097).
-- Réutilise `is_app_admin()` existante — AUCUNE nouvelle fonction (évite le drift).
-- SECURITY DEFINER volontaire (côté is_app_admin déjà en prod) : la fonction doit
-- lire users.role indépendamment de la visibilité RLS de l'appelant sur `users`,
-- de façon non-spoofable ; users.role est verrouillé par la mig 093.
--
-- MOINDRE PRIVILÈGE (les anciens droits ne sont PAS reconduits mécaniquement) :
--   (A) RESTAURÉS sur is_app_admin() — besoin métier réel de supervision admin :
--       - lecture (SELECT) : audit_logs, security_events, user_consents,
--         activity_logs, analytics_events (journaux + PII, supervision/RGPD) ;
--       - écriture concours_categories (INSERT/UPDATE/DELETE) : données de
--         référence FFE gérées par l'admin à l'import.
--   (B) NON RECONDUITS — tables legacy mortes (retrait prévu 097), aucun besoin
--       fonctionnel d'accès admin (front/Edge ne les lisent pas) :
--       - profiles.profiles_select_admin (lecture croisée d'une table morte) → droppée ;
--       - roles.roles_all_admin (écriture d'une table gelée) → droppée.
--       roles reste lisible via roles_select_authenticated ; profiles reste
--       accessible en own-row (select/insert/update_own). is_admin() n'est PAS
--       affectée (elle lit profiles/roles en SECURITY DEFINER, hors RLS).
--
-- HORS PÉRIMÈTRE (non touché) : Stripe/payments/escrow/webhooks/Resend, front,
-- Edge Functions, is_admin(), tables profiles/roles (structure/données),
-- garde 093 (users.role), verrou 094 (profiles.role_id).
--
-- Application prod (workflow Equishow) :
--   supabase db query -f supabase/migrations/095_admin_authz_on_users_role.sql --linked
--   supabase migration repair --status applied 095 --linked
--   JAMAIS db push.
-- ============================================================================

begin;

-- (A) Rebase des accès admin légitimes sur la source autoritative users.role.
alter policy audit_logs_select_admin      on public.audit_logs      using (public.is_app_admin());
alter policy security_events_select_admin on public.security_events using (public.is_app_admin());
alter policy consents_select_admin        on public.user_consents   using (public.is_app_admin());
alter policy activity_logs_select_admin   on public.activity_logs   using (public.is_app_admin());
alter policy analytics_select_admin       on public.analytics_events using (public.is_app_admin());

alter policy cc_insert_admin on public.concours_categories with check (public.is_app_admin());
alter policy cc_update_admin on public.concours_categories using (public.is_app_admin()) with check (public.is_app_admin());
alter policy cc_delete_admin on public.concours_categories using (public.is_app_admin());

-- (B) Moindre privilège : retrait des accès admin sur les tables legacy mortes
--     (aucune reconduction de droit ; retire la dépendance à is_admin()).
drop policy profiles_select_admin on public.profiles;
drop policy roles_all_admin       on public.roles;

commit;
