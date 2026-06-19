-- ============================================================================
-- HARNESS 083 — Concours discussions LOT 2 P1 (tags + réponses + notif réponse)
-- ============================================================================
-- AUTO-PORTANT. À jouer sur un POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_083
--   psql -d eq_harness_083 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/083_concours_discussions_lot2/harness.sql
--
-- Ce script :
--   1. schéma minimal (users/concours/concours_claims/notifications) + stub
--      auth.uid() + rôles + publication realtime ;
--   2. charge la VRAIE migration 082 (\ir) — base du fil ;
--   3. charge la VRAIE migration 083 (\ir) — tags + notif réponse ;
--   4. exécute les tests sous RLS ;
--   5. applique le rollback réel 083 et vérifie la propreté.
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

-- Table notifications minimale (colonnes EXACTES écrites par 083) + CHECK initial
-- (état 072) que 083 va ÉLARGIR. Pas de RLS ici (testée ailleurs).
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
      'dispute_opened','seller_onboarded'
    ])
  )
);

-- Acteurs.
insert into public.users(id,prenom,nom,pseudo,initiales,avatar_color,role) values
  ('00000000-0000-0000-0000-0000000000a1','Alice','A','AliceCSO','AC','#ff0000','cavalier'),
  ('00000000-0000-0000-0000-0000000000a2','Bob','B',null,'BB','#00ff00','cavalier'),
  ('00000000-0000-0000-0000-0000000000ad','Admin','Z','Admin','AD','#0000ff','admin'),
  ('00000000-0000-0000-0000-0000000000a9','Org','Z','OrgZ','OZ','#999999','organisateur');
insert into public.concours(id,nom) values ('00000000-0000-0000-0000-0000000000c1','CSO Deauville');
insert into public.concours_claims values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a9','approved');

\echo '=== [1] APPLICATION migrations 082 puis 083 (fichiers réels) ==='
\ir ../../migrations/082_concours_discussions_lot1.sql
\ir ../../migrations/083_concours_discussions_lot2.sql

grant select, insert, update on public.concours_messages to authenticated;
grant select on public.concours_messages to anon;
grant select, insert, update, delete on public.concours_thread_reads to authenticated;

do $$ begin
  if exists (select 1 from pg_proc where proname='fn_notify_concours_reply')
     and exists (select 1 from pg_trigger where tgname='trg_zz_notify_concours_reply')
     and exists (select 1 from pg_indexes where indexname='uq_notifications_concours_reply_msgid')
  then raise notice 'PASS [1] objets 083 présents (fn + trigger + index idempotence)';
  else raise exception 'FAIL [1] objets 083 manquants'; end if;
end $$;

\echo '=== [2] topic ÉLARGI : box + stage acceptés, garbage rejeté ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
do $$ begin
  insert into public.concours_messages(id, concours_id, auteur_id, contenu, topic) values
    ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','box dispo','box'),
    ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','stage WE','stage'),
    ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','van','transport');
  raise notice 'PASS [2a] topics box/stage/transport acceptés';
  begin
    insert into public.concours_messages(concours_id, auteur_id, contenu, topic) values
      ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','x','n_importe_quoi');
    raise exception 'FAIL [2b] topic invalide aurait dû être rejeté';
  exception when check_violation then raise notice 'PASS [2b] topic invalide rejeté'; end;
end $$;
reset role;

\echo '=== [3] Réponse (parent_id) → notif concours_reply au PARENT ==='
-- a1 a posté b1. Bob (a2) répond à b1.
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a2';
insert into public.concours_messages(id, concours_id, auteur_id, contenu, parent_id) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a2','Toujours dispo ?','00000000-0000-0000-0000-0000000000b1');
reset role;
do $$ declare r record; begin
  select * into r from public.notifications where type='concours_reply' and (donnees->>'message_id')='00000000-0000-0000-0000-0000000000d1';
  if r.destinataire_id='00000000-0000-0000-0000-0000000000a1'
     and r.auteur_id='00000000-0000-0000-0000-0000000000a2'
     and r.donnees->>'parent_id'='00000000-0000-0000-0000-0000000000b1'
     and r.donnees->>'concours_id'='00000000-0000-0000-0000-0000000000c1'
     and r.action_url like '/concours/%/discussion'
     and r.message like 'Bob a répondu%'
  then raise notice 'PASS [3] notif réponse → auteur parent (a1), libellé répondeur=Bob';
  else raise exception 'FAIL [3] notif réponse incorrecte (dest=% auteur=% parent=% url=% msg=%)',
    r.destinataire_id, r.auteur_id, r.donnees->>'parent_id', r.action_url, r.message; end if;
