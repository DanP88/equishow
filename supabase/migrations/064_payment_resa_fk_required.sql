-- ════════════════════════════════════════════════════════════════════════
-- 064 — Garde : tout paiement DOIT porter la FK de sa réservation à l'INSERT.
--
-- Contexte (audit N° EQ-XXX, 2026-06-10) : checkout-success ET l'agenda
-- dérivent le numéro de réservation EQ-<TYPE>-XXXXXXXX de l'id de la
-- RÉSERVATION. Un paiement sans FK réservation casse cette cohérence
-- (checkout-success retombait alors sur l'id du PAIEMENT → faux numéro).
--
-- create-checkout-session pose déjà la FK ([cfg.fkCol]: itemId). Ce trigger la
-- rend OBLIGATOIRE pour empêcher toute régression future, quelle que soit la
-- source d'insertion.
--
-- Enforcement à l'INSERT UNIQUEMENT : les lignes legacy sans FK (box/course,
-- 2026-05-27→29) ne sont PAS re-validées ; leurs updates (refund, escrow,
-- release) restent possibles. Irrécupérables (ni FK ni id dans stripe_metadata)
-- → on les laisse telles quelles, l'app n'affiche simplement aucun N° pour
-- elles (cf. fix front checkout-success : jamais de N° dérivé du paiement).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.fn_payment_resa_fk_required()
returns trigger
language plpgsql
as $$
begin
  if (new.type = 'course'    and new.course_demand_id is null)
  or (new.type = 'stage'     and new.stage_reservation_id is null)
  or (new.type = 'transport' and new.transport_reservation_id is null)
  or (new.type = 'box'       and new.box_reservation_id is null) then
    raise exception 'payment_missing_reservation_fk (type=%, payment_id=%)',
      new.type, new.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_resa_fk_required on public.payments;
create trigger trg_payment_resa_fk_required
  before insert on public.payments
  for each row
  execute function public.fn_payment_resa_fk_required();
