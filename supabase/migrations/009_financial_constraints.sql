-- Migration 009 : contraintes financières (audit P10)
-- Garantit qu'aucune row ne contient de montant NULL ou négatif.
-- Règle :
--   * NOT NULL partout sur les colonnes monétaires
--   * CHECK > 0 sur les montants en transit Stripe (buyer/seller/totaux)
--   * CHECK >= 0 sur commissions, fees, prix d'annonce (gratuit légitime)
--   * commission_rate borné [0..100]

-- ────────────────────────────────────────────────────────────────────────────
-- Étape 0 : pre-flight check. Si des rows existantes violent les CHECK > 0
-- à ajouter, on bloque proprement avec un message clair plutôt que de laisser
-- ALTER TABLE échouer en rollback opaque.
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_bad integer;
begin
  -- course_demands : colonnes > 0
  select count(*) into v_bad from public.course_demands
   where price_per_day_ttc <= 0 or total_amount_ht <= 0 or total_amount_ttc <= 0;
  if v_bad > 0 then
    raise exception 'course_demands has % row(s) with non-positive amount (price_per_day_ttc/total_amount_ht/total_amount_ttc <= 0)', v_bad;
  end if;

  -- box_reservations : > 0
  select count(*) into v_bad from public.box_reservations
   where price_total_ht <= 0 or price_total_ttc <= 0;
  if v_bad > 0 then
    raise exception 'box_reservations has % row(s) with non-positive amount (price_total_ht/price_total_ttc <= 0)', v_bad;
  end if;

  -- stage_reservations : > 0
  select count(*) into v_bad from public.stage_reservations
   where price_total_ht <= 0 or price_total_ttc <= 0;
  if v_bad > 0 then
    raise exception 'stage_reservations has % row(s) with non-positive amount (price_total_ht/price_total_ttc <= 0)', v_bad;
  end if;

  -- transport_reservations : > 0 (post-NOT-NULL update)
  select count(*) into v_bad from public.transport_reservations
   where coalesce(prix_total_ht, 0) <= 0 or coalesce(prix_total_ttc, 0) <= 0;
  if v_bad > 0 then
    raise exception 'transport_reservations has % row(s) with non-positive amount', v_bad;
  end if;

  -- payments : > 0 strict
  select count(*) into v_bad from public.payments
   where amount_buyer_ttc <= 0 or amount_seller_ht <= 0;
  if v_bad > 0 then
    raise exception 'payments has % row(s) with non-positive amount (amount_buyer_ttc/amount_seller_ht <= 0)', v_bad;
  end if;

  -- payments : commission_rate borne
  select count(*) into v_bad from public.payments
   where commission_rate < 0 or commission_rate > 100;
  if v_bad > 0 then
    raise exception 'payments has % row(s) with commission_rate outside [0,100]', v_bad;
  end if;
end $$;

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- coach_annonces : prix_heure_ht / prix_heure_ttc
-- ────────────────────────────────────────────────────────────────────────────
update public.coach_annonces set prix_heure_ht  = 0 where prix_heure_ht  is null;
update public.coach_annonces set prix_heure_ttc = 0 where prix_heure_ttc is null;

alter table public.coach_annonces
  alter column prix_heure_ht  set default 0,
  alter column prix_heure_ht  set not null,
  alter column prix_heure_ttc set default 0,
  alter column prix_heure_ttc set not null;

alter table public.coach_annonces
  drop constraint if exists coach_annonces_prix_heure_ht_check,
  drop constraint if exists coach_annonces_prix_heure_ttc_check;

alter table public.coach_annonces
  add constraint coach_annonces_prix_heure_ht_check  check (prix_heure_ht  >= 0),
  add constraint coach_annonces_prix_heure_ttc_check check (prix_heure_ttc >= 0);

-- ────────────────────────────────────────────────────────────────────────────
-- transport_annonces : prix_ht / price_per_km
-- ────────────────────────────────────────────────────────────────────────────
update public.transport_annonces set prix_ht      = 0 where prix_ht      is null;
update public.transport_annonces set price_per_km = 0 where price_per_km is null;

alter table public.transport_annonces
  alter column prix_ht      set default 0,
  alter column prix_ht      set not null,
  alter column price_per_km set default 0,
  alter column price_per_km set not null;

alter table public.transport_annonces
  drop constraint if exists transport_annonces_prix_ht_check,
  drop constraint if exists transport_annonces_price_per_km_check;

alter table public.transport_annonces
  add constraint transport_annonces_prix_ht_check      check (prix_ht      >= 0),
  add constraint transport_annonces_price_per_km_check check (price_per_km >= 0);