end $$;

\echo '=== [4] Auto-réponse → AUCUNE notif ==='
-- a1 répond à son propre message b1.
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
insert into public.concours_messages(id, concours_id, auteur_id, contenu, parent_id) values
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','je précise','00000000-0000-0000-0000-0000000000b1');
reset role;
do $$ declare n int; begin
  select count(*) into n from public.notifications where (donnees->>'message_id')='00000000-0000-0000-0000-0000000000d2';
  if n=0 then raise notice 'PASS [4] auto-réponse ne crée pas de notif';
  else raise exception 'FAIL [4] auto-réponse a créé % notif(s)', n; end if;
end $$;

\echo '=== [5] Réponse à un parent SUPPRIMÉ → AUCUNE notif ==='
-- a1 supprime b3 (transport), puis a2 y répond.
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
update public.concours_messages set is_deleted=true where id='00000000-0000-0000-0000-0000000000b3';
reset role;
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a2';
insert into public.concours_messages(id, concours_id, auteur_id, contenu, parent_id) values
  ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a2','encore dispo ?','00000000-0000-0000-0000-0000000000b3');
reset role;
do $$ declare n int; begin
  select count(*) into n from public.notifications where (donnees->>'message_id')='00000000-0000-0000-0000-0000000000d3';
  if n=0 then raise notice 'PASS [5] réponse à parent supprimé ne crée pas de notif';
  else raise exception 'FAIL [5] notif créée pour parent supprimé (n=%)', n; end if;
end $$;

\echo '=== [6] Message racine (sans parent) → AUCUNE notif réponse ==='
do $$ declare n int; begin
  -- b1/b2/b3 sont des racines → 0 notif concours_reply les concernant.
  select count(*) into n from public.notifications
    where type='concours_reply' and (donnees->>'message_id') in
      ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b3');
  if n=0 then raise notice 'PASS [6] messages racines ne déclenchent pas de notif réponse';
  else raise exception 'FAIL [6] % notif(s) pour des racines', n; end if;
end $$;

\echo '=== [7] Idempotence : 1 seule notif concours_reply par message_id ==='
do $$ begin
  begin
    insert into public.notifications(destinataire_id, auteur_id, type, titre, message, donnees)
      values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','concours_reply','x','y',
              jsonb_build_object('message_id','00000000-0000-0000-0000-0000000000d1'));
    raise exception 'FAIL [7] doublon concours_reply aurait dû être rejeté';
  exception when unique_violation then raise notice 'PASS [7] index unique bloque le doublon (message_id)'; end;
end $$;

\echo '=== [8] ROLLBACK 083 + propreté + restauration des CHECKs ==='
\ir ../../migrations/083_concours_discussions_lot2_rollback.sql
do $$ begin
  if exists (select 1 from pg_proc where proname='fn_notify_concours_reply')
     or exists (select 1 from pg_trigger where tgname='trg_zz_notify_concours_reply')
     or exists (select 1 from pg_indexes where indexname='uq_notifications_concours_reply_msgid')
  then raise exception 'FAIL [8] rollback incomplet (objets 083 subsistent)'; end if;
  raise notice 'PASS [8a] objets 083 retirés';
end $$;
-- topic 'box' de nouveau rejeté.
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
do $$ begin
  begin
    insert into public.concours_messages(concours_id, auteur_id, contenu, topic) values
      ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','x','box');
    raise exception 'FAIL [8b] topic box aurait dû redevenir invalide';
  exception when check_violation then raise notice 'PASS [8b] CHECK topic restauré (box rejeté)'; end;
end $$;
reset role;
-- type 'concours_reply' de nouveau rejeté.
do $$ begin
  begin
    insert into public.notifications(destinataire_id, type, titre, message) values
      ('00000000-0000-0000-0000-0000000000a1','concours_reply','x','y');
    raise exception 'FAIL [8c] type concours_reply aurait dû redevenir invalide';
  exception when check_violation then raise notice 'PASS [8c] CHECK notifications.type restauré'; end;
end $$;

\echo ''
\echo '============================================================'
\echo ' ✅ HARNESS 083 — TOUS LES TESTS PASSÉS (voir lignes PASS)'
\echo '============================================================'
