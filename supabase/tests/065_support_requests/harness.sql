-- ════════════════════════════════════════════════════════════════════════
-- HARNESS 065 — support_requests (NON destructif).
--
-- Corps SANS begin/rollback : destiné à être exécuté DANS une transaction
-- annulée. Deux usages :
--   (a) Migration NON appliquée (validation pré-merge) :
--       ( echo 'begin;'; cat supabase/migrations/065_support_requests.sql; \
--         cat supabase/tests/065_support_requests/harness.sql; echo 'rollback;' ) \
--         > /tmp/h065.sql && supabase db query --linked -f /tmp/h065.sql
--   (b) Migration déjà appliquée :
--       ( echo 'begin;'; cat .../harness.sql; echo 'rollback;' ) | supabase db query --linked -f -
--
-- Couvre : ref serveur, fan-out admin, accusé user, résolution (notif +
-- resolved_at + non-duplication), RLS user/admin, non-régression du CHECK type.
-- ════════════════════════════════════════════════════════════════════════

create temp table _r(test text, verdict text) on commit drop;
-- Les blocs RLS écrivent dans _r sous le rôle `authenticated` : droit requis.
grant insert, select on _r to public;

-- ── Bloc 1 : cycle complet création → résolution (exécuté comme postgres,
-- RLS bypass owner ; les triggers SECURITY DEFINER fonctionnent quand même). ──
do $$
declare
  v_admin uuid; v_user uuid; v_admins int; v_sid uuid;
  v_admin_notifs int; v_acks int; v_resolved int;
begin
  select id into v_admin from public.users where role = 'admin' limit 1;
  select count(*) into v_admins from public.users where role = 'admin';
  select id into v_user from public.users where role <> 'admin' order by created_at limit 1;
  if v_user is null then select id into v_user from public.users limit 1; end if;

  -- T1 : insertion ticket → ref EQ-REC serveur.
  insert into public.support_requests(user_id, subject, description, category)
  values (v_user, 'Objet de test', 'Description de test réclamation', 'paiement')
  returning id into v_sid;

  if exists (select 1 from public.support_requests
             where id = v_sid and ref ~ '^EQ-REC-[0-9A-Z]{8}$') then
    insert into _r values ('T1 ref EQ-REC serveur générée', 'OK');
  else
    insert into _r values ('T1 ref EQ-REC serveur générée', 'FAIL');
  end if;

  -- T2 : fan-out admin (1 notif support_request par admin).
  select count(*) into v_admin_notifs from public.notifications
   where type = 'support_request' and (donnees->>'support_id') = v_sid::text;
  if v_admin_notifs = v_admins and v_admins > 0 then
    insert into _r values (format('T2 fan-out admin (x%s)', v_admins), 'OK');
  else
    insert into _r values ('T2 fan-out admin', format('FAIL (%s notif / %s admins)', v_admin_notifs, v_admins));
  end if;

  -- T3 : accusé réception user.
  select count(*) into v_acks from public.notifications
   where type = 'support_ack' and destinataire_id = v_user and (donnees->>'support_id') = v_sid::text;
  insert into _r values ('T3 accusé réception user',
    case when v_acks = 1 then 'OK' else format('FAIL (%s)', v_acks) end);

  -- T4 : résolution → resolved_at posé.
  update public.support_requests set status = 'in_progress' where id = v_sid;
  update public.support_requests
     set status = 'resolved', resolution_message = 'Réglé : remboursement effectué.'
   where id = v_sid;
  insert into _r values ('T4 resolved_at posé',
    case when exists (select 1 from public.support_requests where id = v_sid and resolved_at is not null)
         then 'OK' else 'FAIL' end);

  -- T5 : notif résolution user.
  select count(*) into v_resolved from public.notifications
   where type = 'support_resolved' and destinataire_id = v_user and (donnees->>'support_id') = v_sid::text;
  insert into _r values ('T5 notif résolution user',
    case when v_resolved = 1 then 'OK' else format('FAIL (%s)', v_resolved) end);

  -- T6 : ré-update sans changement de statut → pas de notif dupliquée.
  update public.support_requests set resolution_message = 'maj note' where id = v_sid;
  select count(*) into v_resolved from public.notifications
   where type = 'support_resolved' and (donnees->>'support_id') = v_sid::text;
  insert into _r values ('T6 résolution non dupliquée',
    case when v_resolved = 1 then 'OK' else format('FAIL (%s)', v_resolved) end);
