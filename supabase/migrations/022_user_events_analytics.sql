-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 022 — Analytics maison (user_events)
--
-- Objectif : tracker pageviews, durée par écran, clics CTAs, étapes funnel,
-- erreurs UI — pour dashboard admin natif.
--
-- Design :
-- - 1 ligne par event (granularité fine, agrégation en SQL côté admin)
-- - `session_id` côté front (uuid persistant en localStorage / mémoire) →
--   permet de tracker visiteurs anon + chaîner les events d'une session
-- - `metadata jsonb` libre pour extensibilité (variant, props, etc.)
-- - INSERT autorisé pour tout authentifié sur ses propres events. Anonymes
--   non supportés (RLS Supabase n'a pas de rôle `anon` par défaut sur les
--   tables custom ; on insère un user_id null pour les non-auth via service
--   key côté Edge si besoin futur).
-- - SELECT réservé aux admins (PII potentiellement présent dans metadata).
-- - Pas d'UPDATE/DELETE : intégrité audit.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  session_id  text not null,
  event_type  text not null check (event_type in (
                'page_view','page_leave','cta_click','funnel_step','error','custom'
              )),
  screen      text,
  action      text,
  duration_ms integer,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_user_events_created_at  on public.user_events(created_at desc);
create index if not exists idx_user_events_user_id     on public.user_events(user_id);
create index if not exists idx_user_events_screen      on public.user_events(screen, created_at desc);
create index if not exists idx_user_events_session     on public.user_events(session_id, created_at);
create index if not exists idx_user_events_event_type  on public.user_events(event_type, created_at desc);

alter table public.user_events enable row level security;

-- INSERT : un utilisateur authentifié peut insérer ses propres events
-- (user_id = auth.uid()). user_id null autorisé pour permettre tracking
-- pré-auth ; le session_id assure le chaînage.
create policy "user_events_insert_self" on public.user_events
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

-- SELECT : admin uniquement (PII)
create policy "user_events_select_admin" on public.user_events
  for select to authenticated
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid() and users.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Vues d'agrégation (lectures admin uniquement, RLS hérité)
-- ─────────────────────────────────────────────────────────────────────────────

-- KPIs globaux 7 derniers jours
create or replace view public.v_analytics_kpi_7d as
select
  count(*) filter (where event_type = 'page_view')                                as pageviews_7d,
  count(distinct user_id) filter (where user_id is not null)                      as dau_7d,
  count(distinct session_id)                                                      as sessions_7d,
  count(*) filter (where event_type = 'cta_click')                                as cta_clicks_7d,
  count(*) filter (where event_type = 'error')                                    as errors_7d,
  round(avg(duration_ms) filter (where event_type = 'page_leave' and duration_ms > 0)::numeric / 1000, 1)
                                                                                  as avg_session_seconds
from public.user_events
where created_at >= now() - interval '7 days';

-- Top écrans (pageviews + durée moyenne)
create or replace view public.v_analytics_top_screens as
select
  screen,
  count(*) filter (where event_type = 'page_view')                                as views,
  count(distinct user_id) filter (where event_type = 'page_view')                 as unique_users,
  round(avg(duration_ms) filter (where event_type = 'page_leave' and duration_ms > 0)::numeric / 1000, 1)
                                                                                  as avg_duration_seconds
from public.user_events
where created_at >= now() - interval '30 days' and screen is not null
group by screen
order by views desc;

-- Top CTAs cliqués
create or replace view public.v_analytics_top_ctas as
select
  screen,
  action,
  count(*) as clicks,
  count(distinct user_id) as unique_users
from public.user_events
where event_type = 'cta_click'
  and created_at >= now() - interval '30 days'
group by screen, action
order by clicks desc;

-- Funnel paiement (compte par étape pour les 30 derniers jours)
create or replace view public.v_analytics_funnel_payment as
select
  action,
  count(*) as steps,
  count(distinct user_id) as unique_users,
  count(distinct session_id) as unique_sessions
from public.user_events
where event_type = 'funnel_step'
  and metadata->>'funnel' = 'payment'
  and created_at >= now() - interval '30 days'
group by action
order by
  case action
    when 'open_listing'   then 1
    when 'open_reserve'   then 2
    when 'submit_reserve' then 3
    when 'open_checkout'  then 4
    when 'payment_success' then 5
    when 'payment_error'  then 99
    else 50
  end;

-- Erreurs récentes (50 dernières)
create or replace view public.v_analytics_recent_errors as
select
  id, user_id, screen, action, metadata, created_at
from public.user_events
where event_type = 'error'
order by created_at desc
limit 50;

-- Sessions actives dernière heure
create or replace view public.v_analytics_active_sessions as
select count(distinct session_id) as active_sessions_1h
from public.user_events
where created_at >= now() - interval '1 hour';
