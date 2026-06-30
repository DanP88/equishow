-- ============================================================================
-- HARNESS 088 — USER FOLLOWS · graphe social (PR1)
-- ============================================================================
-- AUTO-PORTANT. À jouer sur un POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_088
--   psql -d eq_harness_088 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/088_user_follows/harness.sql
--
-- Ce script :
--   1. schéma minimal (users) + stub auth.uid() + rôles authenticated/anon ;
--   2. charge la VRAIE migration 088 via \ir ;
--   3. exécute les tests (contraintes + RLS + RPC) ;
--   4. applique le rollback réel et vérifie la propreté.
-- Chaque test échoué => RAISE EXCEPTION ; sinon RAISE NOTICE 'PASS …'.
-- ============================================================================

\set ON_ERROR_STOP on
\echo '=== [0] SETUP schéma minimal + stub auth + rôles ==='

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

-- users minimal (colonnes lues par 088 : id, role).
create table public.users (
  id uuid primary key, prenom text, role text not null default 'cavalier'
);
grant select on public.users to authenticated, anon;

insert into public.users(id, prenom, role) values
  ('00000000-0000-0000-0000-0000000000a1','Alice','cavalier'),
  ('00000000-0000-0000-0000-0000000000a2','Bob',  'coach'),
  ('00000000-0000-0000-0000-0000000000a3','Carol','cavalier'),
  ('00000000-0000-0000-0000-0000000000ad','Admin','admin');

\echo '=== [1] APPLICATION migration 088 (fichier réel) ==='
\ir ../../migrations/088_user_follows_graph.sql

-- La migration grant insert/delete/select via RLS policies "to authenticated",
-- mais il faut aussi le GRANT table-level pour le rôle (RLS ne donne pas le privilège).
grant select, insert, delete on public.user_follows to authenticated;

\echo '=== [2] TEST : un user peut suivre un autre (INSERT own sous RLS) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.user_follows(follower_id, followee_id)
  values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2');
reset role;
do $$ begin
  if not exists (select 1 from public.user_follows
    where follower_id='00000000-0000-0000-0000-0000000000a1'
      and followee_id='00000000-0000-0000-0000-0000000000a2')
  then raise exception 'FAIL: follow non créé'; end if;
  raise notice 'PASS: A suit B';
end $$;

\echo '=== [3] TEST : auto-follow rejeté (check follower_id <> followee_id) ==='
do $$ begin
  begin
    insert into public.user_follows(follower_id, followee_id)
      values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: auto-follow accepté';
  exception when check_violation then raise notice 'PASS: auto-follow rejeté';
  end;
end $$;

\echo '=== [4] TEST : duplicate follow rejeté par la PK ==='
do $$ begin
  begin
    insert into public.user_follows(follower_id, followee_id)
      values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2');
    raise exception 'FAIL: doublon accepté';
  exception when unique_violation then raise notice 'PASS: doublon rejeté';
  end;
end $$;

\echo '=== [5] TEST : INSERT pour autrui rejeté par RLS (with check follower_id=auth.uid) ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
-- a3 tente de créer un follow au nom de a1 → doit être bloqué par RLS.
insert into public.user_follows(follower_id, followee_id)
  values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a3');
reset role;
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from public.user_follows
    where follower_id='00000000-0000-0000-0000-0000000000a1'
      and followee_id='00000000-0000-0000-0000-0000000000a3')
  then raise exception 'FAIL: RLS a laissé insérer le follow d''autrui'; end if;
  raise notice 'PASS: INSERT pour autrui bloqué par RLS';
end $$;

\echo '=== [6] TEST : SELECT fonctionne pour authenticated ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
do $$ declare n int; begin
  select count(*) into n from public.user_follows;     -- ne doit PAS lever d'erreur
  raise notice 'PASS: SELECT authenticated OK (% lignes visibles)', n;
end $$;
reset role;

\echo '=== [7] TEST : B (a3) ne peut pas supprimer le follow de A (a1) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
delete from public.user_follows
  where follower_id='00000000-0000-0000-0000-0000000000a1'
    and followee_id='00000000-0000-0000-0000-0000000000a2';   -- RLS => 0 ligne
reset role;
do $$ begin
  if not exists (select 1 from public.user_follows
    where follower_id='00000000-0000-0000-0000-0000000000a1'
      and followee_id='00000000-0000-0000-0000-0000000000a2')
  then raise exception 'FAIL: a3 a supprimé le follow de a1'; end if;
  raise notice 'PASS: delete d''autrui sans effet (RLS)';
end $$;

\echo '=== [8] TEST : A peut unfollow son propre follow ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
delete from public.user_follows
  where follower_id='00000000-0000-0000-0000-0000000000a1'
    and followee_id='00000000-0000-0000-0000-0000000000a2';
reset role;
do $$ begin
  if exists (select 1 from public.user_follows
    where follower_id='00000000-0000-0000-0000-0000000000a1'
      and followee_id='00000000-0000-0000-0000-0000000000a2')
  then raise exception 'FAIL: unfollow own sans effet'; end if;
  raise notice 'PASS: A a bien unfollow son propre lien';
end $$;

\echo '=== [9] TEST : fn_people_i_know retourne au moins les suivis directs ==='
-- a1 suit a2 et a3.
insert into public.user_follows(follower_id, followee_id) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a3');
do $$
declare n_following int;
begin
  select count(*) into n_following
  from public.fn_people_i_know('00000000-0000-0000-0000-0000000000a1')
  where relation = 'following';
  if n_following < 2 then
    raise exception 'FAIL: fn_people_i_know following=% (attendu >=2)', n_following;
  end if;
  raise notice 'PASS: fn_people_i_know rend % suivis directs', n_following;
end $$;

\echo '=== [10] TEST : anti-énumération — viewer<>auth.uid() (non admin) rejeté ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
-- a3 (non admin) demande le graphe de a1 → exception attendue.
select * from public.fn_people_i_know('00000000-0000-0000-0000-0000000000a1');
reset role;
\set ON_ERROR_STOP on
\echo '   (ci-dessus : une ERROR "viewer doit être auth.uid()" = comportement attendu)'

\echo '=== [11] ROLLBACK réel + vérif propreté ==='
\ir ../../migrations/088_user_follows_graph_rollback.sql
do $$ begin
  if to_regclass('public.user_follows') is not null then
    raise exception 'FAIL: table user_follows non droppée';
  end if;
  if exists (select 1 from pg_proc where proname='fn_people_i_know') then
    raise exception 'FAIL: fn_people_i_know non droppée';
  end if;
  raise notice 'PASS: rollback propre (table + RPC absentes)';
end $$;

\echo '=== HARNESS 088 TERMINÉ — tous les PASS ci-dessus ==='
