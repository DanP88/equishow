-- ════════════════════════════════════════════════════════════════════════
-- HARNESS 073 — notif litige ouvert → acheteur (NON destructif, tx annulée).
--
--   (a) Migration NON appliquée (pré-merge) :
--       ( echo 'begin;'; cat supabase/migrations/073_notify_dispute_opened_buyer.sql; \
--         cat supabase/tests/073_notify_dispute_opened_buyer/harness.sql; echo 'rollback;' ) \
--         | supabase db query --linked -f -
--   (b) Migration déjà appliquée :
--       ( echo 'begin;'; cat .../harness.sql; echo 'rollback;' ) | supabase db query --linked -f -
--
-- Prouve : (T1) source='admin' → acheteur notifié ; (T2) source='stripe'
--   (chargeback) → acheteur notifié ; (T3) source='buyer' → acheteur NON
--   notifié ; (T4 NON-RÉGRESSION) admins + vendeur toujours notifiés (069).
-- Clone des paiements 'held' réels (FK résa + montants valides, trigger 064).
-- ════════════════════════════════════════════════════════════════════════
create temp table _r(test text, verdict text) on commit drop;

do $$
declare
  v_tpl   public.payments%rowtype;
  v_admin uuid;
  v_p1 uuid; v_b1 uuid; v_s1 uuid;
  v_p2 uuid; v_b2 uuid; v_s2 uuid;
  v_p3 uuid; v_b3 uuid; v_s3 uuid;
  c int; ca int; cs int;
begin
  -- Le test ne dépend pas de l'escrow : n'importe quel paiement sert de template
  -- (le trigger ne lit que buyer_id depuis payments). On clone un 'succeeded'.
  select * into v_tpl from public.payments where payment_status = 'succeeded' limit 1;
  if v_tpl.id is null then
    select * into v_tpl from public.payments limit 1;
  end if;
  if v_tpl.id is null then
    insert into _r values ('PRE aucun paiement', 'SKIP'); return;
  end if;
  select id into v_admin from public.users where role = 'admin' limit 1;

  -- ── P1 : litige source 'admin' ───────────────────────────────────────────
  insert into public.payments (
    buyer_id, seller_id, type, amount_buyer_ttc, amount_platform_fee,
    amount_seller_ht, commission_rate, commission_amount, payment_status,
    transfer_state, course_demand_id, stage_reservation_id, box_reservation_id,
    transport_reservation_id, dispute_status, release_blocked_reason
  ) values (
    v_tpl.buyer_id, v_tpl.seller_id, v_tpl.type, v_tpl.amount_buyer_ttc,
    v_tpl.amount_platform_fee, v_tpl.amount_seller_ht, v_tpl.commission_rate,
    v_tpl.commission_amount, 'succeeded', 'held',
    v_tpl.course_demand_id, v_tpl.stage_reservation_id, v_tpl.box_reservation_id,
    v_tpl.transport_reservation_id, null, null
  ) returning id, buyer_id, seller_id into v_p1, v_b1, v_s1;

  insert into public.payment_disputes(payment_id, source, status, opened_by)
  values (v_p1, 'admin', 'open', v_admin);

  -- T1 : acheteur notifié.
  select count(*) into c from public.notifications
   where destinataire_id = v_b1 and type = 'dispute_opened'
     and titre = '⚠️ Litige ouvert sur votre paiement'
     and donnees->>'paymentId' = v_p1::text;
  if c >= 1 then insert into _r values ('T1 source admin → notif acheteur', 'OK');
  else insert into _r values ('T1 source admin → notif acheteur', 'FAIL c='||c); end if;

  -- T4 : NON-RÉGRESSION — admins + vendeur toujours notifiés (069 intact).
  select count(*) into ca from public.notifications
   where destinataire_id = v_admin and type = 'dispute_opened'
     and titre = '🚩 Nouveau litige' and donnees->>'paymentId' = v_p1::text;
  select count(*) into cs from public.notifications
   where destinataire_id = v_s1 and type = 'dispute_opened'
     and titre = '⚠️ Litige ouvert' and donnees->>'paymentId' = v_p1::text;
  if ca >= 1 and cs >= 1 then insert into _r values ('T4 non-régression admin+vendeur (069)', 'OK');
  else insert into _r values ('T4 non-régression admin+vendeur (069)', 'FAIL admin='||ca||' seller='||cs); end if;

  -- ── P2 : litige source 'stripe' (chargeback) ─────────────────────────────
  insert into public.payments (
    buyer_id, seller_id, type, amount_buyer_ttc, amount_platform_fee,
    amount_seller_ht, commission_rate, commission_amount, payment_status,
    transfer_state, course_demand_id, stage_reservation_id, box_reservation_id,
    transport_reservation_id, dispute_status, release_blocked_reason
  ) values (
    v_tpl.buyer_id, v_tpl.seller_id, v_tpl.type, v_tpl.amount_buyer_ttc,
    v_tpl.amount_platform_fee, v_tpl.amount_seller_ht, v_tpl.commission_rate,
    v_tpl.commission_amount, 'succeeded', 'held',
    v_tpl.course_demand_id, v_tpl.stage_reservation_id, v_tpl.box_reservation_id,
    v_tpl.transport_reservation_id, null, null
  ) returning id, buyer_id, seller_id into v_p2, v_b2, v_s2;

  insert into public.payment_disputes(payment_id, source, status)
  values (v_p2, 'stripe', 'open');

  select count(*) into c from public.notifications
   where destinataire_id = v_b2 and type = 'dispute_opened'
     and titre = '⚠️ Litige ouvert sur votre paiement'
     and donnees->>'paymentId' = v_p2::text;
  if c >= 1 then insert into _r values ('T2 source stripe → notif acheteur', 'OK');
  else insert into _r values ('T2 source stripe → notif acheteur', 'FAIL c='||c); end if;

  -- ── P3 : litige source 'buyer' (auto-ouverture) ──────────────────────────
  insert into public.payments (
    buyer_id, seller_id, type, amount_buyer_ttc, amount_platform_fee,
    amount_seller_ht, commission_rate, commission_amount, payment_status,
    transfer_state, course_demand_id, stage_reservation_id, box_reservation_id,
    transport_reservation_id, dispute_status, release_blocked_reason
  ) values (
    v_tpl.buyer_id, v_tpl.seller_id, v_tpl.type, v_tpl.amount_buyer_ttc,
    v_tpl.amount_platform_fee, v_tpl.amount_seller_ht, v_tpl.commission_rate,
    v_tpl.commission_amount, 'succeeded', 'held',
    v_tpl.course_demand_id, v_tpl.stage_reservation_id, v_tpl.box_reservation_id,
    v_tpl.transport_reservation_id, null, null
  ) returning id, buyer_id, seller_id into v_p3, v_b3, v_s3;

  insert into public.payment_disputes(payment_id, source, status, opened_by)
  values (v_p3, 'buyer', 'open', v_b3);

  select count(*) into c from public.notifications
   where destinataire_id = v_b3 and type = 'dispute_opened'
     and titre = '⚠️ Litige ouvert sur votre paiement'
     and donnees->>'paymentId' = v_p3::text;
  if c = 0 then insert into _r values ('T3 source buyer → 0 notif acheteur', 'OK');
  else insert into _r values ('T3 source buyer → 0 notif acheteur', 'FAIL c='||c); end if;

exception when others then
  insert into _r values ('EXCEPTION', sqlerrm);
end $$;

select test, verdict from _r order by test;
select case when exists (select 1 from _r where verdict not in ('OK','SKIP'))
            then '❌ FAIL' else '✅ ALL PASS' end as resultat;
