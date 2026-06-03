-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 048 — Bootstrap automatique coach_profiles
--
-- Contexte (audit Phase 0, 2026-06-03) :
--   `SELECT … FROM users u LEFT JOIN coach_profiles cp ON cp.user_id=u.id
--    WHERE u.role='coach' AND cp.user_id IS NULL`
--   → 2 / 2 coaches en prod n'ont aucun coach_profile.
--   Conséquences observables :
--     - `create-boost-checkout` rejette en 409 ("Crée d'abord ton profil coach")
--     - le marketplace coach (filtré par discipline depuis `coach_profiles`)
--       ne retourne aucun coach
--     - aucune statistique coach (note moyenne, certification) calculable
--
-- Stratégie :
--   - Trigger AFTER INSERT ON users WHEN (NEW.role = 'coach')
--     → insère un row vide dans coach_profiles (idempotent)
--   - Trigger AFTER UPDATE ON users WHEN (NEW.role = 'coach' AND OLD.role <> 'coach')
--     → couvre les passages de rôle (ex: cavalier → coach via /compte-type)
--   - Backfill ON CONFLICT DO NOTHING pour les 2 coaches actuels
--
-- Non destructif : pas de DROP, pas d'écriture sur les rows existantes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper : crée le profil vide s'il n'existe pas (idempotent) ─────────────
create or replace function public.fn_bootstrap_coach_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.coach_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end $$;

comment on function public.fn_bootstrap_coach_profile(uuid) is
  'Crée une ligne coach_profiles vide si elle n''existe pas. Idempotent.
   Appelé par les triggers users (INSERT + passage à role=coach). Mig 048.';


-- ── Trigger AFTER INSERT : nouveau user avec role=coach ────────────────────
create or replace function public.trg_users_coach_profile_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'coach' then
    perform public.fn_bootstrap_coach_profile(new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_users_coach_profile_on_insert on public.users;
create trigger trg_users_coach_profile_on_insert
  after insert on public.users
  for each row execute function public.trg_users_coach_profile_on_insert();


-- ── Trigger AFTER UPDATE : passage de role vers coach ──────────────────────
create or replace function public.trg_users_coach_profile_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'coach' and (old.role is null or old.role <> 'coach') then
    perform public.fn_bootstrap_coach_profile(new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_users_coach_profile_on_update on public.users;
create trigger trg_users_coach_profile_on_update
  after update of role on public.users
  for each row execute function public.trg_users_coach_profile_on_update();


-- ── Backfill : créer les profils manquants pour les coaches actuels ────────
-- (idempotent grâce au ON CONFLICT)
insert into public.coach_profiles (user_id)
select u.id
  from public.users u
  left join public.coach_profiles cp on cp.user_id = u.id
 where u.role = 'coach'
   and cp.user_id is null
on conflict (user_id) do nothing;
