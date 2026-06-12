-- ════════════════════════════════════════════════════════════════════════
-- HARNESS 068 — notifications acheteur autour du délai 48h (NON destructif).
--
-- Corps SANS begin/rollback : exécuté DANS une transaction annulée.
--   (a) Migration NON appliquée (validation pré-merge) :
--       ( echo 'begin;'; cat supabase/migrations/068_escrow_buyer_notifications.sql; \
--         cat supabase/tests/068_escrow_buyer_notifications/harness.sql; echo 'rollback;' ) \
--         > /tmp/h068.sql && supabase db query --linked -f /tmp/h068.sql
--   (b) Migration déjà appliquée :
--       ( echo 'begin;'; cat .../harness.sql; echo 'rollback;' ) | supabase db query --linked -f -
--
-- Prouve : notif fin-presta une seule fois, rappel H+24 une seule fois, deep-link
--   action_url correct, exclusions (bloqué / litige), notif litige résolu
--   acheteur+vendeur (idempotente), AUCUN effet sur transfer_state / montants.
-- Les lignes de test CLONENT un paiement 'held' réel (FK résa + montants valides,
--   trigger 064 satisfait) puis surchargent les champs testés.
-- ════════════════════════════════════════════════════════════════════════
create temp table _r(test text, verdict text) on commit drop;

do $$
declare
  v_tpl  public.payments%rowtype;
  v_pa   uuid;  -- paiement passe A (fin presta)
  v_pb   uuid;  -- paiement passe B (rappel H+24)
  v_pc   uuid;  -- paiement bloqué (exclu)
  v_pd   uuid;  -- paiement litige
  v_buyer uuid; v_seller uuid;
  c_buyer int; c_seller int; c1 int; c2 int;
  v_url text; v_ts text; v_amt int;
