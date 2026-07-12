-- ============================================================================
-- HARNESS 091 — Concours mentions @user + notif de mention (L2-B)
-- ============================================================================
-- AUTO-PORTANT. À jouer sur un POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_091
--   psql -d eq_harness_091 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/091_concours_mention/harness.sql
--
-- Ce script :
--   1. schéma minimal (users/concours/concours_claims/notifications) + stub
--      auth.uid() + rôles + publication realtime ;
--   2. charge la VRAIE migration 082 (\ir) — base du fil + fill auteur ;
--   3. charge la VRAIE migration 091 (\ir) — mentions @user + notif ;
--   4. exécute les tests sous RLS ;
--   5. applique le rollback réel 091 et vérifie la propreté.
-- Chaque test : RAISE EXCEPTION en cas d'échec, RAISE NOTICE 'PASS …' sinon.
-- ============================================================================

\echo '=== [0] SETUP schéma minimal + stub auth + rôles + publication ==='

create schema if not exists auth;
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end $$;
grant usage on schema public to authenticated, anon;
grant usage on schema auth  to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

create table public.users (
  id uuid primary key, prenom text, nom text, pseudo text, initiales text, avatar_color text, role text
);
grant select on public.users to authenticated, anon;
create table public.concours (id uuid primary key, nom text);

create table public.concours_claims (concours_id uuid, organisateur_id uuid, status text);
create or replace function public.fn_org_owns_concours(p_concours_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.concours_claims c
    where c.concours_id = p_concours_id and c.status = 'approved'
      and c.organisateur_id = auth.uid()
  ) or exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
  );
$$;
grant execute on function public.fn_org_owns_concours(uuid) to authenticated;

-- Table notifications minimale (colonnes EXACTES écrites par 091) + CHECK état
-- 090 (que 091 va ÉLARGIR). Pas de RLS ici (testée ailleurs), pas de fill trigger
-- 015 (comme harness 083).
create table public.notifications (
  id               uuid primary key default gen_random_uuid(),
  destinataire_id  uuid not null,
  auteur_id        uuid,
  auteur_nom       text,
  auteur_pseudo    text,
  auteur_initiales text,
  auteur_couleur   text,
  type             text not null,
  titre            text not null,
  message          text not null,
  lu               boolean not null default false,
  donnees          jsonb not null default '{}'::jsonb,
  action_url       text,
  lien             text,
  created_at       timestamptz not null default now(),
  constraint notifications_type_check check (
    type = any (array[
      'stage_reservation','box_reservation','transport_reservation','course_request',
      'reservation_request','message','like','comment','mention','trajet_complet',
      'support_request','support_ack','support_resolved',
      'escrow_alert','escrow_prestation_done','escrow_release_soon','dispute_resolved',
      'dispute_opened','seller_onboarded','concours_reply','concours_presence'
    ])
  )
);

-- Acteurs. a1=Alice (auteur), a2=Bob (mentionné), ad=Admin (2e mentionné).
insert into public.users(id,prenom,nom,pseudo,initiales,avatar_color,role) values
  ('00000000-0000-0000-0000-0000000000a1','Alice','A','AliceCSO','AC','#ff0000','cavalier'),
  ('00000000-0000-0000-0000-0000000000a2','Bob','B','BobJumper','BB','#00ff00','cavalier'),
  ('00000000-0000-0000-0000-0000000000ad','Admin','Z','AdminZ','AD','#0000ff','admin');
insert into public.concours(id,nom) values ('00000000-0000-0000-0000-0000000000c1','CSO Deauville');
insert into public.concours_claims values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000ad','approved');

\echo '=== [1] APPLICATION migrations 082 puis 091 (fichiers réels) ==='
\ir ../../migrations/082_concours_discussions_lot1.sql
\ir ../../migrations/091_concours_mention_notify.sql

grant select, insert, update on public.concours_messages to authenticated;
grant select on public.concours_messages to anon;
grant select, insert, update, delete on public.concours_thread_reads to authenticated;

