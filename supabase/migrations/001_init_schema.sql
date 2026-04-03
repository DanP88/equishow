-- ─────────────────────────────────────────────────────────────────────────────
-- Equishow — Migration 001 : Schéma initial
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ── roles ─────────────────────────────────────────────────────────────────────
create table if not exists public.roles (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null unique,  -- cavalier | proprietaire | entraineur | admin
  description text,
  created_at  timestamptz not null default now()
);

insert into public.roles (name, description) values
  ('cavalier',     'Cavalier de concours'),
  ('proprietaire', 'Propriétaire de chevaux'),
  ('entraineur',   'Entraîneur / Moniteur'),
  ('admin',        'Administrateur de l''application')
on conflict (name) do nothing;

-- ── profiles (étend auth.users) ───────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  full_name    text,
  phone        text,
  club_name    text,
  ffe_number   text,                   -- Numéro de licence FFE
  role_id      uuid        references public.roles(id) on delete set null,
  avatar_url   text,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── user_consents (RGPD) ──────────────────────────────────────────────────────
create table if not exists public.user_consents (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  consent_type     text        not null,  -- rgpd_analytics | marketing | terms_of_service
  accepted         boolean     not null,
  accepted_at      timestamptz not null default now(),
  ip_hash          text,
  user_agent_hash  text,
  consent_version  text        not null default '1.0',
  created_at       timestamptz not null default now(),
  unique(user_id, consent_type)
);

-- ── audit_logs ────────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete set null,
  action       text        not null,      -- CREATE | UPDATE | DELETE | VIEW
  resource     text        not null,
  resource_id  uuid,
  old_data     jsonb,
  new_data     jsonb,
  ip_hash      text,
  created_at   timestamptz not null default now()
);

create index idx_audit_logs_user_id    on public.audit_logs(user_id);
create index idx_audit_logs_resource   on public.audit_logs(resource, resource_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- ── security_events ───────────────────────────────────────────────────────────
create table if not exists public.security_events (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete set null,
  event_type  text        not null,
  severity    text        not null default 'info',  -- info | warning | critical
  metadata    jsonb,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index idx_security_events_user_id    on public.security_events(user_id);
create index idx_security_events_event_type on public.security_events(event_type);
create index idx_security_events_severity   on public.security_events(severity)
  where severity in ('warning', 'critical');
create index idx_security_events_created_at on public.security_events(created_at desc);

-- ── Trigger : création automatique du profil à l'inscription ─────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
