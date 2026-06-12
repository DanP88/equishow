-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 070 — Marketplace Analytics (Lot 2)
--
-- Objectif : exposer la santé business de la marketplace (revenus, réservations,
-- paiements, vendeurs, escrow, litiges) au dashboard admin-analytics.
--
-- 100 % ADDITIVE, LECTURE SEULE :
--   - 7 vues d'agrégation, AUCUNE nouvelle table, AUCUN trigger, AUCUNE écriture.
--   - Ne touche pas aux workflows réservation / paiement / Stripe / escrow.
--
-- Source financière UNIQUE = public.payments (montants en CENTIMES, integer).
--   On n'utilise JAMAIS les montants des tables de réservation (doublon, et
--   transport diverge : statut FR / FK profiles / id text). Le comptage par
--   module se fait via payments.type (uniforme : course|stage|transport|box).
--
-- Décisions produit validées :
--   - GMV brut  = ventes capturées (succeeded + refunded) ; GMV net = succeeded ;
--     remboursé = refunded. (net = brut − remboursé, par construction.)
--   - Fonds séquestrés / libérés / en attente = amount_seller_ht (dû vendeur).
--   - "En attente de libération" = transfer_state='held' ET release_due_at<=now().
--
-- SÉCURITÉ : toutes les vues en `security_invoker = true` → la RLS de l'admin
-- connecté s'applique aux tables sous-jacentes (payments / payment_disputes :
-- is_app_admin() mig 044 ; users : users_admin_all mig 005). Un non-admin ne lit
-- rien via ces vues. PAS de bypass RLS (contrairement à une vue standard).
--
-- Application prod (règle projet) : JAMAIS `db push`. Appliquer par
--   supabase db query -f supabase/migrations/070_marketplace_analytics_views.sql
--   puis  supabase migration repair --status applied 070
-- Rollback : voir bloc commenté en fin de fichier.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Revenus : GMV (brut/net, total/7j/30j) + remboursements + commissions ──────
create or replace view public.v_mkt_revenue
with (security_invoker = true) as
select
  -- GMV brut = tout ce qui a été capturé (succeeded + refunded), en centimes.
  coalesce(sum(amount_buyer_ttc) filter (where payment_status in ('succeeded','refunded')), 0)                                         as gmv_brut_total_cents,
  coalesce(sum(amount_buyer_ttc) filter (where payment_status in ('succeeded','refunded') and created_at >= now() - interval '7 days'), 0)  as gmv_brut_7d_cents,
  coalesce(sum(amount_buyer_ttc) filter (where payment_status in ('succeeded','refunded') and created_at >= now() - interval '30 days'), 0) as gmv_brut_30d_cents,
  -- GMV net = succeeded uniquement.
  coalesce(sum(amount_buyer_ttc) filter (where payment_status = 'succeeded'), 0)                                                       as gmv_net_total_cents,
  coalesce(sum(amount_buyer_ttc) filter (where payment_status = 'succeeded' and created_at >= now() - interval '7 days'), 0)           as gmv_net_7d_cents,
  coalesce(sum(amount_buyer_ttc) filter (where payment_status = 'succeeded' and created_at >= now() - interval '30 days'), 0)          as gmv_net_30d_cents,
  -- Remboursé (séparé).
  coalesce(sum(amount_buyer_ttc) filter (where payment_status = 'refunded'), 0)                                                        as refunded_total_cents,
  coalesce(sum(amount_buyer_ttc) filter (where payment_status = 'refunded' and created_at >= now() - interval '30 days'), 0)           as refunded_30d_cents,
  -- Commissions Equishow réalisées (sur succeeded).
  coalesce(sum(amount_platform_fee) filter (where payment_status = 'succeeded'), 0)                                                    as commissions_total_cents,
  coalesce(sum(amount_platform_fee) filter (where payment_status = 'succeeded' and created_at >= now() - interval '30 days'), 0)       as commissions_30d_cents
from public.payments;

-- 2) Revenus par module (payments.type) — net (succeeded) ────────────────────────
create or replace view public.v_mkt_revenue_by_type
with (security_invoker = true) as
select
  type,
  count(*) filter (where payment_status = 'succeeded')                                          as bookings,
  count(*) filter (where payment_status = 'succeeded' and created_at >= now() - interval '30 days') as bookings_30d,
  coalesce(sum(amount_buyer_ttc)  filter (where payment_status = 'succeeded'), 0)               as gmv_net_cents,
  coalesce(sum(amount_platform_fee) filter (where payment_status = 'succeeded'), 0)             as commissions_cents
