-- ============================================================================
-- 094 — SÉCURITÉ · VERROU ANTI-ESCALADE VIA profiles.role_id (F2, P0)
-- ============================================================================
-- VULNÉRABILITÉ (confirmée exploitable, pas théorique) — chaîne d'escalade :
--   1. `roles` a la policy `roles_select_authenticated` (USING true) → TOUT
--      utilisateur authentifié lit l'UUID du rôle 'admin' (aucun secret) ;
--   2. `profiles_update_own` = USING (id = auth.uid()) SANS `WITH CHECK`, et
--      `authenticated` détient le grant colonne UPDATE(role_id) → un cavalier
--      exécute `update public.profiles set role_id = '<admin-uuid>' where
--      id = auth.uid()` ; la voie INSERT est également ouverte
--      (`profiles_insert_own` ne contraint que `id`, grant INSERT(role_id) présent) ;
--   3. `is_admin()` (SECURITY DEFINER) répond `true` dès que
--      profiles.role_id → roles.name='admin' et is_active=true.
-- `is_admin()` gouverne des lectures/écritures sensibles : SELECT de TOUS les
-- profils (PII), audit_logs, security_events, user_consents, analytics_events,
-- activity_logs, et writes concours_categories + gestion de la table `roles`
-- (`roles_all_admin`). C'est donc une escalade de privilège réelle.
-- NB : ce chemin (profiles/roles/is_admin) est le système LEGACY ; l'app et les
-- Edge Functions n'utilisent QUE `users.role` (verrouillé par la mig 093). Aucun
-- flux authentifié légitime n'écrit `profiles.role_id` (le trigger de signup
-- `handle_new_user` insère sans role_id ; role_id n'est peuplé par aucune fonction).
--
-- CORRECTIF (minimal, défense en profondeur, 100 % additif/réversible) :
--   (1) COLONNE — `authenticated` détient un grant INSERT/UPDATE *table-level*
--       (qui couvre TOUTES les colonnes, dont role_id ⇒ un REVOKE(role_id) seul
--       serait sans effet). On retire donc le grant table-level et on ne
--       re-grant QUE les colonnes non sensibles (role_id + id exclus) : un
--       utilisateur standard ne peut plus JAMAIS écrire role_id (ni à la création
--       ni à la mise à jour) → racine de l'escalade neutralisée. N'affecte NI
--       service_role NI les fonctions SECURITY DEFINER (owner, ex. handle_new_user).
--   (2) RLS — `profiles_update_own` reçoit un `WITH CHECK (id = auth.uid())`
--       (absent jusqu'ici) : empêche de réassigner sa ligne à un autre id.
--   (3) is_admin() — épinglage `set search_path = public` (la fonction est
--       SECURITY DEFINER sans search_path = durcissement recommandé). Corps
--       inchangé ; role_id étant désormais non auto-déclaratif, la source lue
--       n'est plus modifiable par l'utilisateur.
-- Les éditions de profil normales (full_name/phone/avatar_url/club_name/
-- ffe_number/is_active) restent autorisées. Chemins admin/service_role intacts.
--
-- HORS PÉRIMÈTRE (non touché) : Stripe/payments/escrow/webhooks/Resend, la
-- garde `users.role` (mig 093), la lecture de `roles` (rendue inoffensive une
-- fois role_id verrouillé), aucune logique métier.
--
-- Application prod (workflow Equishow) :
--   supabase db query -f supabase/migrations/094_profiles_guard_role_id.sql --linked
--   supabase migration repair --status applied 094 --linked
--   JAMAIS db push.
-- ============================================================================

begin;

-- (1) Verrou colonne : retire le grant table-level (couvre role_id) et ne
--     re-grant QUE les colonnes non sensibles. role_id exclu partout ; id exclu
--     de l'UPDATE (PK, couvert par le WITH CHECK ci-dessous). created_at/updated_at
--     ont des defaults / sont gérés par le trigger trg_profiles_updated_at.
revoke insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant insert (id, full_name, phone, avatar_url, club_name, ffe_number, is_active)
  on public.profiles to authenticated;
grant update (full_name, phone, avatar_url, club_name, ffe_number, is_active)
  on public.profiles to authenticated;

-- (2) RLS : ajoute le WITH CHECK manquant sur l'UPDATE de sa propre ligne.
alter policy profiles_update_own on public.profiles
  using (id = auth.uid())
  with check (id = auth.uid());

-- (3) Durcissement is_admin() : épingle search_path (corps identique).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and r.name = 'admin'
      and p.is_active = true
  );
$$;

commit;