do $$ begin
  if exists (select 1 from pg_proc where proname='fn_notify_concours_mention')
     and exists (select 1 from pg_trigger where tgname='trg_zz_notify_concours_mention')
     and exists (select 1 from pg_indexes where indexname='uq_notifications_concours_mention')
  then raise notice 'PASS [1] objets 091 présents (fn + trigger + index idempotence)';
  else raise exception 'FAIL [1] objets 091 manquants'; end if;
end $$;

\echo '=== [2] CHECK ÉLARGI : concours_mention accepté ==='
do $$ begin
  insert into public.notifications(destinataire_id, auteur_id, type, titre, message, donnees)
    values ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1',
            'concours_mention','x','y', jsonb_build_object('message_id','00000000-0000-0000-0000-00000000e000'));
  raise notice 'PASS [2] type concours_mention accepté par le CHECK';
end $$;

\echo '=== [3] Mention @user → notif concours_mention au user cible ==='
-- Alice (a1) poste et mentionne Bob (a2) via jeton @[BobJumper](user:a2).
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
insert into public.concours_messages(id, concours_id, auteur_id, contenu) values
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000a1',
   'Salut @[BobJumper](user:00000000-0000-0000-0000-0000000000a2) tu viens ?');
reset role;
do $$ declare r record; begin
  select * into r from public.notifications
   where type='concours_mention' and (donnees->>'message_id')='00000000-0000-0000-0000-0000000000b1';
  if r.destinataire_id='00000000-0000-0000-0000-0000000000a2'
     and r.auteur_id='00000000-0000-0000-0000-0000000000a1'
     and r.donnees->>'mentioned_user_id'='00000000-0000-0000-0000-0000000000a2'
     and r.donnees->>'concours_id'='00000000-0000-0000-0000-0000000000c1'
     and r.action_url like '/concours/%/discussion'
     and r.message like 'AliceCSO vous a mentionné%'
  then raise notice 'PASS [3] notif mention → cible Bob, libellé auteur=AliceCSO';
  else raise exception 'FAIL [3] notif mention incorrecte (dest=% auteur=% uid=% url=% msg=%)',
    r.destinataire_id, r.auteur_id, r.donnees->>'mentioned_user_id', r.action_url, r.message; end if;
end $$;

\echo '=== [4] Auto-mention → AUCUNE notif ==='
-- Alice se mentionne elle-même.
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
insert into public.concours_messages(id, concours_id, auteur_id, contenu) values
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000a1',
   'note perso @[AliceCSO](user:00000000-0000-0000-0000-0000000000a1)');
reset role;
do $$ declare n int; begin
  select count(*) into n from public.notifications where (donnees->>'message_id')='00000000-0000-0000-0000-0000000000b2';
  if n=0 then raise notice 'PASS [4] auto-mention ne crée pas de notif';
  else raise exception 'FAIL [4] auto-mention a créé % notif(s)', n; end if;
end $$;

\echo '=== [5] Mention d''un UUID inexistant → AUCUNE notif ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
insert into public.concours_messages(id, concours_id, auteur_id, contenu) values
  ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000a1',
   'coucou @[Fantome](user:00000000-0000-0000-0000-0000000000ff)');
reset role;
do $$ declare n int; begin
  select count(*) into n from public.notifications where (donnees->>'message_id')='00000000-0000-0000-0000-0000000000b3';
  if n=0 then raise notice 'PASS [5] mention d''un user inexistant ignorée';
  else raise exception 'FAIL [5] notif créée pour user inexistant (n=%)', n; end if;
end $$;

\echo '=== [6] Même user mentionné 2× dans un message → 1 seule notif ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
insert into public.concours_messages(id, concours_id, auteur_id, contenu) values
  ('00000000-0000-0000-0000-0000000000b4','00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000a1',
   '@[BobJumper](user:00000000-0000-0000-0000-0000000000a2) et encore @[BobJumper](user:00000000-0000-0000-0000-0000000000a2)');
reset role;
do $$ declare n int; begin
  select count(*) into n from public.notifications
   where type='concours_mention' and (donnees->>'message_id')='00000000-0000-0000-0000-0000000000b4';
  if n=1 then raise notice 'PASS [6] double mention du même user → 1 notif';
  else raise exception 'FAIL [6] attendu 1 notif, obtenu %', n; end if;
end $$;

