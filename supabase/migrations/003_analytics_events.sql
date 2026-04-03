-- ─────────────────────────────────────────────────────────────────────────────
-- Equishow — Migration 003 : Analytics & Activity
-- ─────────────────────────────────────────────────────────────────────────────

-- ── analytics_events ─────────────────────────────────────────────────────────
create table if not exists public.analytics_events (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users(id) on delete set null,
  session_id     uuid        not null,
  event_name     text        not null,
  event_category text        not null,  -- navigation | interaction | conversion | error
  properties     jsonb,
  platform       text        not null,  -- flutter_android | flutter_ios | flutter_web
  app_version    text,
  created_at     timestamptz not null default now()
);

create index idx_analytics_user_id    on public.analytics_events(user_id);
create index idx_analytics_event_name on public.analytics_events(event_name);
create index idx_analytics_category   on public.analytics_events(event_category);
create index idx_analytics_created_at on public.analytics_events(created_at desc);

-- ── activity_logs ─────────────────────────────────────────────────────────────
create table if not exists public.activity_logs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  action      text        not null,
  -- cheval_added | concours_entered | reservation_created | abonnement_souscrit
  resource    text,
  resource_id uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index idx_activity_logs_user_id    on public.activity_logs(user_id);
create index idx_activity_logs_action     on public.activity_logs(action);
create index idx_activity_logs_created_at on public.activity_logs(created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.analytics_events enable row level security;
alter table public.activity_logs    enable row level security;

create policy "analytics_select_admin"
  on public.analytics_events for select
  using (public.is_admin());

create policy "analytics_insert_own"
  on public.analytics_events for insert
  with check (user_id = auth.uid() or user_id is null);

create policy "activity_logs_select_own"
  on public.activity_logs for select
  using (user_id = auth.uid());

create policy "activity_logs_insert_own"
  on public.activity_logs for insert
  with check (user_id = auth.uid());

create policy "activity_logs_select_admin"
  on public.activity_logs for select
  using (public.is_admin());
