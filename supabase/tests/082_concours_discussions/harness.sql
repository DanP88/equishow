-- ============================================================================
-- HARNESS 082 — Concours discussions LOT 1 (fil public + reads + soft delete)
-- ============================================================================
-- AUTO-PORTANT. À jouer sur un POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_082
--   psql -d eq_harness_082 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/082_concours_discussions/harness.sql
--
-- Ce script :
--   1. schéma minimal (users/concours/concours_claims) + stub auth.uid()
--      + rôles authenticated/anon + publication supabase_realtime vide ;
--   2. stub fn_org_owns_concours (signature identique à 076) ;
--   3. charge la VRAIE migration 082 via \ir ;
--   4. exécute les tests sous RLS ;
--   5. applique le rollback réel et vérifie la propreté.
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

-- Publication realtime vide (082 y ajoute concours_messages).
do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Tables minimales (colonnes EXACTES lues par 082).
create table public.users (
  id uuid primary key, prenom text, pseudo text, initiales text, avatar_color text, role text
);
grant select on public.users to authenticated, anon;
create table public.concours (id uuid primary key, nom text);

-- fn_org_owns_concours : stub fidèle (claim approved OU admin).
create table public.concours_claims (concours_id uuid, organisateur_id uuid, status text);
create or replace function public.fn_org_owns_concours(p_concours_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.concours_claims
                  where concours_id=p_concours_id and organisateur_id=auth.uid() and status='approved')
      or exists (select 1 from public.users u where u.id=auth.uid() and u.role='admin');
$$;
grant execute on function public.fn_org_owns_concours(uuid) to authenticated;

-- Acteurs.
insert into public.users(id,prenom,pseudo,initiales,avatar_color,role) values
  ('00000000-0000-0000-0000-0000000000a1','Alice','AliceCSO','AC','#ff0000','cavalier'),
  ('00000000-0000-0000-0000-0000000000a2','Bob',  null,      'BB','#00ff00','cavalier'),  -- pseudo null → fallback prénom
  ('00000000-0000-0000-0000-0000000000ad','Admin','Admin',   'AD','#0000ff','admin'),
  ('00000000-0000-0000-0000-0000000000a9','Org',  'OrgZ',    'OZ','#999999','organisateur'),
  ('00000000-0000-0000-0000-0000000000bb','Rand', 'Rando',   'RD','#123456','cavalier');

insert into public.concours(id,nom) values ('00000000-0000-0000-0000-0000000000c1','CSO Deauville');
-- org a9 propriétaire approuvé de c1.
insert into public.concours_claims values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a9','approved');

\echo '=== [1] APPLICATION migration 082 (fichier réel) ==='
\ir ../../migrations/082_concours_discussions_lot1.sql

-- Grants applicatifs (Supabase les pose via default privileges ; local = manuel).
grant select, insert, update on public.concours_messages to authenticated;
grant select on public.concours_messages to anon;
grant select, insert, update, delete on public.concours_thread_reads to authenticated;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='concours_messages')
     and exists (select 1 from information_schema.tables where table_schema='public' and table_name='concours_thread_reads')
     and exists (select 1 from pg_proc where proname='fn_concours_thread_unread')
     and exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='concours_messages')
  then raise notice 'PASS [1] objets 082 présents (2 tables + fn unread + realtime)';
  else raise exception 'FAIL [1] objets 082 manquants'; end if;
end $$;

\echo '=== [2] Insert message + fill auteur (pseudo/initiales/couleur/role serveur) ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
insert into public.concours_messages(id, concours_id, auteur_id, contenu)
  values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','Qui vient à Deauville ?');
do $$ declare r record; begin
  select * into r from public.concours_messages where id='00000000-0000-0000-0000-0000000000f1';
  if r.auteur_pseudo='AliceCSO' and r.auteur_initiales='AC' and r.auteur_couleur='#ff0000' and r.auteur_role='cavalier'
  then raise notice 'PASS [2] snapshot identité rempli par trigger';
  else raise exception 'FAIL [2] fill auteur incorrect (pseudo=% init=% col=% role=%)', r.auteur_pseudo,r.auteur_initiales,r.auteur_couleur,r.auteur_role; end if;
