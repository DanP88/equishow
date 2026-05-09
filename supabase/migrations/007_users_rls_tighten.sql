-- Migration 007 : durcissement RLS sur public.users (audit P8)
-- Avant : tout user authentifié pouvait SELECT * sur tous les rows users
--         (PII : email, stripe_account_id, etc. exposés à tout le marketplace).
-- Après : un user ne lit que SA row. Admin garde l'accès complet via users_admin_all.
-- Une vue `public.users_public` expose les colonnes publiques pour les lookups
-- marketplace (futurs écrans : annonces, profils coach publics, etc.).

-- 1) Remplacer la policy SELECT permissive par une policy "self only"
drop policy if exists "users_select_authenticated" on public.users;

create policy "users_select_self"
  on public.users
  for select
  to authenticated
  using (id = auth.uid());

-- Note : la policy `users_admin_all` (FOR ALL using is_app_admin()) déjà créée
-- en migration 005 continue de couvrir l'accès admin complet (lecture/écriture).

-- 2) Vue publique pour lookups marketplace : colonnes non-sensibles uniquement
-- - exclues : email, plan, plan_id, stripe_*, updated_at
-- - incluses : identité d'affichage + métier visible (role, disciplines, region, bio)
-- DROP + CREATE pour idempotence forte si le shape évolue (CREATE OR REPLACE
-- échoue si l'output set change).
drop view if exists public.users_public;

create view public.users_public as
  select
    id,
    prenom,
    nom,
    pseudo,
    role,
    region,
    disciplines,
    bio,
    avatar_color,
    avatar_url,
    initiales,
    created_at
  from public.users;

-- SECURITY DEFINER explicite : la vue exécute avec les droits de son propriétaire,
-- donc bypass la RLS "users_select_self" pour permettre les lookups d'autrui
-- sur le sous-ensemble safe.
alter view public.users_public set (security_invoker = false, security_barrier = true);

revoke all    on public.users_public from public, anon;
grant  select on public.users_public to authenticated;

comment on view public.users_public is
  'P8: vue safe des users pour lookups marketplace. Pas de PII (email) ni de Stripe.';
