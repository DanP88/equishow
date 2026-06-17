-- Rollback 080 — restaure fn_org_concours_radar dans sa version 077 (sans les
-- blocs LOT 2 reservations/module + revenue). Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.fn_org_concours_radar(p_concours_id uuid, p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  select count(*), count(*) filter (where created_at >= v_since)
  into v_followers, v_followers_new
  from public.concours_followers where concours_id = p_concours_id;

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
$function$;