begin
  -- Gabarit : un paiement séquestre réel (FK résa + montants conformes).
  select * into v_tpl from public.payments where transfer_state = 'held' limit 1;
  if v_tpl.id is null then
    insert into _r values ('PRE aucun paiement held disponible', 'SKIP'); return;
  end if;

  -- Helper de clonage : copie le gabarit, surcharge état/dates.
  -- Passe A : prestation finie (J0), non notifié, non bloqué, sans litige.
  insert into public.payments (
    buyer_id, seller_id, type, amount_buyer_ttc, amount_platform_fee,
    amount_seller_ht, commission_rate, commission_amount, payment_status,
    transfer_state, course_demand_id, stage_reservation_id, box_reservation_id,
    transport_reservation_id, prestation_end_at, release_due_at,
    buyer_prestation_notified_at, buyer_release_reminder_at, dispute_status,
    release_blocked_reason
  ) values (
    v_tpl.buyer_id, v_tpl.seller_id, v_tpl.type, v_tpl.amount_buyer_ttc,
    v_tpl.amount_platform_fee, v_tpl.amount_seller_ht, v_tpl.commission_rate,
    v_tpl.commission_amount, 'succeeded', 'held',
    v_tpl.course_demand_id, v_tpl.stage_reservation_id, v_tpl.box_reservation_id,
    v_tpl.transport_reservation_id,
    now() - interval '1 hour', now() + interval '47 hours',
    null, null, null, null
  ) returning id, buyer_id, seller_id into v_pa, v_buyer, v_seller;

  -- Passe B : déjà notifié fin-presta, release dans 12h → seul le rappel doit tomber.
  insert into public.payments (
    buyer_id, seller_id, type, amount_buyer_ttc, amount_platform_fee,
    amount_seller_ht, commission_rate, commission_amount, payment_status,
    transfer_state, course_demand_id, stage_reservation_id, box_reservation_id,
    transport_reservation_id, prestation_end_at, release_due_at,
    buyer_prestation_notified_at, buyer_release_reminder_at, dispute_status,
    release_blocked_reason
  ) values (
    v_tpl.buyer_id, v_tpl.seller_id, v_tpl.type, v_tpl.amount_buyer_ttc,
    v_tpl.amount_platform_fee, v_tpl.amount_seller_ht, v_tpl.commission_rate,
    v_tpl.commission_amount, 'succeeded', 'held',
    v_tpl.course_demand_id, v_tpl.stage_reservation_id, v_tpl.box_reservation_id,
    v_tpl.transport_reservation_id,
    now() - interval '36 hours', now() + interval '12 hours',
    now(), null, null, null
  ) returning id into v_pb;

  -- Exclu : prestation finie MAIS bloqué (vendeur non onboardé) → aucune notif.
  insert into public.payments (
    buyer_id, seller_id, type, amount_buyer_ttc, amount_platform_fee,
    amount_seller_ht, commission_rate, commission_amount, payment_status,
    transfer_state, course_demand_id, stage_reservation_id, box_reservation_id,
    transport_reservation_id, prestation_end_at, release_due_at,
    buyer_prestation_notified_at, buyer_release_reminder_at, dispute_status,
    release_blocked_reason
  ) values (
    v_tpl.buyer_id, v_tpl.seller_id, v_tpl.type, v_tpl.amount_buyer_ttc,
    v_tpl.amount_platform_fee, v_tpl.amount_seller_ht, v_tpl.commission_rate,
    v_tpl.commission_amount, 'succeeded', 'held',
    v_tpl.course_demand_id, v_tpl.stage_reservation_id, v_tpl.box_reservation_id,
    v_tpl.transport_reservation_id,
    now() - interval '1 hour', now() + interval '47 hours',
    null, null, null, 'seller_not_onboarded'
  ) returning id into v_pc;

  -- ── Run #1 ────────────────────────────────────────────────────────────────
  perform public.fn_escrow_buyer_notify_run();

  -- T1 : 1 notif fin-presta pour le paiement A, type + titre + deep-link corrects.
  select count(*) into c1 from public.notifications
   where donnees->>'paymentId' = v_pa::text and type = 'escrow_prestation_done';
  select action_url into v_url from public.notifications
   where donnees->>'paymentId' = v_pa::text and type = 'escrow_prestation_done' limit 1;
  if c1 = 1 and v_url like '/(tabs)/cavalier-agenda?pay=%' then
    insert into _r values ('T1 fin-presta J0 (1 notif + deep-link)', 'OK');
  else
    insert into _r values ('T1 fin-presta J0 (1 notif + deep-link)',
      'FAIL c1='||c1||' url='||coalesce(v_url,'NULL'));
  end if;

  -- T2 : marqueur posé sur A.
  if exists (select 1 from public.payments where id = v_pa and buyer_prestation_notified_at is not null) then
    insert into _r values ('T2 marqueur buyer_prestation_notified_at posé', 'OK');
  else
    insert into _r values ('T2 marqueur buyer_prestation_notified_at posé', 'FAIL');
  end if;

  -- T3 : 1 rappel H+24 pour le paiement B (et PAS de fin-presta, déjà notifié).
  select count(*) into c1 from public.notifications
   where donnees->>'paymentId' = v_pb::text and type = 'escrow_release_soon';
  select count(*) into c2 from public.notifications
   where donnees->>'paymentId' = v_pb::text and type = 'escrow_prestation_done';
  if c1 = 1 and c2 = 0 then
    insert into _r values ('T3 rappel H+24 (1 notif, pas de fin-presta)', 'OK');
  else
    insert into _r values ('T3 rappel H+24 (1 notif, pas de fin-presta)', 'FAIL soon='||c1||' done='||c2);
  end if;

  -- T4 : paiement bloqué → AUCUNE notif (message véridique).
  select count(*) into c1 from public.notifications where donnees->>'paymentId' = v_pc::text;
  if c1 = 0 then insert into _r values ('T4 bloqué seller_not_onboarded → 0 notif', 'OK');
  else insert into _r values ('T4 bloqué seller_not_onboarded → 0 notif', 'FAIL c1='||c1); end if;

  -- ── Run #2 (idempotence) ──────────────────────────────────────────────────
  perform public.fn_escrow_buyer_notify_run();

  -- T5 : pas de doublon fin-presta (A) ni rappel (B) après 2e run.
  select count(*) into c1 from public.notifications
   where donnees->>'paymentId' = v_pa::text and type = 'escrow_prestation_done';
  select count(*) into c2 from public.notifications
   where donnees->>'paymentId' = v_pb::text and type = 'escrow_release_soon';
  if c1 = 1 and c2 = 1 then
    insert into _r values ('T5 idempotence (run#2 → 0 doublon)', 'OK');
  else
    insert into _r values ('T5 idempotence (run#2 → 0 doublon)', 'FAIL done='||c1||' soon='||c2);
  end if;

  -- T6 : AUCUN effet escrow — transfer_state et montants intacts sur A/B/C.
  select count(*) into c1 from public.payments
   where id in (v_pa, v_pb, v_pc) and transfer_state = 'held';
  select transfer_state, amount_seller_ht into v_ts, v_amt from public.payments where id = v_pa;
  if c1 = 3 and v_ts = 'held' and v_amt = v_tpl.amount_seller_ht then
    insert into _r values ('T6 escrow intact (transfer_state held, montants)', 'OK');
  else
    insert into _r values ('T6 escrow intact', 'FAIL held='||c1||' ts='||v_ts);
  end if;

  -- ── Litige résolu (feature 4) ─────────────────────────────────────────────
  insert into public.payment_disputes(payment_id, source, status, opened_by)
  values (v_pa, 'buyer', 'open', v_buyer);  -- litige sur le paiement A

  update public.payment_disputes
     set status = 'resolved_release', resolved_at = now()
   where payment_id = v_pa and status = 'open';

  select count(*) into c_buyer from public.notifications
   where destinataire_id = v_buyer and type = 'dispute_resolved'
     and donnees->>'paymentId' = v_pa::text;
  select count(*) into c_seller from public.notifications
   where destinataire_id = v_seller and type = 'dispute_resolved'
     and donnees->>'paymentId' = v_pa::text;
  -- buyer==seller possible sur données de test : on tolère >=1 chacun.
  if c_buyer >= 1 and c_seller >= 1 then
    insert into _r values ('T7 litige résolu → notif acheteur + vendeur', 'OK');
  else
    insert into _r values ('T7 litige résolu → notif acheteur + vendeur',
      'FAIL buyer='||c_buyer||' seller='||c_seller);
  end if;

  -- T8 : ré-update (déjà resolved) → pas de nouvelle notif (idempotence transition).
  update public.payment_disputes set resolved_at = now()
   where payment_id = v_pa and status = 'resolved_release';
  select count(*) into c1 from public.notifications
   where type = 'dispute_resolved' and donnees->>'paymentId' = v_pa::text;
  if c1 = c_buyer + c_seller then
    insert into _r values ('T8 litige idempotent (ré-update → 0 notif)', 'OK');
  else
    insert into _r values ('T8 litige idempotent (ré-update → 0 notif)',
      'FAIL total='||c1||' attendu='||(c_buyer + c_seller));
  end if;

exception when others then
  insert into _r values ('EXCEPTION', sqlerrm);
end $$;

-- Verdict
select test, verdict from _r order by test;
select case when exists (select 1 from _r where verdict <> 'OK' and verdict <> 'SKIP')
            then '❌ FAIL' else '✅ ALL PASS' end as resultat;
