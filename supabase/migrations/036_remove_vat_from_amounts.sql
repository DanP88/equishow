-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 036 — Retirer la TVA 20% des triggers d'autorité côté serveur
--
-- Décision produit 2026-05-19 : Equishow est une marketplace P2P entre
-- particuliers (cavaliers, propriétaires de box, coachs). La transaction
-- entre buyer et seller n'est PAS soumise à TVA. Seule la commission
-- plateforme Equishow pourrait être soumise à TVA — sujet à traiter en
-- phase production (ce n'est pas modélisé ici, le testeur paie HT+commission).
--
-- Avant : Stripe affichait HT + commission + TVA 20% (ex: 90 + 4,50 + 18 = 112,50€)
-- alors que l'app annonçait HT + commission (90 + 4,50 = 94,50€) → discordance.
--
-- Après : DB et app calculent strictement HT + commission. Le champ DB
-- `price_total_ttc` conserve son nom (contrat schéma front/back) mais
-- ne contient plus de TVA — sémantique = "total à payer par le buyer".
-- ─────────────────────────────────────────────────────────────────────────────

-- ── course_demands ──────────────────────────────────────────────────────────
create or replace function public.recalc_course_demand_amounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price_per_day_ttc numeric;
  v_commission_rate   numeric;
  v_total_ht          numeric;
  v_commission        numeric;
  v_total_ttc         numeric;
begin
  -- Lecture prix annonce
  select prix_heure_ttc into v_price_per_day_ttc
  from public.coach_annonces
  where id = new.annonce_id;

  if v_price_per_day_ttc is null or v_price_per_day_ttc <= 0 then
    raise exception 'invalid prix_heure_ttc for annonce % (must be > 0)', new.annonce_id;
  end if;

  if new.nb_jours is null or new.nb_jours <= 0 then
    raise exception 'invalid nb_jours % (must be > 0)', new.nb_jours;
  end if;

  v_commission_rate := public.get_commission_rate('cours');

  -- Pas de TVA : le prix annonce est le prix payé tel quel + commission plateforme.
  v_total_ht   := round(v_price_per_day_ttc * new.nb_jours, 2);
  v_commission := round(v_total_ht * v_commission_rate, 2);
  v_total_ttc  := round(v_total_ht + v_commission, 2);

  new.price_per_day_ttc   := v_price_per_day_ttc;
  new.total_amount_ht     := v_total_ht;
  new.platform_commission := v_commission;
  new.total_amount_ttc    := v_total_ttc;
  return new;
end;
$$;

-- ── box_reservations ────────────────────────────────────────────────────────
create or replace function public.recalc_box_reservation_amounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prix_nuit_ht    numeric;
  v_commission_rate numeric;
  v_total_ht        numeric;
  v_commission      numeric;
  v_total_ttc       numeric;
begin
  -- Lecture prix annonce
  select prix_nuit_ht into v_prix_nuit_ht
  from public.box_annonces
  where id = new.box_id;

  if v_prix_nuit_ht is null or v_prix_nuit_ht <= 0 then
    raise exception 'invalid prix_nuit_ht for box_annonce % (must be > 0)', new.box_id;
  end if;

  if new.nb_nuits is null or new.nb_nuits <= 0 then
    raise exception 'invalid nb_nuits % (must be > 0)', new.nb_nuits;
  end if;

  v_commission_rate := public.get_commission_rate('box');

  -- Pas de TVA : le prix nuit est le prix payé tel quel + commission plateforme.
  v_total_ht   := round(v_prix_nuit_ht * new.nb_nuits, 2);
  v_commission := round(v_total_ht * v_commission_rate, 2);
  v_total_ttc  := round(v_total_ht + v_commission, 2);

  new.price_total_ht       := v_total_ht;
  new.platform_commission  := v_commission;
  new.price_total_ttc      := v_total_ttc;
  return new;
end;
$$;

-- ── stage_reservations ──────────────────────────────────────────────────────
create or replace function public.recalc_stage_reservation_amounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prix_place_ttc  numeric;
  v_commission_rate numeric;
  v_total_ht        numeric;
  v_commission      numeric;
  v_total_ttc       numeric;
begin
  -- Lecture prix par place depuis le stage
  select prix_ttc into v_prix_place_ttc
  from public.stages
  where id = new.stage_id;

  if v_prix_place_ttc is null or v_prix_place_ttc <= 0 then
    raise exception 'invalid prix_ttc for stage % (must be > 0)', new.stage_id;
  end if;

  if new.nb_participants is null or new.nb_participants <= 0 then
    raise exception 'invalid nb_participants % (must be > 0)', new.nb_participants;
  end if;

  v_commission_rate := public.get_commission_rate('cours');

  -- Pas de TVA : le prix par place est le prix payé tel quel + commission plateforme.
  v_total_ht   := round(v_prix_place_ttc * new.nb_participants, 2);
  v_commission := round(v_total_ht * v_commission_rate, 2);
  v_total_ttc  := round(v_total_ht + v_commission, 2);

  new.price_total_ht       := v_total_ht;
  new.platform_commission  := v_commission;
  new.price_total_ttc      := v_total_ttc;
  return new;
end;
$$;

-- Note : les triggers eux-mêmes (trg_*_recalc) restent attachés tels quels,
-- on a juste réécrit le corps des 3 fonctions qu'ils invoquent.