end $$;
reset role;
-- fallback pseudo = prénom quand pseudo NULL.
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a2';
insert into public.concours_messages(id, concours_id, auteur_id, contenu)
  values ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a2','Je propose un van.');
do $$ declare p text; begin
  select auteur_pseudo into p from public.concours_messages where id='00000000-0000-0000-0000-0000000000f2';
  if p='Bob' then raise notice 'PASS [2] fallback pseudo→prénom';
  else raise exception 'FAIL [2] fallback pseudo=% (att Bob)', p; end if;
end $$;
reset role;

\echo '=== [3] Insert pour autrui bloqué (RLS auteur_id=auth.uid()) ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
do $$ begin
  begin
    insert into public.concours_messages(concours_id, auteur_id, contenu)
      values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a2','usurpation');
    raise exception 'FAIL [3] insert cross-user aurait dû être bloqué';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS [3] insert cross-user bloqué (RLS)';
  end;
end $$;
reset role;

\echo '=== [4] Lecture publique (anon voit le fil) ==='
set role anon; set test.uid='';
do $$ begin
  if (select count(*) from public.concours_messages where concours_id='00000000-0000-0000-0000-0000000000c1')=2
  then raise notice 'PASS [4] anon lit le fil public (2 messages)';
  else raise exception 'FAIL [4] anon voit % messages (att 2)', (select count(*) from public.concours_messages); end if;
end $$;
reset role;

\echo '=== [5] Contraintes contenu + topic ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
do $$ begin
  begin
    insert into public.concours_messages(concours_id, auteur_id, contenu) values
      ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','');
    raise exception 'FAIL [5] contenu vide aurait dû être rejeté';
  exception when check_violation then raise notice 'PASS [5a] contenu vide rejeté'; end;
  begin
    insert into public.concours_messages(concours_id, auteur_id, contenu, topic) values
      ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','x','invalide');
    raise exception 'FAIL [5] topic invalide aurait dû être rejeté';
  exception when check_violation then raise notice 'PASS [5b] topic invalide rejeté'; end;
  -- topic valide OK.
  insert into public.concours_messages(id, concours_id, auteur_id, contenu, topic) values
    ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','van dispo','transport');
  raise notice 'PASS [5c] topic valide accepté';
end $$;
reset role;

\echo '=== [6] fn_concours_thread_unread (exclut soi, > last_read_at, exclut supprimés) ==='
-- a1 a posté m01,m03 ; a2 a posté m02. Du point de vue de a1, non-lus = messages
-- des AUTRES (m02) sans read row → 1.
do $$ declare n int; begin
  perform set_config('test.uid','00000000-0000-0000-0000-0000000000a1', true);
  n := public.fn_concours_thread_unread('00000000-0000-0000-0000-0000000000c1');
  if n=1 then raise notice 'PASS [6a] unread a1 = 1 (m02 d''autrui)';
  else raise exception 'FAIL [6a] unread a1=% (att 1)', n; end if;
end $$;
-- a1 marque lu (now) → unread 0.
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
insert into public.concours_thread_reads(concours_id,user_id,last_read_at)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1', now())
  on conflict (concours_id,user_id) do update set last_read_at=excluded.last_read_at;
reset role;
do $$ declare n int; begin
  perform set_config('test.uid','00000000-0000-0000-0000-0000000000a1', true);
  n := public.fn_concours_thread_unread('00000000-0000-0000-0000-0000000000c1');
  if n=0 then raise notice 'PASS [6b] unread a1 = 0 après lecture';
  else raise exception 'FAIL [6b] unread a1=% (att 0)', n; end if;
end $$;

