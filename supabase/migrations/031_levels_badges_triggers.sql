-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 031 — Triggers métier pour le système de niveaux
--
-- Non destructif : CREATE FUNCTION + CREATE TRIGGER uniquement.
-- Chaque trigger appelle public.fn_award_points (idempotent).
--
-- Couvert :
--   - course_demands  status → paid  → +20 cavalier_id (booking_paid)
--   - stage_reservations status → paid → +20 cavalier_id (booking_paid)
--   - box_reservations  status → paid → +20 buyer_id (booking_paid)
--   - transport_reservations statut → paid → +20 buyer_id (booking_paid)
--   - avis insert → +5 auteur_id (review_given)
--   - com_posts_* insert → +2 auteur_id (comment_posted)
--   - posts_* insert → +2 auteur_id (post_published)
--   - posts_* / com_posts_* update liked_by → +1 auteur (like_received, par liker)
--   - users update → +10 auteur (profile_completed, 1x)
--
-- Concours : pas de table dédiée pour l'instant. Le kind 'concours_participated'
-- existe dans points_config, sera branché plus tard.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── BOOKING PAID — course_demands ──────────────────────────────────────────
create or replace function public.trg_course_demand_paid() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and (old.status is null or old.status <> 'paid') then
    perform public.fn_award_points(
      new.cavalier_id, 'booking_paid', 'course_demands', new.id::text, null
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_course_demand_paid on public.course_demands;
create trigger trg_course_demand_paid
  after update on public.course_demands
  for each row execute function public.trg_course_demand_paid();

-- ── BOOKING PAID — stage_reservations ──────────────────────────────────────
create or replace function public.trg_stage_reservation_paid() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and (old.status is null or old.status <> 'paid') then
    perform public.fn_award_points(
      new.cavalier_id, 'booking_paid', 'stage_reservations', new.id::text, null
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_stage_reservation_paid on public.stage_reservations;
create trigger trg_stage_reservation_paid
  after update on public.stage_reservations
  for each row execute function public.trg_stage_reservation_paid();

-- ── BOOKING PAID — box_reservations ────────────────────────────────────────
create or replace function public.trg_box_reservation_paid() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and (old.status is null or old.status <> 'paid') then
    perform public.fn_award_points(
      new.buyer_id, 'booking_paid', 'box_reservations', new.id::text, null
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_box_reservation_paid on public.box_reservations;
create trigger trg_box_reservation_paid
  after update on public.box_reservations
  for each row execute function public.trg_box_reservation_paid();

-- ── BOOKING PAID — transport_reservations (colonne `statut` FR) ────────────
create or replace function public.trg_transport_reservation_paid() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut = 'paid' and (old.statut is null or old.statut <> 'paid') then
    perform public.fn_award_points(
      new.buyer_id, 'booking_paid', 'transport_reservations', new.id, null
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_transport_reservation_paid on public.transport_reservations;
create trigger trg_transport_reservation_paid
  after update on public.transport_reservations
  for each row execute function public.trg_transport_reservation_paid();

-- ── REVIEW GIVEN — avis ────────────────────────────────────────────────────
create or replace function public.trg_avis_inserted() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_award_points(
    new.auteur_id, 'review_given', 'avis', new.id::text, null
  );
  return new;
end $$;

drop trigger if exists trg_avis_inserted on public.avis;
create trigger trg_avis_inserted
  after insert on public.avis
  for each row execute function public.trg_avis_inserted();

-- ── COMMENT POSTED — com_posts_community ───────────────────────────────────
create or replace function public.trg_com_post_inserted() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_award_points(
    new.auteur_id, 'comment_posted', tg_table_name, new.id::text, null
  );
  return new;
end $$;

drop trigger if exists trg_com_post_inserted on public.com_posts_community;
create trigger trg_com_post_inserted
  after insert on public.com_posts_community
  for each row execute function public.trg_com_post_inserted();

drop trigger if exists trg_com_post_inserted on public.com_posts_coach;
create trigger trg_com_post_inserted
  after insert on public.com_posts_coach
  for each row execute function public.trg_com_post_inserted();

drop trigger if exists trg_com_post_inserted on public.com_posts_organisateur;
create trigger trg_com_post_inserted
  after insert on public.com_posts_organisateur
  for each row execute function public.trg_com_post_inserted();

-- ── POST PUBLISHED — posts_community/coach/organisateur ────────────────────
create or replace function public.trg_post_published() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_award_points(
    new.auteur_id, 'post_published', tg_table_name, new.id::text, null
  );
  return new;
end $$;

drop trigger if exists trg_post_published on public.posts_community;
create trigger trg_post_published
  after insert on public.posts_community
  for each row execute function public.trg_post_published();

drop trigger if exists trg_post_published on public.posts_coach;
create trigger trg_post_published
  after insert on public.posts_coach
  for each row execute function public.trg_post_published();

drop trigger if exists trg_post_published on public.posts_organisateur;
create trigger trg_post_published
  after insert on public.posts_organisateur
  for each row execute function public.trg_post_published();

-- ── LIKE RECEIVED — diff liked_by sur posts/com_posts ──────────────────────
-- Détecte les UUIDs ajoutés dans new.liked_by vs old.liked_by, award à l'auteur
-- pour chaque nouveau liker. Idempotent (unique(user_id, kind, ref, actor)).
create or replace function public.trg_likes_received() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_liker uuid;
  v_old   uuid[];
begin
  v_old := coalesce(old.liked_by, '{}'::uuid[]);
  for v_liker in
    select unnest(new.liked_by)
    except
    select unnest(v_old)
  loop
    perform public.fn_award_points(
      new.auteur_id, 'like_received', tg_table_name, new.id::text, v_liker
    );
  end loop;
  return new;
end $$;

drop trigger if exists trg_likes_received on public.posts_community;
create trigger trg_likes_received
  after update of liked_by on public.posts_community
  for each row when (new.liked_by is distinct from old.liked_by)
  execute function public.trg_likes_received();

drop trigger if exists trg_likes_received on public.posts_coach;
create trigger trg_likes_received
  after update of liked_by on public.posts_coach
  for each row when (new.liked_by is distinct from old.liked_by)
  execute function public.trg_likes_received();

drop trigger if exists trg_likes_received on public.posts_organisateur;
create trigger trg_likes_received
  after update of liked_by on public.posts_organisateur
  for each row when (new.liked_by is distinct from old.liked_by)
  execute function public.trg_likes_received();

drop trigger if exists trg_likes_received on public.com_posts_community;
create trigger trg_likes_received
  after update of liked_by on public.com_posts_community
  for each row when (new.liked_by is distinct from old.liked_by)
  execute function public.trg_likes_received();

drop trigger if exists trg_likes_received on public.com_posts_coach;
create trigger trg_likes_received
  after update of liked_by on public.com_posts_coach
  for each row when (new.liked_by is distinct from old.liked_by)
  execute function public.trg_likes_received();

drop trigger if exists trg_likes_received on public.com_posts_organisateur;
create trigger trg_likes_received
  after update of liked_by on public.com_posts_organisateur
  for each row when (new.liked_by is distinct from old.liked_by)
  execute function public.trg_likes_received();

-- ── PROFILE COMPLETED — users update ───────────────────────────────────────
-- Heuristique simple : prenom + nom + pseudo + region + disciplines>=1 + avatar
create or replace function public.fn_is_profile_complete(u public.users) returns boolean
language sql
immutable
as $$
  select coalesce(u.prenom, '')  <> ''
     and coalesce(u.nom, '')     <> ''
     and coalesce(u.pseudo, '')  <> ''
     and coalesce(u.region, '')  <> ''
     and coalesce(array_length(u.disciplines, 1), 0) >= 1
     and (coalesce(u.avatar_color, '') <> '' or coalesce(u.avatar_url, '') <> '');
$$;

create or replace function public.trg_profile_completed() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.profile_completed_at is null and public.fn_is_profile_complete(new) then
    new.profile_completed_at := now();
    -- award sera fait par AFTER trigger
  end if;
  return new;
end $$;

drop trigger if exists trg_profile_completed_set on public.users;
create trigger trg_profile_completed_set
  before update on public.users
  for each row execute function public.trg_profile_completed();

-- AFTER trigger pour award (security definer + accès aux nouvelles colonnes)
create or replace function public.trg_profile_completed_award() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.profile_completed_at is not null
     and (old.profile_completed_at is null) then
    perform public.fn_award_points(
      new.id, 'profile_completed', 'users', new.id::text, null
    );
  end if;
  return null;
end $$;

drop trigger if exists trg_profile_completed_award on public.users;
create trigger trg_profile_completed_award
  after update of profile_completed_at on public.users
  for each row execute function public.trg_profile_completed_award();

-- ─────────────────────────────────────────────────────────────────────────────
-- Note : le trigger BEFORE update ne couvre PAS le cas INSERT (signup).
-- Si on veut détecter le profil complet dès la création (cas extrême : signup
-- avec tous les champs), il faudra ajouter un trigger BEFORE INSERT identique.
-- Skippé pour l'instant : à l'inscription, pseudo/region/disciplines/avatar
-- sont rarement renseignés tous d'un coup.
-- ─────────────────────────────────────────────────────────────────────────────
