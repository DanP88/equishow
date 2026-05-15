-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 024 — Table coach_profiles (P24 phase 4)
--
-- Avant : les profils coach étaient mock (coachesStore + mockCoachs.ts).
-- Cette table étend public.users avec les champs spécifiques au rôle coach
-- (bio, disciplines, tarif horaire, etc.) sans polluer la table users core.
--
-- 1-1 avec users.id (un user peut avoir un seul profil coach).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.coach_profiles (
  user_id      uuid primary key references public.users(id) on delete cascade,
  bio          text,
  disciplines  text[] not null default '{}'::text[],
  niveaux      text[] not null default '{}'::text[],
  specialites  text[] not null default '{}'::text[],
  region       text,
  tarif_heure  numeric(10,2),
  disponible   boolean not null default true,
  photo_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_coach_profiles_disciplines on public.coach_profiles using gin (disciplines);
create index if not exists idx_coach_profiles_region      on public.coach_profiles (region);

alter table public.coach_profiles enable row level security;

-- SELECT : tout authentifié peut voir tous les profils coach (marketplace).
create policy "coach_profiles_select_authenticated" on public.coach_profiles
  for select to authenticated using (true);

-- INSERT/UPDATE/DELETE : un user gère uniquement son propre profil
-- (defense in depth IDOR — RLS strict).
create policy "coach_profiles_insert_self" on public.coach_profiles
  for insert to authenticated with check (user_id = auth.uid());

create policy "coach_profiles_update_self" on public.coach_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "coach_profiles_delete_self" on public.coach_profiles
  for delete to authenticated using (user_id = auth.uid());

create trigger trg_coach_profiles_updated_at
  before update on public.coach_profiles
  for each row execute function public.set_updated_at();

comment on table public.coach_profiles is
  'Profil étendu pour les users de rôle coach (bio, disciplines, tarif, etc.). 1-1 avec users.id.';
