-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 030 — Système niveaux cavaliers + badges coachs (base)
--
-- Non destructif : ADD COLUMN + CREATE TABLE uniquement. Rollback safe.
-- Démarre à zéro : aucun backfill. Tous users à `points=0, level='debutant'`.
--
-- Contenu :
-- - users.points / users.level / users.profile_completed_at
-- - coach_profiles.is_certified / is_boosted / boost_expires_at
-- - public.user_activity_events (historique idempotent)
-- - public.points_config (poids ajustable par admin)
-- - public.level_thresholds (seuils ajustables par admin)
-- - view public.coach_stats (compte bookings + rating live)
-- - fn_award_points(user_id, kind, ref_table, ref_id, actor_id)
-- - fn_recalc_coach_certified() (à cron quotidiennement)
-- - RLS public read sur configs + self read sur events
--
-- Les triggers métier sont dans la migration 031.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── users : compteurs niveau ────────────────────────────────────────────────
alter table public.users
  add column if not exists points int not null default 0,
  add column if not exists level text not null default 'debutant',
  add column if not exists profile_completed_at timestamptz;

create index if not exists idx_users_points on public.users(points desc);
create index if not exists idx_users_level  on public.users(level);

-- ── coach_profiles : badges ─────────────────────────────────────────────────
alter table public.coach_profiles
  add column if not exists is_certified boolean not null default false,
  add column if not exists certified_at timestamptz,
  add column if not exists is_boosted boolean not null default false,
  add column if not exists boost_started_at timestamptz,
  add column if not exists boost_expires_at timestamptz;

create index if not exists idx_coach_profiles_certified on public.coach_profiles(is_certified) where is_certified = true;
create index if not exists idx_coach_profiles_boosted   on public.coach_profiles(is_boosted)   where is_boosted   = true;

-- ── points_config : poids par action (ajustable par admin) ──────────────────
create table if not exists public.points_config (
  kind        text primary key,
  points      int not null,
  active      boolean not null default true,
  description text,
  updated_at  timestamptz not null default now()
);

insert into public.points_config (kind, points, description) values
  ('booking_paid',          20, 'Réservation finalisée (paid)'),
  ('concours_participated', 15, 'Participation à un concours'),
  ('profile_completed',     10, 'Profil renseigné complet'),
  ('review_given',           5, 'Avis laissé'),
  ('comment_posted',         2, 'Commentaire publié'),
  ('post_published',         2, 'Post publié sur la communauté'),
  ('like_received',          1, 'Like reçu sur un post ou commentaire')
on conflict (kind) do nothing;

-- ── level_thresholds : seuils niveaux (ajustable par admin) ─────────────────
create table if not exists public.level_thresholds (
  level       text primary key,
  min_points  int not null,
  sort_order  int not null,
  label       text not null,
  updated_at  timestamptz not null default now()
);

insert into public.level_thresholds (level, min_points, sort_order, label) values
  ('debutant',     0, 1, 'Débutant'),
  ('passionne',  100, 2, 'Passionné'),
  ('confirme',   300, 3, 'Confirmé'),
  ('expert',     700, 4, 'Expert'),
  ('elite',     1500, 5, 'Élite')
on conflict (level) do nothing;

-- ── user_activity_events : historique idempotent ────────────────────────────
-- ref_id en TEXT pour supporter transport_reservations.id (TEXT) ET uuid.
-- actor_id : qui a déclenché l'évènement (ex: liker pour like_received).
create table if not exists public.user_activity_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  actor_id      uuid references public.users(id) on delete set null,
  kind          text not null,
  ref_table     text,
  ref_id        text,
  points_delta  int not null default 0,
  created_at    timestamptz not null default now()
);

-- Idempotence : un même évènement (même user + kind + ref + actor) compté 1x.
-- nulls not distinct (PG15+) → les NULL comptent comme valeur unique.
create unique index if not exists user_activity_events_unique
  on public.user_activity_events (user_id, kind, ref_table, ref_id, actor_id)
  nulls not distinct;

create index if not exists idx_user_activity_events_user
  on public.user_activity_events(user_id, created_at desc);

