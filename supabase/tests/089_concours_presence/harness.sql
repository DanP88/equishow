-- ============================================================================
-- HARNESS 089 — CONCOURS PRESENCE · PR2a
-- ============================================================================
-- AUTO-PORTANT. POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_089
--   psql -d eq_harness_089 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/089_concours_presence/harness.sql
--
--   1. schéma minimal (users/concours/chevaux) + stub auth.uid() + rôles ;
--   2. charge 088 (fn_people_i_know) PUIS 089 (fichiers réels) ;
--   3. tests contraintes + RLS + RPC intersection + anti-énumération ;
--   4. rollback 089 réel + vérif propreté.
-- Chaque test échoué => RAISE EXCEPTION ; sinon RAISE NOTICE 'PASS …'.
-- ============================================================================

\set ON_ERROR_STOP on
\echo '=== [0] SETUP schéma minimal + auth + rôles + seed ==='

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

create table public.users (
  id uuid primary key, prenom text, pseudo text, initiales text,
  avatar_color text, role text not null default 'cavalier'
);
grant select on public.users to authenticated, anon;
create table public.concours (id uuid primary key, nom text);
create table public.chevaux (id uuid primary key, proprietaire_id uuid, nom text not null);

insert into public.users(id, prenom, pseudo, initiales, avatar_color, role) values
  ('00000000-0000-0000-0000-0000000000a1','Alice','AliceCSO','AC','#ff0000','cavalier'),
  ('00000000-0000-0000-0000-0000000000a2','Bob',  null,      'BB','#00ff00','coach'),
  ('00000000-0000-0000-0000-0000000000a3','Carol','CarolEqui','CE','#0000ff','cavalier'),
  ('00000000-0000-0000-0000-0000000000ad','Admin','Admin',   'AD','#123456','admin');
insert into public.concours(id, nom) values ('00000000-0000-0000-0000-0000000000c1','CSO Deauville');
insert into public.chevaux(id, proprietaire_id, nom) values
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a2','Quorida');

\echo '=== [1] APPLICATION migration 088 (fn_people_i_know) ==='
\ir ../../migrations/088_user_follows_graph.sql
grant select, insert, delete on public.user_follows to authenticated;
-- a1 suit a2 (relation following) → a1 "connaît" a2. a1 ne connaît PAS a3.
insert into public.user_follows(follower_id, followee_id)
  values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2');

\echo '=== [2] APPLICATION migration 089 (concours_presence) ==='
\ir ../../migrations/089_concours_presence.sql
grant select, insert, update, delete on public.concours_presence to authenticated;

\echo '=== [3] TEST : déclarer SA présence (INSERT own sous RLS) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
insert into public.concours_presence(concours_id, user_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a2',
          '00000000-0000-0000-0000-0000000000f1');
reset role;
do $$ begin
  if not exists (select 1 from public.concours_presence
    where concours_id='00000000-0000-0000-0000-0000000000c1'
      and user_id='00000000-0000-0000-0000-0000000000a2')
  then raise exception 'FAIL: présence non créée'; end if;
  raise notice 'PASS: a2 a déclaré sa présence (avec cheval)';
end $$;

\echo '=== [4] TEST : INSERT pour autrui rejeté par RLS ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
insert into public.concours_presence(concours_id, user_id)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a2');
reset role;
\set ON_ERROR_STOP on
do $$ begin
  raise notice 'PASS: INSERT présence pour autrui bloqué (RLS) — voir éventuelle ERROR ci-dessus';
end $$;

\echo '=== [5] TEST : status invalide rejeté (check) ==='
do $$ begin
  begin
    insert into public.concours_presence(concours_id, user_id, status)
      values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a3','peut-etre');
    raise exception 'FAIL: status invalide accepté';
  exception when check_violation then raise notice 'PASS: status invalide rejeté';
  end;
end $$;

\echo '=== [6] TEST : SELECT fonctionne pour authenticated ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
do $$ declare n int; begin
  select count(*) into n from public.concours_presence;
  raise notice 'PASS: SELECT authenticated OK (% lignes)', n;
end $$;
reset role;