\echo '=== [7] thread_reads RLS own-only ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a2';
do $$ begin
  begin
    insert into public.concours_thread_reads(concours_id,user_id) values
      ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL [7] read cross-user aurait dû être bloqué';
  exception when insufficient_privilege or check_violation then raise notice 'PASS [7] read cross-user bloqué'; end;
end $$;
reset role;

\echo '=== [8] Soft delete par AUTEUR (contenu vidé + stamp) ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
update public.concours_messages set is_deleted=true where id='00000000-0000-0000-0000-0000000000f1';
do $$ declare r record; begin
  select * into r from public.concours_messages where id='00000000-0000-0000-0000-0000000000f1';
  if r.is_deleted and r.contenu='' and r.deleted_at is not null and r.deleted_by='00000000-0000-0000-0000-0000000000a1'
  then raise notice 'PASS [8] soft delete auteur (contenu vidé + stamp)';
  else raise exception 'FAIL [8] soft delete incorrect (del=% contenu=% at=% by=%)', r.is_deleted,r.contenu,r.deleted_at,r.deleted_by; end if;
end $$;
reset role;

\echo '=== [9] Soft delete par ORG propriétaire (message d''autrui) ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a9';
update public.concours_messages set is_deleted=true where id='00000000-0000-0000-0000-0000000000f2';
do $$ declare n int; begin
  select count(*) into n from public.concours_messages where id='00000000-0000-0000-0000-0000000000f2' and is_deleted;
  if n=1 then raise notice 'PASS [9] org propriétaire peut soft delete un message tiers';
  else raise exception 'FAIL [9] org n''a pas pu supprimer (n=%)', n; end if;
end $$;
reset role;

\echo '=== [10] Soft delete par TIERS (ni auteur ni org/admin) bloqué ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000bb';
do $$ declare n int; begin
  update public.concours_messages set is_deleted=true where id='00000000-0000-0000-0000-0000000000f3';
  get diagnostics n = row_count;
  if n=0 then raise notice 'PASS [10] tiers ne peut pas supprimer (0 ligne RLS)';
  else raise exception 'FAIL [10] tiers a supprimé % ligne(s)', n; end if;
end $$;
reset role;

\echo '=== [11] Hard delete bloqué (aucune policy DELETE) ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
do $$ declare n int; begin
  delete from public.concours_messages where id='00000000-0000-0000-0000-0000000000f3';
  get diagnostics n = row_count;
  if n=0 then raise notice 'PASS [11] hard delete bloqué (0 ligne)';
  else raise exception 'FAIL [11] hard delete a retiré % ligne(s)', n; end if;
exception when insufficient_privilege then raise notice 'PASS [11] hard delete bloqué (insufficient_privilege)';
end $$;
reset role;

\echo '=== [12] unread ignore les supprimés ==='
-- m02 (d'autrui) supprimé par org en [9]. a2 (auteur de m02) lit le fil : m01 supprimé,
-- m03 d'a1 non supprimé → non-lu pour a2 = 1 (m03), pas m01 (supprimé).
do $$ declare n int; begin
  perform set_config('test.uid','00000000-0000-0000-0000-0000000000a2', true);
  n := public.fn_concours_thread_unread('00000000-0000-0000-0000-0000000000c1');
  if n=1 then raise notice 'PASS [12] unread exclut messages supprimés (a2=1)';
  else raise exception 'FAIL [12] unread a2=% (att 1)', n; end if;
end $$;

\echo '=== [13] ROLLBACK 082 + propreté ==='
reset role;
\ir ../../migrations/082_concours_discussions_lot1_rollback.sql
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name in ('concours_messages','concours_thread_reads'))
     or exists (select 1 from pg_proc where proname='fn_concours_thread_unread')
     or exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='concours_messages')
  then raise exception 'FAIL [13] rollback incomplet (objets 082 subsistent)';
  else raise notice 'PASS [13] rollback propre'; end if;
end $$;

\echo ''
\echo '============================================================'
\echo ' ✅ HARNESS 082 — TOUS LES TESTS PASSÉS (voir lignes PASS)'
\echo '============================================================'