from public.payments
group by type;

-- 3) Réservations payées : total + 30j (comptées via payments) ───────────────────
create or replace view public.v_mkt_reservations
with (security_invoker = true) as
select
  count(*) filter (where payment_status = 'succeeded')                                              as reservations_total,
  count(*) filter (where payment_status = 'succeeded' and created_at >= now() - interval '30 days')  as reservations_30d
from public.payments;

-- 4) Paiements : réussis / échoués / taux de réussite / panier moyen ──────────────
create or replace view public.v_mkt_payments
with (security_invoker = true) as
select
  count(*) filter (where payment_status = 'succeeded')                                          as payments_succeeded,
  count(*) filter (where payment_status = 'failed')                                              as payments_failed,
  -- Taux sur paiements ENREGISTRÉS (les 'failed' peuvent être sous-comptés selon
  -- ce que matérialise le webhook Stripe — cf. rapport d'audit).
  round(
    count(*) filter (where payment_status = 'succeeded')::numeric
    / nullif(count(*) filter (where payment_status in ('succeeded','failed')), 0)
  , 3)                                                                                           as success_rate,
  round(avg(amount_buyer_ttc) filter (where payment_status = 'succeeded'))                       as avg_basket_cents
from public.payments;

-- 5) Vendeurs : actifs / onboardés / non onboardés (ancré payments) ───────────────
-- Vendeur actif = a au moins 1 paiement 'succeeded' en tant que seller_id.
create or replace view public.v_mkt_sellers
with (security_invoker = true) as
with active as (
  select distinct seller_id
  from public.payments
  where payment_status = 'succeeded'
)
select
  (select count(*) from active)                                                                  as active_sellers,
  (select count(*) from active a join public.users u on u.id = a.seller_id
     where u.stripe_onboarding_complete is true)                                                 as active_onboarded,
  (select count(*) from active a join public.users u on u.id = a.seller_id
     where u.stripe_onboarding_complete is not true)                                             as active_not_onboarded;

-- 6) Escrow : séquestré / libéré / en attente — montant DÛ VENDEUR (seller_ht) ─────
create or replace view public.v_mkt_escrow
with (security_invoker = true) as
select
  coalesce(sum(amount_seller_ht) filter (where transfer_state = 'held'), 0)                      as held_seller_cents,
  coalesce(sum(amount_seller_ht) filter (where transfer_state = 'released'), 0)                  as released_seller_cents,
  coalesce(sum(amount_seller_ht) filter (where transfer_state = 'held' and release_due_at <= now()), 0) as pending_release_seller_cents,
  count(*) filter (where transfer_state = 'held')                                                as held_count,
  count(*) filter (where transfer_state = 'held' and release_due_at <= now())                    as pending_release_count
from public.payments;

-- 7) Litiges : nombre / ouverts / taux / montant concerné ─────────────────────────
create or replace view public.v_mkt_disputes
with (security_invoker = true) as
select
  (select count(*) from public.payment_disputes)                                                 as disputes_total,
  (select count(*) from public.payment_disputes where status = 'open')                           as disputes_open,
  -- Taux = litiges / paiements succeeded (population réellement exposée au risque).
  round(
    (select count(*) from public.payment_disputes)::numeric
    / nullif((select count(*) from public.payments where payment_status = 'succeeded'), 0)
  , 4)                                                                                           as dispute_rate,
  coalesce((
    select sum(p.amount_buyer_ttc)
    from public.payment_disputes d
    join public.payments p on p.id = d.payment_id
  ), 0)                                                                                          as disputed_amount_cents;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (à exécuter manuellement si besoin) :
--   drop view if exists public.v_mkt_disputes;
--   drop view if exists public.v_mkt_escrow;
--   drop view if exists public.v_mkt_sellers;
--   drop view if exists public.v_mkt_payments;
--   drop view if exists public.v_mkt_reservations;
--   drop view if exists public.v_mkt_revenue_by_type;
--   drop view if exists public.v_mkt_revenue;
-- ─────────────────────────────────────────────────────────────────────────────