-- ── fn_award_points : point d'entrée central ────────────────────────────────
-- Idempotent : si l'événement existe déjà → no-op.
-- Recalcule users.level après chaque award.
create or replace function public.fn_award_points(
  p_user_id   uuid,
  p_kind      text,
  p_ref_table text default null,
  p_ref_id    text default null,
  p_actor_id  uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points       int;
  v_new_total    int;
  v_new_level    text;
begin
  -- Anti-self : on n'award pas un user pour une action sur lui-même
  if p_actor_id is not null and p_actor_id = p_user_id then
    return;
  end if;

  select points into v_points
    from public.points_config
    where kind = p_kind and active = true;
  if v_points is null then return; end if;

  -- Insert idempotent
  begin
    insert into public.user_activity_events
      (user_id, actor_id, kind, ref_table, ref_id, points_delta)
    values
      (p_user_id, p_actor_id, p_kind, p_ref_table, p_ref_id, v_points);
  exception when unique_violation then
    return; -- déjà compté
  end;

  -- Update total + recompute level
  update public.users
    set points = points + v_points
    where id = p_user_id
    returning points into v_new_total;

  if v_new_total is null then return; end if;

  select level into v_new_level
    from public.level_thresholds
    where min_points <= v_new_total
    order by min_points desc
    limit 1;

  if v_new_level is not null then
    update public.users set level = v_new_level where id = p_user_id and level <> v_new_level;
  end if;
end $$;

-- ── coach_stats : vue live des stats coach (pour fn_recalc_coach_certified) ─
create or replace view public.coach_stats as
select
  cp.user_id,
  coalesce((
    select count(*) from public.course_demands cd
    where cd.coach_id = cp.user_id and cd.status = 'paid'
  ), 0)::int as course_bookings_paid,
  coalesce((
    select count(*) from public.stage_reservations sr
    where sr.coach_id = cp.user_id and sr.status = 'paid'
  ), 0)::int as stage_bookings_paid,
  coalesce((
    select avg(note)::numeric(3,2) from public.avis a
    where a.destinataire_id = cp.user_id and a.type in ('coach','stage')
  ), 0) as avg_rating,
  coalesce((
    select count(*) from public.avis a
    where a.destinataire_id = cp.user_id and a.type in ('coach','stage')
  ), 0)::int as reviews_count
from public.coach_profiles cp;

-- ── fn_recalc_coach_certified : à appeler en cron quotidien ─────────────────
-- Critères :
--   - >= 10 bookings paid (course + stage cumulés)
--   - note moyenne >= 4.2 OU 0 avis (pas pénalisé sans avis)
--   - Pas de signalement critique (table reports — à ajouter plus tard, no-op tant qu'absente)
create or replace function public.fn_recalc_coach_certified() returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coach_profiles cp
  set is_certified = sub.eligible,
      certified_at = case
        when cp.is_certified = false and sub.eligible = true then now()
        else cp.certified_at
      end
  from (
    select
      cs.user_id,
      ((cs.course_bookings_paid + cs.stage_bookings_paid) >= 10
        and (cs.reviews_count = 0 or cs.avg_rating >= 4.2)
      ) as eligible
    from public.coach_stats cs
  ) sub
  where cp.user_id = sub.user_id;
end $$;

-- ── fn_expire_boosts : à appeler en cron quotidien ──────────────────────────
create or replace function public.fn_expire_boosts() returns void
language sql
security definer
set search_path = public
as $$
  update public.coach_profiles
  set is_boosted = false
  where is_boosted = true
    and boost_expires_at is not null
    and boost_expires_at < now();
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.points_config        enable row level security;
alter table public.level_thresholds     enable row level security;
alter table public.user_activity_events enable row level security;

-- points_config / level_thresholds : lecture publique authentifiée, écriture admin
drop policy if exists "points_config_select_authenticated" on public.points_config;
create policy "points_config_select_authenticated" on public.points_config
  for select to authenticated using (true);

drop policy if exists "points_config_admin_all" on public.points_config;
create policy "points_config_admin_all" on public.points_config
  for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "level_thresholds_select_authenticated" on public.level_thresholds;
create policy "level_thresholds_select_authenticated" on public.level_thresholds
  for select to authenticated using (true);

drop policy if exists "level_thresholds_admin_all" on public.level_thresholds;
create policy "level_thresholds_admin_all" on public.level_thresholds
  for all using (public.is_app_admin()) with check (public.is_app_admin());

-- user_activity_events : self read only, write via SECURITY DEFINER (fn_award_points)
drop policy if exists "user_activity_events_select_own" on public.user_activity_events;
create policy "user_activity_events_select_own" on public.user_activity_events
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "user_activity_events_admin_all" on public.user_activity_events;
create policy "user_activity_events_admin_all" on public.user_activity_events
  for all using (public.is_app_admin()) with check (public.is_app_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Permissions exécution
-- ─────────────────────────────────────────────────────────────────────────────
grant execute on function public.fn_award_points(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.fn_recalc_coach_certified() to service_role;
grant execute on function public.fn_expire_boosts() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Notes :
-- - Aucun backfill : tous les users restent à points=0, level='debutant'.
-- - Les triggers métier sont dans la migration 031.
-- - Cron quotidien (fn_recalc_coach_certified + fn_expire_boosts) à brancher
--   plus tard via pg_cron ou Edge Function planifiée.
-- ─────────────────────────────────────────────────────────────────────────────
