-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 011 — Montants autoritaires serveur-side
--
-- Problème : RLS autorise le `buyer_id` à insérer avec `price_total_ttc=1`
-- → `create-checkout-session` (P1 fix) charge alors le montant frauduleux.
-- Solution : trigger BEFORE INSERT recalcule prix/commission/TVA depuis
--            l'annonce + `platform_settings`. Les valeurs envoyées par
--            le client sont écrasées.
--
-- Tables couvertes : course_demands, box_reservations.
-- Stages : flow instable (mismatch noms colonnes) → traité séparément.
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper : commission_rate depuis platform_settings, fallback 5%.
create or replace function public.get_commission_rate(p_service_type text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value::numeric
     from public.platform_settings
     where key = 'commission_' || p_service_type),
    0.05
  );
$$;

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
  v_price_per_day_ht  numeric;
  v_total_ht          numeric;
  v_commission        numeric;
  v_vat               numeric;
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

  -- prix_heure_ttc inclut la TVA (HT × 1.20). On reconstitue HT puis ajoute commission + TVA.
  v_price_per_day_ht := round(v_price_per_day_ttc / 1.20, 2);
  v_total_ht         := round(v_price_per_day_ht * new.nb_jours, 2);
  v_commission       := round(v_total_ht * v_commission_rate, 2);
  v_vat              := round(v_total_ht * 0.20, 2);
  v_total_ttc        := round(v_total_ht + v_commission + v_vat, 2);

  new.price_per_day_ttc   := v_price_per_day_ttc;
  new.total_amount_ht     := v_total_ht;
  new.platform_commission := v_commission;
  new.total_amount_ttc    := v_total_ttc;
  return new;
end;
$$;

drop trigger if exists trg_course_demands_recalc on public.course_demands;
create trigger trg_course_demands_recalc
  before insert on public.course_demands
  for each row execute function public.recalc_course_demand_amounts();

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
  v_vat             numeric;
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

  v_total_ht   := round(v_prix_nuit_ht * new.nb_nuits, 2);
  v_commission := round(v_total_ht * v_commission_rate, 2);
  v_vat        := round(v_total_ht * 0.20, 2);
  v_total_ttc  := round(v_total_ht + v_commission + v_vat, 2);

  new.price_total_ht       := v_total_ht;
  new.platform_commission  := v_commission;
  new.price_total_ttc      := v_total_ttc;
  return new;
end;
$$;

drop trigger if exists trg_box_reservations_recalc on public.box_reservations;
create trigger trg_box_reservations_recalc
  before insert on public.box_reservations
  for each row execute function public.recalc_box_reservation_amounts();

-- Note : pas de trigger sur UPDATE volontairement.
-- Les status changes (pending → accepted → paid) ne doivent pas déclencher
-- de recalcul. Si un cavalier veut changer nb_jours/nb_nuits, il doit
-- supprimer la demande et en recréer une.