\echo '=== [7] SEED présences pour la RPC : a3 présent (inconnu), a1 présent (self) ==='
insert into public.concours_presence(concours_id, user_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1');

\echo '=== [8] TEST : fn_concours_known_attendees = intersection (connus ∩ présents) ==='
do $$
declare r record; n int; has_a2 bool := false; has_a3 bool := false; has_a1 bool := false;
begin
  n := 0;
  for r in select * from public.fn_concours_known_attendees(
             '00000000-0000-0000-0000-0000000000c1',
             '00000000-0000-0000-0000-0000000000a1') loop
    n := n + 1;
    if r.user_id = '00000000-0000-0000-0000-0000000000a2' then
      has_a2 := true;
      if r.relation <> 'following' then raise exception 'FAIL: relation a2 = % (attendu following)', r.relation; end if;
      if r.cheval_nom <> 'Quorida' then raise exception 'FAIL: cheval a2 = % (attendu Quorida)', coalesce(r.cheval_nom,'NULL'); end if;
    end if;
    if r.user_id = '00000000-0000-0000-0000-0000000000a3' then has_a3 := true; end if;
    if r.user_id = '00000000-0000-0000-0000-0000000000a1' then has_a1 := true; end if;
  end loop;
  if not has_a2 then raise exception 'FAIL: a2 (connu+présent) absent du résultat'; end if;
  if has_a3 then raise exception 'FAIL: a3 (présent mais INCONNU) ne doit pas apparaître'; end if;
  if has_a1 then raise exception 'FAIL: a1 (self) ne doit pas apparaître'; end if;
  if n <> 1 then raise exception 'FAIL: % lignes (attendu 1 = a2 seul)', n; end if;
  raise notice 'PASS: RPC rend a2 seul (connu+présent, cheval Quorida, relation following)';
end $$;

\echo '=== [9] TEST : B (a3) ne peut pas supprimer la présence de A (a2) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
delete from public.concours_presence
  where concours_id='00000000-0000-0000-0000-0000000000c1'
    and user_id='00000000-0000-0000-0000-0000000000a2';   -- RLS => 0 ligne
reset role;
do $$ begin
  if not exists (select 1 from public.concours_presence
    where concours_id='00000000-0000-0000-0000-0000000000c1'
      and user_id='00000000-0000-0000-0000-0000000000a2')
  then raise exception 'FAIL: a3 a supprimé la présence de a2'; end if;
  raise notice 'PASS: delete d''autrui sans effet (RLS)';
end $$;

\echo '=== [10] TEST : retirer SA présence (DELETE own) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
delete from public.concours_presence
  where concours_id='00000000-0000-0000-0000-0000000000c1'
    and user_id='00000000-0000-0000-0000-0000000000a2';
reset role;
do $$ begin
  if exists (select 1 from public.concours_presence
    where concours_id='00000000-0000-0000-0000-0000000000c1'
      and user_id='00000000-0000-0000-0000-0000000000a2')
  then raise exception 'FAIL: delete own sans effet'; end if;
  raise notice 'PASS: a2 a retiré sa présence';
end $$;

\echo '=== [11] TEST : anti-énumération RPC — viewer<>auth.uid() (non admin) rejeté ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
select * from public.fn_concours_known_attendees(
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000a1');
reset role;
\set ON_ERROR_STOP on
\echo '   (une ERROR "viewer doit être auth.uid()" ci-dessus = comportement attendu)'

\echo '=== [12] ROLLBACK 089 réel + vérif propreté ==='
\ir ../../migrations/089_concours_presence_rollback.sql
do $$ begin
  if to_regclass('public.concours_presence') is not null then
    raise exception 'FAIL: table concours_presence non droppée';
  end if;
  if exists (select 1 from pg_proc where proname='fn_concours_known_attendees') then
    raise exception 'FAIL: fn_concours_known_attendees non droppée';
  end if;
  raise notice 'PASS: rollback 089 propre (table + RPC absentes ; 088 conservée)';
end $$;

\echo '=== HARNESS 089 TERMINÉ — tous les PASS ci-dessus ==='