end $$;

-- ── Bloc 2 : RLS user (insert own OK, spoof bloqué, visibilité limitée) ──
do $$
declare v_user uuid; v_user2 uuid; v_visible_other int;
begin
  select id into v_user  from public.users where role <> 'admin' order by created_at limit 1;
  select id into v_user2 from public.users where role <> 'admin' and id <> v_user order by created_at limit 1;
  if v_user is null then select id into v_user from public.users limit 1; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user::text)::text, true);
  set local role authenticated;

  -- T7 : insert de son propre ticket → OK.
  begin
    insert into public.support_requests(user_id, subject, description) values (v_user, 'rls own', 'd');
    insert into _r values ('T7 RLS insert own', 'OK');
  exception when others then insert into _r values ('T7 RLS insert own', 'FAIL (' || sqlerrm || ')'); end;

  -- T8 : insert au nom d'un autre user → with_check bloque.
  if v_user2 is not null then
    begin
      insert into public.support_requests(user_id, subject, description) values (v_user2, 'rls spoof', 'd');
      insert into _r values ('T8 RLS insert spoof bloqué', 'FAIL (accepté à tort)');
    exception when others then insert into _r values ('T8 RLS insert spoof bloqué', 'OK'); end;
  else
    insert into _r values ('T8 RLS insert spoof bloqué', 'SKIP (1 seul user)');
  end if;

  -- T9 : user ne voit QUE ses tickets.
  select count(*) into v_visible_other from public.support_requests where user_id <> v_user;
  insert into _r values ('T9 RLS user voit seulement les siens',
    case when v_visible_other = 0 then 'OK' else format('FAIL (%s autres visibles)', v_visible_other) end);

  reset role;
end $$;

-- ── Bloc 3 : RLS admin (voit tout) ──
do $$
declare v_admin uuid; v_total int; v_seen int;
begin
  select id into v_admin from public.users where role = 'admin' limit 1;
  select count(*) into v_total from public.support_requests;  -- postgres = vrai total

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  set local role authenticated;
  select count(*) into v_seen from public.support_requests;   -- admin via is_app_admin()
  reset role;

  insert into _r values ('T10 RLS admin voit tout',
    case when v_seen = v_total and v_total > 0 then 'OK' else format('FAIL (admin %s / total %s)', v_seen, v_total) end);
end $$;

-- ── Bloc 4 : non-régression notifications_type_check ──
do $$
declare v_user uuid;
begin
  select id into v_user from public.users limit 1;

  begin
    insert into public.notifications(destinataire_id, type, titre, message)
    values (v_user, 'mention', 't', 'm');
    insert into _r values ('T11 type existant (mention) accepté', 'OK');
  exception when others then insert into _r values ('T11 type existant (mention) accepté', 'FAIL (' || sqlerrm || ')'); end;

  begin
    insert into public.notifications(destinataire_id, type, titre, message)
    values (v_user, 'support_request', 't', 'm');
    insert into _r values ('T12 nouveau type support accepté', 'OK');
  exception when others then insert into _r values ('T12 nouveau type support accepté', 'FAIL (' || sqlerrm || ')'); end;

  begin
    insert into public.notifications(destinataire_id, type, titre, message)
    values (v_user, 'zzz_bogus', 't', 'm');
    insert into _r values ('T13 type bogus rejeté', 'FAIL (accepté à tort)');
  exception when others then insert into _r values ('T13 type bogus rejeté', 'OK'); end;
end $$;

select test, verdict from _r order by test;
