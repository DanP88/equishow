-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 071 — Funnel de conversion (Lot 3)
--
-- Objectif : mesurer le parcours complet
--   open_listing → open_reserve → submit_reserve → open_checkout
--   → payment_success / payment_error
-- pour les 4 modules (box, transport, course=Coach, stage).
--
-- 100 % ADDITIVE, LECTURE SEULE : 3 vues, AUCUNE table, AUCUN trigger, AUCUNE
-- écriture. Ne touche pas Stripe / paiements / escrow / workflows réservation.
-- N'altère pas les analytics existantes : la vue legacy v_analytics_funnel_payment
-- (mig 022) reste en place (simplement plus consommée par le front après Lot 3).
--
-- Source = user_events (event_type='funnel_step', metadata.funnel='payment'),
-- alimentée par trackFunnel() côté front. Les paiements de BOOST coach
-- (boost-coach.tsx) ne sont PAS instrumentés → exclus par construction.
--
-- ARCHITECTURE DU COMPTAGE (validée) — deux dénominateurs, pivot reservation_id :
--   • HAUT de funnel (open_listing, open_reserve) = engagement, compté en
--     distinct (session_id, listing_id) : une session qui ouvre une annonce.
--   • submit_reserve = POINT DE JONCTION : un engagement devient UNE réservation.
--   • BAS de funnel (open_checkout, payment_success) = compté en distinct
--     reservation_id. INDISPENSABLE car le paiement coach/stage est DIFFÉRÉ
--     (après acceptation vendeur, souvent dans une autre session) → le session_id
--     ne relie pas submit→payment ; seul reservation_id le fait.
--
-- SÉCURITÉ : security_invoker=true → RLS admin de user_events (mig 022,
-- select admin-only) appliquée. Un non-admin ne lit rien via ces vues.
--
-- Application prod : JAMAIS `db push`. Appliquer par
--   supabase db query -f supabase/migrations/071_funnel_conversion_views.sql --linked
--   puis supabase migration repair --status applied 071
-- Rollback : voir bloc commenté en fin de fichier.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Base normalisée des events funnel ────────────────────────────────────────
create or replace view public.v_funnel_events
with (security_invoker = true) as
select
  id,
  user_id,
  session_id,
  action                                        as step,
  coalesce(nullif(metadata->>'module',''), '(unknown)') as module,
  metadata->>'listing_id'                       as listing_id,
  metadata->>'reservation_id'                   as reservation_id,
  metadata->>'seller_id'                        as seller_id,
  nullif(metadata->>'amount','')::bigint        as amount_cents,
  metadata->>'reason'                           as reason,
  created_at
from public.user_events
where event_type = 'funnel_step'
  and metadata->>'funnel' = 'payment'
  and action in (
    'open_listing','open_reserve','submit_reserve',
    'open_checkout','payment_success','payment_error'
  );

-- 2) Vue d'ensemble : volume, taux de passage, drop-off (30 derniers jours) ─────
create or replace view public.v_funnel_overview
with (security_invoker = true) as
with c as (
  select
    count(distinct case when step='open_listing'    then session_id || '|' || coalesce(listing_id,'') end) as ol_s,
    count(distinct case when step='open_reserve'     then session_id || '|' || coalesce(listing_id,'') end) as or_s,
    count(distinct case when step='submit_reserve'   then reservation_id end)                              as sr_r,
    count(distinct case when step='open_checkout'    then reservation_id end)                              as oc_r,
    count(distinct case when step='payment_success'  then reservation_id end)                              as ps_r,
    count(*) filter (where step='payment_error')                                                           as pe_count
  from public.v_funnel_events
  where created_at >= now() - interval '30 days'
)
select 1 as ord, 'open_listing'    as step, ol_s as volume, null::numeric as passage_rate,                            null::numeric as drop_off,                                 0::bigint as payment_error_count from c
union all
select 2,        'open_reserve',          or_s,       round(or_s::numeric / nullif(ol_s,0), 4),       round(1 - or_s::numeric / nullif(ol_s,0), 4),       0 from c
union all
select 3,        'submit_reserve',        sr_r,       round(sr_r::numeric / nullif(or_s,0), 4),       round(1 - sr_r::numeric / nullif(or_s,0), 4),       0 from c
union all
select 4,        'open_checkout',         oc_r,       round(oc_r::numeric / nullif(sr_r,0), 4),       round(1 - oc_r::numeric / nullif(sr_r,0), 4),       0 from c
union all
select 5,        'payment_success',       ps_r,       round(ps_r::numeric / nullif(oc_r,0), 4),       round(1 - ps_r::numeric / nullif(oc_r,0), 4),       pe_count from c
order by ord;

-- 3) Même funnel ventilé par module ───────────────────────────────────────────
create or replace view public.v_funnel_by_module
with (security_invoker = true) as
with c as (
  select
    module,
    count(distinct case when step='open_listing'    then session_id || '|' || coalesce(listing_id,'') end) as ol_s,
    count(distinct case when step='open_reserve'     then session_id || '|' || coalesce(listing_id,'') end) as or_s,
    count(distinct case when step='submit_reserve'   then reservation_id end)                              as sr_r,
    count(distinct case when step='open_checkout'    then reservation_id end)                              as oc_r,
    count(distinct case when step='payment_success'  then reservation_id end)                              as ps_r,
    count(*) filter (where step='payment_error')                                                           as pe_count
  from public.v_funnel_events
  where created_at >= now() - interval '30 days'
  group by module
)
select module, 1 as ord, 'open_listing'    as step, ol_s as volume, null::numeric as passage_rate,                      null::numeric as drop_off,                           0::bigint as payment_error_count from c
union all
select module, 2,        'open_reserve',          or_s, round(or_s::numeric / nullif(ol_s,0), 4), round(1 - or_s::numeric / nullif(ol_s,0), 4), 0 from c
union all
select module, 3,        'submit_reserve',        sr_r, round(sr_r::numeric / nullif(or_s,0), 4), round(1 - sr_r::numeric / nullif(or_s,0), 4), 0 from c
union all
select module, 4,        'open_checkout',         oc_r, round(oc_r::numeric / nullif(sr_r,0), 4), round(1 - oc_r::numeric / nullif(sr_r,0), 4), 0 from c
union all
select module, 5,        'payment_success',       ps_r, round(ps_r::numeric / nullif(oc_r,0), 4), round(1 - ps_r::numeric / nullif(oc_r,0), 4), pe_count from c
order by module, ord;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (manuel si besoin) :
--   drop view if exists public.v_funnel_by_module;
--   drop view if exists public.v_funnel_overview;
--   drop view if exists public.v_funnel_events;
-- ─────────────────────────────────────────────────────────────────────────────