-- ────────────────────────────────────────────────────────────────────────────
-- transport_reservations : prix totaux + commission
-- ────────────────────────────────────────────────────────────────────────────
update public.transport_reservations set prix_total_ht         = 0 where prix_total_ht         is null;
update public.transport_reservations set prix_total_ttc        = 0 where prix_total_ttc        is null;
update public.transport_reservations set commission_plateforme = 0 where commission_plateforme is null;

alter table public.transport_reservations
  alter column prix_total_ht         set not null,
  alter column prix_total_ttc        set not null,
  alter column commission_plateforme set not null;

alter table public.transport_reservations
  drop constraint if exists transport_reservations_prix_total_ht_check,
  drop constraint if exists transport_reservations_prix_total_ttc_check,
  drop constraint if exists transport_reservations_commission_check;

alter table public.transport_reservations
  add constraint transport_reservations_prix_total_ht_check  check (prix_total_ht         > 0),
  add constraint transport_reservations_prix_total_ttc_check check (prix_total_ttc        > 0),
  add constraint transport_reservations_commission_check     check (commission_plateforme >= 0);

-- ────────────────────────────────────────────────────────────────────────────
-- course_demands : montants déjà NOT NULL, ajout des CHECK
-- ────────────────────────────────────────────────────────────────────────────
alter table public.course_demands
  drop constraint if exists course_demands_price_per_day_ttc_check,
  drop constraint if exists course_demands_total_amount_ht_check,
  drop constraint if exists course_demands_total_amount_ttc_check,
  drop constraint if exists course_demands_platform_commission_check;

alter table public.course_demands
  add constraint course_demands_price_per_day_ttc_check    check (price_per_day_ttc   >  0),
  add constraint course_demands_total_amount_ht_check      check (total_amount_ht     >  0),
  add constraint course_demands_total_amount_ttc_check     check (total_amount_ttc    >  0),
  add constraint course_demands_platform_commission_check  check (platform_commission >= 0);

-- ────────────────────────────────────────────────────────────────────────────
-- box_annonces : prix_nuit_ht (gratuit possible)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.box_annonces
  drop constraint if exists box_annonces_prix_nuit_ht_check;

alter table public.box_annonces
  add constraint box_annonces_prix_nuit_ht_check check (prix_nuit_ht >= 0);

-- ────────────────────────────────────────────────────────────────────────────
-- box_reservations : montants
-- ────────────────────────────────────────────────────────────────────────────
alter table public.box_reservations
  drop constraint if exists box_reservations_price_total_ht_check,
  drop constraint if exists box_reservations_price_total_ttc_check,
  drop constraint if exists box_reservations_platform_commission_check;

alter table public.box_reservations
  add constraint box_reservations_price_total_ht_check       check (price_total_ht      >  0),
  add constraint box_reservations_price_total_ttc_check      check (price_total_ttc     >  0),
  add constraint box_reservations_platform_commission_check  check (platform_commission >= 0);

-- ────────────────────────────────────────────────────────────────────────────
-- stages : prix_ttc (gratuit possible)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.stages
  drop constraint if exists stages_prix_ttc_check;

alter table public.stages
  add constraint stages_prix_ttc_check check (prix_ttc >= 0);

-- ────────────────────────────────────────────────────────────────────────────
-- stage_reservations : montants
-- ────────────────────────────────────────────────────────────────────────────
alter table public.stage_reservations
  drop constraint if exists stage_reservations_price_total_ht_check,
  drop constraint if exists stage_reservations_price_total_ttc_check,
  drop constraint if exists stage_reservations_platform_commission_check;

alter table public.stage_reservations
  add constraint stage_reservations_price_total_ht_check       check (price_total_ht      >  0),
  add constraint stage_reservations_price_total_ttc_check      check (price_total_ttc     >  0),
  add constraint stage_reservations_platform_commission_check  check (platform_commission >= 0);

-- ────────────────────────────────────────────────────────────────────────────
-- payments : montants Stripe (centimes integer)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.payments
  drop constraint if exists payments_amount_buyer_ttc_check,
  drop constraint if exists payments_amount_seller_ht_check,
  drop constraint if exists payments_amount_platform_fee_check,
  drop constraint if exists payments_commission_amount_check,
  drop constraint if exists payments_commission_rate_check;

alter table public.payments
  add constraint payments_amount_buyer_ttc_check    check (amount_buyer_ttc    >  0),
  add constraint payments_amount_seller_ht_check    check (amount_seller_ht    >  0),
  add constraint payments_amount_platform_fee_check check (amount_platform_fee >= 0),
  add constraint payments_commission_amount_check   check (commission_amount   >= 0),
  add constraint payments_commission_rate_check     check (commission_rate     >= 0 and commission_rate <= 100);

commit;
