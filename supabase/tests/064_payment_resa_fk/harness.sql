-- ════════════════════════════════════════════════════════════════════════
-- HARNESS 064 — garde FK réservation à l'INSERT (NON destructif : rollback).
-- À exécuter APRÈS application de 064. Buyer/seller = id réel prod existant.
--   supabase db query --linked -f supabase/tests/064_payment_resa_fk/harness.sql
-- ════════════════════════════════════════════════════════════════════════
begin;
create temp table _r(test text, verdict text) on commit drop;

-- T1 : INSERT box SANS box_reservation_id → doit être REJETÉ par le trigger.
do $$
begin
  begin
    insert into public.payments(
      buyer_id, seller_id, type,
      amount_buyer_ttc, amount_platform_fee, amount_seller_ht,
      currency, commission_rate, commission_amount, payment_status)
    values (
      '93947e0c-3726-4551-b834-a1135d816336',
      '93947e0c-3726-4551-b834-a1135d816336',
      'box', 1000, 50, 950, 'EUR', 5, 50, 'pending');
    insert into _r values ('T1 INSERT box sans FK rejeté', 'FAIL (accepté à tort)');
  exception when others then
    insert into _r values (
      'T1 INSERT box sans FK rejeté',
      case when sqlerrm like '%payment_missing_reservation_fk%' then 'OK'
           else 'FAIL (' || sqlerrm || ')' end);
  end;
end $$;

-- T2 : un UPDATE d'une éventuelle ligne legacy (FK nulle) NE doit PAS être
-- bloqué (trigger INSERT-only). On simule sans modifier réellement : si une
-- telle ligne existe, un update no-op doit passer.
do $$
declare v_id uuid;
begin
  select id into v_id from public.payments
   where payment_status = 'succeeded' and type = 'box' and box_reservation_id is null
   limit 1;
  if v_id is null then
    insert into _r values ('T2 update legacy non bloqué', 'SKIP (aucune ligne legacy)');
  else
    begin
      update public.payments set updated_at = now() where id = v_id;
      insert into _r values ('T2 update legacy non bloqué', 'OK');
    exception when others then
      insert into _r values ('T2 update legacy non bloqué', 'FAIL (' || sqlerrm || ')');
    end;
  end if;
end $$;

select * from _r order by test;
rollback;
