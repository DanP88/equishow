-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback 103 — Restauration de public.roles et public.profiles
--
-- Ce rollback recrée exactement les structures observées en production
-- au 2026-07-29, avant la migration 103.
--
-- Il restaure :
--   • public.roles  : colonnes, PK, UNIQUE(name), 4 lignes de référence,
--                     RLS, policy, grants
--   • public.profiles : colonnes, PK, FK auth.users (CASCADE), FK roles (SET NULL),
--                       RLS, 3 policies, trigger, grants table + colonne
--
-- IMPORTANT : Ce rollback restaure des STRUCTURES, pas des données métier.
--   Les 6 lignes qui existaient dans profiles avaient toutes leurs colonnes
--   métier à NULL (voir audit 2026-07-29). Elles ne sont pas recréées
--   car elles n'ont aucune valeur opérationnelle.
--
-- Si ce rollback est joué, relire l'audit mig 094 (verrou role_id) pour
-- vérifier que les constraints de sécurité colonne sont bien restaurées.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Recréer public.roles ───────────────────────────────────────────────────
create table public.roles (
  id          uuid        not null default gen_random_uuid(),
  name        text        not null,
  description text,
  created_at  timestamptz not null default now(),
  constraint roles_pkey     primary key (id),
  constraint roles_name_key unique (name)
);

-- 4 lignes de référence (UUIDs exacts tels qu'observés en prod 2026-07-29)
insert into public.roles (id, name, description) values
  ('15ca63df-cba3-41c5-a448-0ade7cb84981', 'cavalier',     'Cavalier de concours'),
  ('730ce28f-f71c-4740-a6f2-3c8a945b0818', 'admin',        'Administrateur de l''application'),
  ('8b349da2-a74d-40e7-a57b-5cfe4b75195a', 'entraineur',   'Entraîneur / Moniteur'),
  ('90c3d27a-f762-4774-92d9-ba3081bbcf98', 'proprietaire', 'Propriétaire de chevaux');

alter table public.roles enable row level security;

create policy roles_select_authenticated
  on public.roles for select
  to authenticated using (true);

-- Grants (état prod 2026-07-29)
grant select                         on public.roles to anon;
grant select, insert, update, delete on public.roles to authenticated;
grant all                            on public.roles to service_role;

-- ── 2. Recréer public.profiles ────────────────────────────────────────────────
create table public.profiles (
  id          uuid        not null,
  full_name   text,
  phone       text,
  club_name   text,
  ffe_number  text,
  role_id     uuid,
  avatar_url  text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_pkey        primary key (id),
  -- FK vers auth.users : ON DELETE CASCADE (supprime le profil si l'utilisateur est supprimé)
  constraint profiles_id_fkey     foreign key (id)      references auth.users(id)   on delete cascade,
  -- FK vers roles : ON DELETE SET NULL (role_id → NULL si le rôle est supprimé)
  constraint profiles_role_id_fkey foreign key (role_id) references public.roles(id) on delete set null
);

alter table public.profiles enable row level security;

-- Policies (état prod 2026-07-29 — 3 policies own-row)
create policy profiles_select_own
  on public.profiles for select
  to authenticated using (id = auth.uid());

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated with check (id = auth.uid());

create policy profiles_update_own
  on public.profiles for update
  to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Trigger (updated_at automatique — fonction générique set_updated_at)
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── Grants table-niveau (état post-mig094, 2026-07-29) ────────────────────────
-- anon     : SELECT uniquement
-- authenticated : SELECT + DELETE (le reste est géré par les grants colonne ci-dessous)
-- service_role  : tout
grant select                 on public.profiles to anon;
grant select, delete         on public.profiles to authenticated;
grant all                    on public.profiles to service_role;

-- ── Grants colonne-niveau (restauration de l'état post-mig094) ────────────────
-- Colonnes librement modifiables par authenticated (hors colonnes sensibles)
grant insert, update (full_name, phone, club_name, ffe_number, avatar_url, is_active)
  on public.profiles to authenticated;

-- id : INSERT seulement (pas UPDATE — mig 094 a révoqué UPDATE sur id)
grant insert (id) on public.profiles to authenticated;

-- role_id : SELECT seulement (INSERT et UPDATE révoqués par mig 094)
-- (le grant SELECT sur role_id est déjà couvert par le grant table-niveau SELECT)

-- created_at, updated_at : pas d'INSERT/UPDATE pour authenticated (géré par defaults/trigger)
