-- ════════════════════════════════════════════════════════════════════════
-- HARNESS 069 — litiges P0+P1 (NON destructif, transaction annulée).
--
--   (a) Migration NON appliquée (pré-merge) :
--       ( echo 'begin;'; cat supabase/migrations/069_dispute_p0_p1.sql; \
--         cat supabase/tests/069_dispute_p0_p1/harness.sql; echo 'rollback;' ) \
--         > /tmp/h069.sql && supabase db query --linked -f /tmp/h069.sql
--   (b) Migration déjà appliquée :
--       ( echo 'begin;'; cat .../harness.sql; echo 'rollback;' ) | supabase db query --linked -f -
--
-- Prouve : ouverture→notif admin, ouverture→notif vendeur, double ouverture
--   impossible (index unique), reversed→notif acheteur+vendeur, aging détecté
--   dans fn_escrow_health, anti-spam 067 conservé (fired→suppressed), montants
--   inchangés, transfer_state non modifié par les fns de notification.
-- Clone un paiement 'held' réel (FK résa + montants valides, trigger 064).
-- ════════════════════════════════════════════════════════════════════════
create temp table _r(test text, verdict text) on commit drop;

do $$
declare
  v_tpl    public.payments%rowtype;
  v_pay    uuid;
  v_buyer  uuid; v_seller uuid;
  v_admin  uuid;
  v_disp   uuid;
  c1 int; c2 int;
  v_dup_blocked boolean := false;
  v_aging int;
  v_run1 jsonb; v_run2 jsonb;
  v_ts text; v_amt int;
begin
  select * into v_tpl from public.payments where transfer_state = 'held' limit 1;
  if v_tpl.id is null then
    insert into _r values ('PRE aucun paiement held', 'SKIP'); return;
  end if;
  select id into v_admin from public.users where role = 'admin' limit 1;

  -- Clone held (dispute_status/block NULL).
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
  ) returning id, buyer_id, seller_id into v_pay, v_buyer, v_seller;

  -- ── Ouverture litige → trigger fan-out ───────────────────────────────────
  insert into public.payment_disputes(payment_id, source, status, reason, opened_by)
  values (v_pay, 'buyer', 'open', 'Cheval absent à la livraison', v_buyer)
  returning id into v_disp;

  -- T1 : notif admin.
  if v_admin is not null and exists (
    select 1 from public.notifications
     where destinataire_id = v_admin and type = 'dispute_opened'
       and titre = '🚩 Nouveau litige'
       and donnees->>'paymentId' = v_pay::text
  ) then insert into _r values ('T1 ouverture → notif admin', 'OK');
  else insert into _r values ('T1 ouverture → notif admin', 'FAIL'); end if;

  -- T2 : notif vendeur.
  if exists (
    select 1 from public.notifications
     where destinataire_id = v_seller and type = 'dispute_opened'
       and titre = '⚠️ Litige ouvert'
       and donnees->>'paymentId' = v_pay::text
  ) then insert into _r values ('T2 ouverture → notif vendeur', 'OK');
  else insert into _r values ('T2 ouverture → notif vendeur', 'FAIL'); end if;

  -- T8 : transfer_state NON modifié par le trigger de notif.
  select transfer_state into v_ts from public.payments where id = v_pay;
  if v_ts = 'held' then insert into _r values ('T8 notif ouverture ne touche pas transfer_state', 'OK');
  else insert into _r values ('T8 notif ouverture ne touche pas transfer_state', 'FAIL ts='||v_ts); end if;

  -- T3 : double litige ouvert → index unique partiel bloque.
  begin
    insert into public.payment_disputes(payment_id, source, status, opened_by)
    values (v_pay, 'admin', 'open', v_admin);
  exception when unique_violation then
    v_dup_blocked := true;
  end;
  if v_dup_blocked then insert into _r values ('T3 double ouverture → bloquée (unique)', 'OK');
  else insert into _r values ('T3 double ouverture → bloquée (unique)', 'FAIL non bloquée'); end if;

  -- T5 : litige vieillissant détecté par fn_escrow_health.
  update public.payment_disputes set created_at = now() - interval '72 hours' where id = v_disp;
  select coalesce((public.fn_escrow_health() -> 'open_dispute_aging' ->> 'count')::int, 0) into v_aging;
  if v_aging >= 1 then insert into _r values ('T5 aging détecté (fn_escrow_health)', 'OK');
  else insert into _r values ('T5 aging détecté (fn_escrow_health)', 'FAIL count='||v_aging); end if;

  -- T6 : anti-spam 067 conservé — run1 fire open_dispute_aging, run2 suppressed.
  v_run1 := public.fn_escrow_alert_run();
  v_run2 := public.fn_escrow_alert_run();
  if exists (select 1 from jsonb_array_elements_text(v_run1->'fired') x where x = 'open_dispute_aging')
     and exists (select 1 from jsonb_array_elements_text(v_run2->'suppressed') x where x = 'open_dispute_aging')
  then insert into _r values ('T6 anti-spam (fired→suppressed)', 'OK');
  else insert into _r values ('T6 anti-spam (fired→suppressed)',
       'FAIL run1='||(v_run1->>'fired')||' run2sup='||(v_run2->>'suppressed')); end if;

  -- T4 : reversed → notif acheteur + vendeur.
  update public.payments set transfer_state = 'reversed' where id = v_pay;
  select count(*) into c1 from public.notifications
   where destinataire_id = v_buyer and donnees->>'event' = 'reversed'
     and donnees->>'paymentId' = v_pay::text and titre = '↩️ Remboursement effectué';
  select count(*) into c2 from public.notifications
   where destinataire_id = v_seller and donnees->>'event' = 'reversed'
     and donnees->>'paymentId' = v_pay::text and titre = '↩️ Vente remboursée';
  if c1 >= 1 and c2 >= 1 then insert into _r values ('T4 reversed → notif acheteur + vendeur', 'OK');
  else insert into _r values ('T4 reversed → notif acheteur + vendeur', 'FAIL buyer='||c1||' seller='||c2); end if;

  -- T7 : montants inchangés.
  select amount_seller_ht into v_amt from public.payments where id = v_pay;
  if v_amt = v_tpl.amount_seller_ht then insert into _r values ('T7 montants inchangés', 'OK');
  else insert into _r values ('T7 montants inchangés', 'FAIL '||v_amt||'<>'||v_tpl.amount_seller_ht); end if;

  -- T9 : refund → PAS de doublon « Litige traité » (068 neutralisé sur
  -- resolved_refund ; seul le message « Remboursement effectué » 069 subsiste).
  update public.payment_disputes set status = 'resolved_refund', resolved_at = now()
   where id = v_disp and status = 'open';
  select count(*) into c1 from public.notifications
   where type = 'dispute_resolved' and donnees->>'paymentId' = v_pay::text;
  if c1 = 0 then insert into _r values ('T9 refund → pas de doublon "Litige traité"', 'OK');
  else insert into _r values ('T9 refund → pas de doublon "Litige traité"', 'FAIL c1='||c1); end if;

exception when others then
  insert into _r values ('EXCEPTION', sqlerrm);
end $$;

select test, verdict from _r order by test;
select case when exists (select 1 from _r where verdict not in ('OK','SKIP'))
            then '❌ FAIL' else '✅ ALL PASS' end as resultat;
