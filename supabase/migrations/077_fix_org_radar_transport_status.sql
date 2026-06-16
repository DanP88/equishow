-- ============================================================================
-- 077 — FIX fn_org_concours_radar : transport_reservations.status → .statut
-- ============================================================================
-- Bug prod (Radar planté) : « column tr.status does not exist ».
-- Diagnostic schéma réel :
--   box_reservations    → status   (anglais : paid, cancelled, …)
--   course_demands      → status
--   stage_reservations  → status
--   transport_reservations → PAS de `status` ; colonne réelle = `statut`
--                            (valeurs anglaises identiques : paid, cancelled, …).
-- Seule la sous-requête transport référençait `tr.status` (inexistant) → la
-- fonction entière échouait. Correctif = `tr.statut`. Le tableau d'exclusion
-- {cancelled,rejected,expired,payment_expired} reste valable.
--
-- 100 % ADDITIF : CREATE OR REPLACE d'une seule fonction. Aucune donnée touchée,
-- aucune signature/permission modifiée (grants 076 conservés). Dépend de 076.
--
-- Application : supabase db query -f supabase/migrations/077_*.sql --linked
--               puis supabase migration repair --status applied 077 --linked. JAMAIS db push.
-- Rollback : 077_fix_org_radar_transport_status_rollback.sql (restaure la def 076 buguée).
-- ============================================================================

begin;

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
  -- ⚠️ transport_reservations utilise `statut` (pas `status`).
  select count(distinct buyer) into v_engaged from (
    select br.buyer_id as buyer
      from public.box_reservations br join public.box_annonces ba on ba.id = br.box_id
      where ba.concours_id = p_concours_id and not (br.status = any(exclude_statuses))
    union
    select tr.buyer_id
      from public.transport_reservations tr join public.transport_annonces ta on ta.id = tr.transport_id
      where ta.concours_id = p_concours_id and not (tr.statut = any(exclude_statuses))
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

-- ── PARTIE 2 — NOTIFICATION ADMIN À LA CRÉATION D'UNE REVENDICATION ──────────
-- L'organisateur ne peut pas lister les admins (RLS users) → le fan-out doit
-- être server-side. Trigger AFTER INSERT (pattern 065 support_requests) : 1 notif
-- par admin. Réutilise la table `notifications` (aucune nouvelle infra) + type
-- 'reservation_request' (déjà autorisé par notifications_type_check, rendu plein
-- titre/message). 100 % additif.
create or replace function public.fn_concours_claim_notify_admins()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  insert into public.notifications
    (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
  select
    u.id,
    new.organisateur_id,
    'reservation_request',
    '🏆 Nouvelle revendication de concours',
    'Un organisateur demande à revendiquer le concours « '
      || coalesce(nullif(btrim(new.concours_nom), ''), 'concours') || ' ».',
    '/admin-concours-claims',
    '/admin-concours-claims',
    jsonb_build_object('claim_id', new.id, 'concours_id', new.concours_id, 'kind', 'concours_claim_new')
  from public.users u
  where u.role = 'admin';
  return new;
end;
$$;

drop trigger if exists trg_zz_concours_claim_notify_admins on public.concours_claims;
create trigger trg_zz_concours_claim_notify_admins
  after insert on public.concours_claims
  for each row execute function public.fn_concours_claim_notify_admins();

commit;
