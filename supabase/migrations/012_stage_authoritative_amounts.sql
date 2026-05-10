-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 012 — stage_reservations server-authoritative amounts
--
-- Suite migration 011 (course_demands + box_reservations). Étend la même
-- logique aux stages : trigger BEFORE INSERT recalcule les montants depuis
-- `stages.prix_ttc` × `nb_participants` + `platform_settings.commission_cours`.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.recalc_stage_reservation_amounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prix_place_ttc  numeric;
  v_commission_rate numeric;
  v_prix_place_ht   numeric;
  v_total_ht        numeric;
  v_commission      numeric;
  v_vat             numeric;
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

  -- Convention identique à course_demands :
  -- prix_ttc inclut HT + TVA 20% mais pas la commission.
  v_commission_rate := public.get_commission_rate('cours');

  v_prix_place_ht := round(v_prix_place_ttc / 1.20, 2);
  v_total_ht      := round(v_prix_place_ht * new.nb_participants, 2);
  v_commission    := round(v_total_ht * v_commission_rate, 2);
  v_vat           := round(v_total_ht * 0.20, 2);
  v_total_ttc     := round(v_total_ht + v_commission + v_vat, 2);

  new.price_total_ht       := v_total_ht;
  new.platform_commission  := v_commission;
  new.price_total_ttc      := v_total_ttc;
  return new;
end;
$$;

drop trigger if exists trg_stage_reservations_recalc on public.stage_reservations;
create trigger trg_stage_reservations_recalc
  before insert on public.stage_reservations
  for each row execute function public.recalc_stage_reservation_amounts();