\echo '=== [7] Deux users distincts mentionnés → 2 notifs ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
insert into public.concours_messages(id, concours_id, auteur_id, contenu) values
  ('00000000-0000-0000-0000-0000000000b5','00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000a1',
   'cc @[BobJumper](user:00000000-0000-0000-0000-0000000000a2) et @[AdminZ](user:00000000-0000-0000-0000-0000000000ad)');
reset role;
do $$ declare n int; declare has_b boolean; declare has_ad boolean; begin
  select count(*) into n from public.notifications
   where type='concours_mention' and (donnees->>'message_id')='00000000-0000-0000-0000-0000000000b5';
  select exists(select 1 from public.notifications where type='concours_mention'
     and (donnees->>'message_id')='00000000-0000-0000-0000-0000000000b5'
     and destinataire_id='00000000-0000-0000-0000-0000000000a2') into has_b;
  select exists(select 1 from public.notifications where type='concours_mention'
     and (donnees->>'message_id')='00000000-0000-0000-0000-0000000000b5'
     and destinataire_id='00000000-0000-0000-0000-0000000000ad') into has_ad;
  if n=2 and has_b and has_ad then raise notice 'PASS [7] 2 mentions distinctes → 2 notifs (Bob + Admin)';
  else raise exception 'FAIL [7] n=% has_b=% has_ad=%', n, has_b, has_ad; end if;
end $$;

\echo '=== [8] Idempotence : (message_id, destinataire) unique pour concours_mention ==='
do $$ begin
  begin
    insert into public.notifications(destinataire_id, auteur_id, type, titre, message, donnees)
      values ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1',
              'concours_mention','x','y', jsonb_build_object('message_id','00000000-0000-0000-0000-0000000000b1'));
    raise exception 'FAIL [8] doublon (message_id,dest) aurait dû être rejeté';
  exception when unique_violation then raise notice 'PASS [8] index unique bloque le doublon (message_id,dest)'; end;
end $$;

\echo '=== [9] Message sans mention → AUCUNE notif mention ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
insert into public.concours_messages(id, concours_id, auteur_id, contenu) values
  ('00000000-0000-0000-0000-0000000000b6','00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000a1','juste un message sans arobase');
reset role;
do $$ declare n int; begin
  select count(*) into n from public.notifications
   where type='concours_mention' and (donnees->>'message_id')='00000000-0000-0000-0000-0000000000b6';
  if n=0 then raise notice 'PASS [9] message sans mention → 0 notif';
  else raise exception 'FAIL [9] % notif(s) inattendue(s)', n; end if;
end $$;

\echo '=== [10] ROLLBACK 091 + propreté + restauration du CHECK ==='
\ir ../../migrations/091_concours_mention_notify_rollback.sql
do $$ begin
  if exists (select 1 from pg_proc where proname='fn_notify_concours_mention')
     or exists (select 1 from pg_trigger where tgname='trg_zz_notify_concours_mention')
     or exists (select 1 from pg_indexes where indexname='uq_notifications_concours_mention')
  then raise exception 'FAIL [10] rollback incomplet (objets 091 subsistent)'; end if;
  raise notice 'PASS [10a] objets 091 retirés';
end $$;
-- type 'concours_mention' de nouveau rejeté ; purge effectuée par le rollback.
do $$ begin
  begin
    insert into public.notifications(destinataire_id, type, titre, message) values
      ('00000000-0000-0000-0000-0000000000a2','concours_mention','x','y');
    raise exception 'FAIL [10b] type concours_mention aurait dû redevenir invalide';
  exception when check_violation then raise notice 'PASS [10b] CHECK notifications.type restauré (état 090)'; end;
end $$;
-- concours_reply / concours_presence restent valides après rollback (non touchés).
do $$ begin
  insert into public.notifications(destinataire_id, auteur_id, type, titre, message, donnees) values
    ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1','concours_presence','x','y','{}'::jsonb);
  raise notice 'PASS [10c] concours_presence toujours valide (état 090 préservé)';
end $$;

\echo ''
\echo '============================================================'
\echo ' ✅ HARNESS 091 — TOUS LES TESTS PASSÉS (voir lignes PASS)'
\echo '============================================================'
