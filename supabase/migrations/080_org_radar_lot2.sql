-- ─────────────────────────────────────────────────────────────────────────────
-- 080 — Organisateur V2 LOT 2 : Radar de pilotage (réservations/module + CA).
--
-- Étend fn_org_concours_radar (CREATE OR REPLACE, ADDITIF) avec :
--   • reservations.{box,transport,coach,stage,total}  → comptes de réservations
--     (lignes, hors statuts annulés) — BRUTS (données du concours, non nominatives)
--   • reservations.cavaliers_distinct                 → = ancien v_engaged, masqué <5
--   • revenue.{gmv_eur, commission_eur, paid_reservations} → CA depuis payments
--     (payment_status='succeeded'), masqué si paid_reservations < 5
--   • funnel.reservations_total + funnel.paid          → étapes paiement
--
-- CONSERVE : fn_org_owns_concours (gate 42501), masquage RGPD <5 sur personnes,
-- toutes les clés existantes (visibility/interest/engagement/funnel). Aucune clé
-- retirée → 100% rétro-compatible avec le front actuel.
--
-- Lecture seule sur les tables métier ; aucune donnée modifiée.
-- Appliqué prod via `db query -f` + `migration repair --status applied 080`, jamais db push.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_res_box int; v_res_transport int; v_res_coach int; v_res_stage int; v_res_total int;
  v_gmv bigint; v_fee bigint; v_paid int;
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

  -- KPI 3 — AFFLUENCE PROBABLE (cavaliers DISTINCTS engagés sur ≥1 service).
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

  -- KPI 3bis (LOT 2) — RÉSERVATIONS PAR MODULE (lignes, hors statuts annulés).
  select count(*) into v_res_box
    from public.box_reservations br join public.box_annonces ba on ba.id = br.box_id
    where ba.concours_id = p_concours_id and not (br.status = any(exclude_statuses));
  select count(*) into v_res_transport
    from public.transport_reservations tr join public.transport_annonces ta on ta.id = tr.transport_id
    where ta.concours_id = p_concours_id and not (tr.statut = any(exclude_statuses));
  select count(*) into v_res_coach
    from public.course_demands cd join public.coach_annonces ca on ca.id = cd.annonce_id
    where ca.concours_id = p_concours_id and not (cd.status = any(exclude_statuses));
  select count(*) into v_res_stage
    from public.stage_reservations sr join public.stages st on st.id = sr.stage_id
    where st.concours_id = p_concours_id and not (sr.status = any(exclude_statuses));
  v_res_total := coalesce(v_res_box,0) + coalesce(v_res_transport,0)
               + coalesce(v_res_coach,0) + coalesce(v_res_stage,0);

  -- KPI 5 (LOT 2) — CA GÉNÉRÉ (payments succeeded rattachés au concours via les FK
  -- de réservation → annonce/stage.concours_id). amount_* en CENTIMES.
  select
    coalesce(sum(p.amount_buyer_ttc),0),
    coalesce(sum(p.amount_platform_fee),0),
    count(*)
  into v_gmv, v_fee, v_paid
  from public.payments p
  where p.payment_status = 'succeeded'
    and (
      p.box_reservation_id in (
        select br.id from public.box_reservations br
        join public.box_annonces ba on ba.id = br.box_id where ba.concours_id = p_concours_id)
      or p.transport_reservation_id in (
        select tr.id from public.transport_reservations tr
        join public.transport_annonces ta on ta.id = tr.transport_id where ta.concours_id = p_concours_id)
      or p.course_demand_id in (
        select cd.id from public.course_demands cd
        join public.coach_annonces ca on ca.id = cd.annonce_id where ca.concours_id = p_concours_id)
      or p.stage_reservation_id in (
        select sr.id from public.stage_reservations sr
        join public.stages st on st.id = sr.stage_id where st.concours_id = p_concours_id)
    );

  -- KPI 4 — FUNNEL + nouveaux blocs (réservations/module + revenue).
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
    'reservations', jsonb_build_object(
      'box', coalesce(v_res_box,0),
      'transport', coalesce(v_res_transport,0),
      'coach', coalesce(v_res_coach,0),
      'stage', coalesce(v_res_stage,0),
      'total', coalesce(v_res_total,0),
      'cavaliers_distinct', case when coalesce(v_engaged,0) < 5 then null else v_engaged end,
      'cavaliers_distinct_masked', coalesce(v_engaged,0) < 5
    ),
    'revenue', jsonb_build_object(
      'gmv_eur', case when coalesce(v_paid,0) < 5 then null else round(coalesce(v_gmv,0)::numeric / 100, 2) end,
      'commission_eur', case when coalesce(v_paid,0) < 5 then null else round(coalesce(v_fee,0)::numeric / 100, 2) end,
      'paid_reservations', coalesce(v_paid,0),
      'masked', coalesce(v_paid,0) < 5
    ),
    'funnel', jsonb_build_object(
      'views', coalesce(v_views,0),
      'followers', coalesce(v_followers,0),
      'reservations', coalesce(v_engaged,0),
      'reservations_total', coalesce(v_res_total,0),
      'paid', coalesce(v_paid,0),
      'views_to_followers',        case when coalesce(v_views,0)     > 0 then round(coalesce(v_followers,0)::numeric / v_views, 4) else null end,
      'followers_to_reservations', case when coalesce(v_followers,0) > 0 then round(coalesce(v_engaged,0)::numeric  / v_followers, 4) else null end,
      'views_to_reservations',     case when coalesce(v_views,0)     > 0 then round(coalesce(v_engaged,0)::numeric  / v_views, 4) else null end
    )
  );
end;
$function$;
