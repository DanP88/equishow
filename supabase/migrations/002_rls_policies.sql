-- ─────────────────────────────────────────────────────────────────────────────
-- Equishow — Migration 002 : RLS (Row Level Security)
-- Principe : deny by default.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.roles           enable row level security;
alter table public.user_consents   enable row level security;
alter table public.audit_logs      enable row level security;
alter table public.security_events enable row level security;

-- ── Helper admin ──────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and r.name = 'admin'
      and p.is_active = true
  );
$$;

-- ── profiles ──────────────────────────────────────────────────────────────────
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

-- ── roles ─────────────────────────────────────────────────────────────────────
create policy "roles_select_authenticated"
  on public.roles for select
  to authenticated
  using (true);

create policy "roles_all_admin"
  on public.roles for all
  using (public.is_admin());

-- ── user_consents ─────────────────────────────────────────────────────────────
create policy "consents_select_own"
  on public.user_consents for select
  using (user_id = auth.uid());

create policy "consents_insert_own"
  on public.user_consents for insert
  with check (user_id = auth.uid());

create policy "consents_update_own"
  on public.user_consents for update
  using (user_id = auth.uid());

create policy "consents_select_admin"
  on public.user_consents for select
  using (public.is_admin());

-- ── audit_logs ────────────────────────────────────────────────────────────────
create policy "audit_logs_select_admin"
  on public.audit_logs for select
  using (public.is_admin());

-- ── security_events ───────────────────────────────────────────────────────────
create policy "security_events_select_own"
  on public.security_events for select
  using (user_id = auth.uid());

create policy "security_events_select_admin"
  on public.security_events for select
  using (public.is_admin());
