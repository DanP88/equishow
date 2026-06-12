-- ════════════════════════════════════════════════════════════════════════
-- HARNESS 072 — notif « Compte vendeur validé » (NON destructif, tx annulée).
--
--   (a) Migration NON appliquée (pré-merge) :
--       ( echo 'begin;'; cat supabase/migrations/072_notify_seller_onboarded.sql; \
--         cat supabase/tests/072_notify_seller_onboarded/harness.sql; echo 'rollback;' ) \
--         | supabase db query --linked -f -
--   (b) Migration déjà appliquée :
--       ( echo 'begin;'; cat .../harness.sql; echo 'rollback;' ) | supabase db query --linked -f -
--
-- Prouve : (T0) le CHECK accepte 'seller_onboarded' ; (T1) passage
--   false/null → (true,true) = exactement 1 notif seller_onboarded ;
--   (T2) UPDATE no-op (déjà true,true) = 0 doublon ; (T3) passage partiel
--   (charges seul) = 0 notif.
-- ════════════════════════════════════════════════════════════════════════
create temp table _r(test text, verdict text) on commit drop;

do $$
declare
  v_user uuid;
  c0 int; c1 int; c2 int; c3 int;
begin
  select id into v_user from public.users limit 1;
  if v_user is null then
    insert into _r values ('PRE aucun user', 'SKIP'); return;
  end if;

  -- T0 : le CHECK accepte le nouveau type.
  begin
    insert into public.notifications (destinataire_id, type, titre, message)
    values (v_user, 'seller_onboarded', 't0', 't0');
    insert into _r values ('T0 CHECK accepte seller_onboarded', 'OK');
  exception when check_violation then
    insert into _r values ('T0 CHECK accepte seller_onboarded', 'FAIL check_violation');
  end;

  -- Point de départ propre : les deux flags à false (cette transition ne fire pas,
  -- car le WHEN exige new = (true,true)).
  update public.users
     set stripe_charges_enabled = false, stripe_payouts_enabled = false
   where id = v_user;
  select count(*) into c0 from public.notifications
   where destinataire_id = v_user and type = 'seller_onboarded'
     and donnees->>'event' = 'seller_onboarded';

  -- T1 : false/false → true/true = +1 notif.
  update public.users
     set stripe_charges_enabled = true, stripe_payouts_enabled = true
   where id = v_user;
  select count(*) into c1 from public.notifications
   where destinataire_id = v_user and type = 'seller_onboarded'
     and donnees->>'event' = 'seller_onboarded';
  if c1 = c0 + 1 then insert into _r values ('T1 false->true,true = 1 notif', 'OK');
  else insert into _r values ('T1 false->true,true = 1 notif', 'FAIL delta='||(c1-c0)); end if;

  -- T2 : UPDATE no-op (déjà true,true) = 0 nouvelle notif.
  update public.users
     set stripe_charges_enabled = true, stripe_payouts_enabled = true
   where id = v_user;
  select count(*) into c2 from public.notifications
   where destinataire_id = v_user and type = 'seller_onboarded'
     and donnees->>'event' = 'seller_onboarded';
  if c2 = c1 then insert into _r values ('T2 no-op = 0 doublon', 'OK');
  else insert into _r values ('T2 no-op = 0 doublon', 'FAIL delta='||(c2-c1)); end if;

  -- T3 : passage partiel (charges seul) = 0 notif.
  update public.users set stripe_charges_enabled = false, stripe_payouts_enabled = false where id = v_user;
  update public.users set stripe_charges_enabled = true,  stripe_payouts_enabled = false where id = v_user;
  select count(*) into c3 from public.notifications
   where destinataire_id = v_user and type = 'seller_onboarded'
     and donnees->>'event' = 'seller_onboarded';
  if c3 = c2 then insert into _r values ('T3 partiel (charges seul) = 0 notif', 'OK');
  else insert into _r values ('T3 partiel (charges seul) = 0 notif', 'FAIL delta='||(c3-c2)); end if;

exception when others then
  insert into _r values ('EXCEPTION', sqlerrm);
end $$;

select test, verdict from _r order by test;
select case when exists (select 1 from _r where verdict not in ('OK','SKIP'))
            then '❌ FAIL' else '✅ ALL PASS' end as resultat;
