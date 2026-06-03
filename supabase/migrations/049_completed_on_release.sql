-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 049 — Statut `completed` propagé au moment de la libération escrow
--
-- Contexte (audit Phase 0, 2026-06-03) :
--   `SELECT count(*) FROM course_demands/stage/box WHERE status='paid'` = 12,
--   `WHERE status='completed'` = 0 sur les 4 tables → cycle de vie cassé.
--   Cause : ni `release-payment` ni `escrow-cron-release` n'écrivent
--   `status='completed'` sur la réservation après libération des fonds.
--
-- Stratégie (source unique de vérité = DB trigger, indépendant du caller) :
--   - Trigger AFTER UPDATE OF transfer_state ON payments
--   - WHEN (NEW.transfer_state = 'released' AND OLD.transfer_state <> 'released')
--   - Identifie la réservation liée via payment.type + FK adaptée
--   - Update reservation.status='completed' UNIQUEMENT si actuellement 'paid'
--     (idempotent : pas de régression sur cancelled/rejected/etc.)
--
-- Trigger SECURITY DEFINER → bypass RLS, et current_user=postgres lors de
-- l'exécution → fn_can_bypass_reservation_guard (mig 047) autorise la transition
-- vers 'completed'.
--
-- Backfill : pour les 7 payments actuellement transfer_state='released' dont
-- la réservation est encore 'paid', basculer en 'completed'.
--
-- Non destructif : pas de DROP, statut 'completed' déjà accepté par les
-- CHECK constraints existants (cf. mig 005). EXCEPTION : transport_reservations
-- (mig 043) n'accepte PAS 'completed' dans son CHECK → on doit l'élargir
-- (additif, non destructif).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Étendre le CHECK transport_reservations.statut pour accepter 'completed' ─
do $$
declare
  cn text;
begin
  select conname into cn
    from pg_constraint
   where conrelid = 'public.transport_reservations'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%(statut = ANY%';
  if cn is not null then
    execute format('alter table public.transport_reservations drop constraint %I', cn);
  end if;

  alter table public.transport_reservations
    add constraint transport_reservations_statut_check
    check (statut = any (array['pending','accepted','rejected','awaiting_payment','paid','cancelled','completed']));
end $$;


-- ── Function : marquer la réservation associée à un payment comme completed ─
-- Idempotent : ne change rien si la réservation n'est pas 'paid'.
create or replace function public.fn_mark_reservation_completed_from_payment(
  p_payment_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type    text;
  v_course  uuid;
  v_stage   uuid;
  v_box     uuid;
  v_transp  uuid;
begin
  select type, course_demand_id, stage_reservation_id,
         box_reservation_id, transport_reservation_id
    into v_type, v_course, v_stage, v_box, v_transp
    from public.payments
   where id = p_payment_id;

  if v_type = 'course' and v_course is not null then
    update public.course_demands
       set status = 'completed', updated_at = now()
     where id = v_course and status = 'paid';
  elsif v_type = 'stage' and v_stage is not null then
    update public.stage_reservations
       set status = 'completed', updated_at = now()
     where id = v_stage and status = 'paid';
  elsif v_type = 'box' and v_box is not null then
    update public.box_reservations
       set status = 'completed', updated_at = now()
     where id = v_box and status = 'paid';
  elsif v_type = 'transport' and v_transp is not null then
    update public.transport_reservations
       set statut = 'completed'
     where id = v_transp and statut = 'paid';
  end if;
end $$;

comment on function public.fn_mark_reservation_completed_from_payment(uuid) is
  'Bascule status=completed sur la réservation associée à un payment, UNIQUEMENT
   si elle est actuellement paid. Idempotent. Mig 049.';


-- ── Trigger : fire à chaque transition transfer_state → released ────────────
create or replace function public.trg_payment_released_to_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.transfer_state = 'released'
     and (old.transfer_state is null or old.transfer_state <> 'released') then
    perform public.fn_mark_reservation_completed_from_payment(new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_payment_released_to_completed on public.payments;
create trigger trg_payment_released_to_completed
  after update of transfer_state on public.payments
  for each row execute function public.trg_payment_released_to_completed();


-- ── Backfill : marquer les réservations dont le payment associé est déjà ────
-- transfer_state='released' mais qui sont restées 'paid'.
-- 7 lignes attendues (snapshot 2026-06-03).
do $$
declare
  p record;
begin
  for p in
    select id from public.payments where transfer_state = 'released'
  loop
    perform public.fn_mark_reservation_completed_from_payment(p.id);
  end loop;
end $$;
