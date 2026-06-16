-- ============================================================================
-- 076 — ESPACE ORGANISATEUR · P0 : CLAIM CONCOURS + RADAR DE DEMANDE
-- ============================================================================
-- Périmètre :
--   PARTIE 1 — table `concours_claims` (revendication d'un concours par un org,
--              validée par admin) + RLS + index + trigger de revue.
--   PARTIE 2 — fonctions SECURITY DEFINER pour le « Radar de demande »
--              (agrégats RÉELS, gardés par ownership, masquage RGPD < 5).
--
-- 100 % ADDITIF. Ne touche NI payments, NI reservations, NI escrow, NI Stripe,
-- NI webhooks, NI les RLS existantes. Dépend de 074 (concours + concours_id) et
-- 075 (concours_followers). Aucune écriture sur concours.organisateur_id (sa FK
-- pointe vers `profiles` partiel → l'ownership vit dans concours_claims).
--
-- ADMIN = `users.role = 'admin'` (signal réellement fiable, cohérent avec la RLS
-- de user_events 022 et le bottom bar admin). On n'utilise PAS is_admin() qui
-- dépend de la table `profiles` (partielle : 6/14 users).
--
-- Application : supabase db query -f supabase/migrations/076_*.sql --linked
--               puis supabase migration repair --status applied 076. JAMAIS db push.
-- Rollback : 076_org_concours_claim_radar_rollback.sql
-- ============================================================================

begin;

-- ── PARTIE 1 — CLAIM ─────────────────────────────────────────────────────────
create table if not exists public.concours_claims (
  id               uuid primary key default gen_random_uuid(),
  concours_id      uuid not null references public.concours(id) on delete cascade,
  organisateur_id  uuid not null references public.users(id)    on delete cascade,
  status           text not null default 'pending'
                     check (status in ('pending','approved','rejected')),
  justification    text,
  -- Snapshots dénormalisés pour l'écran admin SANS lecture cross-table (la RLS
  -- de users empêche l'admin de lire les noms ; on les fige à la création).
  organisateur_nom text,
  concours_nom     text,
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid references public.users(id) on delete set null
);

comment on table public.concours_claims is
  'P0 076 — revendication d''un concours par un organisateur (validation admin). Ownership = ligne status=approved.';

create index if not exists idx_concours_claims_concours on public.concours_claims(concours_id);
create index if not exists idx_concours_claims_org      on public.concours_claims(organisateur_id);
create index if not exists idx_concours_claims_status   on public.concours_claims(status);

-- Un seul propriétaire (claim approuvé) par concours.
create unique index if not exists ux_concours_claims_one_approved
  on public.concours_claims(concours_id) where status = 'approved';
-- Anti-doublon : une seule demande pending par (concours, org).
create unique index if not exists ux_concours_claims_one_pending_per_org
  on public.concours_claims(concours_id, organisateur_id) where status = 'pending';

-- Trigger : horodate la revue quand l'admin sort du statut pending.
create or replace function public.tg_concours_claims_review()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and old.status = 'pending' then
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_concours_claims_review on public.concours_claims;
create trigger trg_concours_claims_review
  before update on public.concours_claims
  for each row execute function public.tg_concours_claims_review();

-- RLS
alter table public.concours_claims enable row level security;

drop policy if exists cc_insert_own on public.concours_claims;
create policy cc_insert_own on public.concours_claims
  for insert to authenticated
  with check (organisateur_id = auth.uid() and status = 'pending');

drop policy if exists cc_select_own_or_admin on public.concours_claims;
create policy cc_select_own_or_admin on public.concours_claims
  for select to authenticated
  using (
    organisateur_id = auth.uid()
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- Revue = admin uniquement (approve/reject). Pas de DELETE (audit).
drop policy if exists cc_update_admin on public.concours_claims;
create policy cc_update_admin on public.concours_claims
  for update to authenticated
  using      (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- ── PARTIE 2 — RADAR (lecture agrégée, gardée) ───────────────────────────────
-- Ownership : claim approuvé par l'appelant (ou admin).
create or replace function public.fn_org_owns_concours(p_concours_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.concours_claims
    where concours_id = p_concours_id
      and organisateur_id = auth.uid()
      and status = 'approved'
  ) or exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
  );
$$;

-- Radar de demande : tous les KPI en un seul appel, agrégats RÉELS uniquement.
-- Masquage RGPD : tout compteur de PERSONNES < 5 → null + flag *_masked.
-- SECURITY DEFINER : contourne la RLS pour AGRÉGER (jamais de ligne brute /
-- d'identité renvoyée), après contrôle d'ownership strict.
create or replace function public.fn_org_concours_radar(p_concours_id uuid, p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_since      timestamptz := now() - (greatest(p_days,1) || ' days')::interval;
  v_prev_since timestamptz := now() - (2 * greatest(p_days,1) || ' days')::interval;
  v_views int; v_unique int; v_ffe int; v_views_prev int;
  v_followers int; v_followers_new int;
  v_engaged int;
  exclude_statuses text[] := array['cancelled','rejected','expired','payment_expired'];
begin
  if not public.fn_org_owns_concours(p_concours_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- KPI 1 — VISIBILITÉ (events attribués via metadata->>'concours_id')
  select
    count(*)                       filter (where event_type = 'page_view'),
    count(distinct user_id)        filter (where event_type = 'page_view' and user_id is not null),
    count(*)                       filter (where event_type = 'cta_click' and action = 'click_ffe')
  into v_views, v_unique, v_ffe
  from public.user_events
  where metadata->>'concours_id' = p_concours_id::text
    and created_at >= v_since;

  select count(*) filter (where event_type = 'page_view')
  into v_views_prev
  from public.user_events
  where metadata->>'concours_id' = p_concours_id::text
    and created_at >= v_prev_since and created_at < v_since;

  -- KPI 2 — INTÉRÊT
  select count(*), count(*) filter (where created_at >= v_since)
  into v_followers, v_followers_new
  from public.concours_followers where concours_id = p_concours_id;

  -- KPI 3 — AFFLUENCE PROBABLE (cavaliers DISTINCTS engagés sur ≥1 service)
  select count(distinct buyer) into v_engaged from (
    select br.buyer_id as buyer
      from public.box_reservations br join public.box_annonces ba on ba.id = br.box_id
      where ba.concours_id = p_concours_id and not (br.status = any(exclude_statuses))
    union
    select tr.buyer_id
      from public.transport_reservations tr join public.transport_annonces ta on ta.id = tr.transport_id
      where ta.concours_id = p_concours_id and not (tr.status = any(exclude_statuses))
    union
    select cd.cavalier_id
      from public.course_demands cd join public.coach_annonces ca on ca.id = cd.annonce_id
      where ca.concours_id = p_concours_id and not (cd.status = any(exclude_statuses))
    union
    select sr.cavalier_id
      from public.stage_reservations sr join public.stages st on st.id = sr.stage_id
      where st.concours_id = p_concours_id and not (sr.status = any(exclude_statuses))
  ) q where buyer is not null;

  -- KPI 4 — FUNNEL (vues → followers → réservations), taux réels
  return jsonb_build_object(
    'days', greatest(p_days,1),
    'visibility', jsonb_build_object(
      'views', coalesce(v_views,0),
      'views_prev', coalesce(v_views_prev,0),
      'unique_visitors', case when coalesce(v_unique,0) < 5 then null else v_unique end,
      'unique_visitors_masked', coalesce(v_unique,0) < 5,
      'ffe_clicks', coalesce(v_ffe,0)
    ),
    'interest', jsonb_build_object(
      'followers', coalesce(v_followers,0),
      'followers_new', coalesce(v_followers_new,0),
      'followers_masked', coalesce(v_followers,0) < 5
    ),
    'engagement', jsonb_build_object(
      'cavaliers_engaged', case when coalesce(v_engaged,0) < 5 then null else v_engaged end,
      'cavaliers_engaged_raw_lt5', coalesce(v_engaged,0) < 5,
      'masked', coalesce(v_engaged,0) < 5
    ),
    'funnel', jsonb_build_object(
      'views', coalesce(v_views,0),
      'followers', coalesce(v_followers,0),
      'reservations', coalesce(v_engaged,0),
      'views_to_followers',        case when coalesce(v_views,0)     > 0 then round(coalesce(v_followers,0)::numeric / v_views, 4) else null end,
      'followers_to_reservations', case when coalesce(v_followers,0) > 0 then round(coalesce(v_engaged,0)::numeric  / v_followers, 4) else null end,
      'views_to_reservations',     case when coalesce(v_views,0)     > 0 then round(coalesce(v_engaged,0)::numeric  / v_views, 4) else null end
    )
  );
end;
$$;

revoke all on function public.fn_org_concours_radar(uuid, int) from public;
grant execute on function public.fn_org_concours_radar(uuid, int) to authenticated;
revoke all on function public.fn_org_owns_concours(uuid) from public;
grant execute on function public.fn_org_owns_concours(uuid) to authenticated;

commit;

-- ============================================================================
-- NOTES
-- - Aucune ligne brute / identité de cavalier n'est jamais renvoyée : seulement
--   des agrégats. Tout compteur de personnes < 5 est masqué (null + flag).
-- - L'ownership est vérifié AVANT toute agrégation (raise 42501 sinon).
-- - KPI « clics FFE » dépend de l'event cta_click action='click_ffe' à brancher
--   sur le bouton FFE de la fiche (front) ; vaut 0 tant que non émis (pas faux,
--   juste absent — no-fake-KPI respecté).
-- ============================================================================
