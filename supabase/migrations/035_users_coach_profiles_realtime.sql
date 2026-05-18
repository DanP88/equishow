-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 035 — Activer realtime pour public.users + public.coach_profiles
--
-- Objectif : quand un user gagne des points et passe au niveau supérieur
-- (trigger met à jour users.points + users.level), tous les badges
-- <UserBadge userId=... /> de l'app (posts, commentaires, profil, view-coach)
-- se mettent à jour en LIVE sans recharger.
--
-- Idem pour coach_profiles (is_certified, is_boosted, boost_expires_at)
-- déjà filtré côté hook useUserBadges via filter user_id=eq.X.
--
-- Idempotent. Replica identity full requis pour récupérer les nouveaux
-- champs sur l'event UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'users'
  ) then
    alter publication supabase_realtime add table public.users;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'coach_profiles'
  ) then
    alter publication supabase_realtime add table public.coach_profiles;
  end if;
end $$;

alter table public.users           replica identity full;
alter table public.coach_profiles  replica identity full;
