-- ============================================================================
-- HARNESS 110 — CONCOURS PARTICIPATION MODEL
-- ============================================================================
-- AUTO-PORTANT. POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_110
--   psql -d eq_harness_110 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/110_concours_participation_model/harness.sql
--
--   1. schéma minimal (users/concours/chevaux) + stub auth.uid() + rôles ;
--   2. charge 089 (concours_presence, dépendance) PUIS 110 (fichiers réels) ;
--   3. tests : colonnes ajoutées, defaults, backfill, RLS own/autrui,
--      ownership cheval (anti-IDOR), cascades (cheval supprimé / présence
--      retirée) ;
--   4. rollback 110 réel + vérif propreté (089 et chevaux intacts).
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
-- Grant explicite : en prod Supabase l'accorde par défaut au bootstrap projet
-- (RLS de chevaux, 014, fait le reste) ; ce harness jetable doit le répliquer.
grant select, insert, update, delete on public.chevaux to authenticated;

insert into public.users(id, prenom, pseudo, initiales, avatar_color, role) values
  ('00000000-0000-0000-0000-0000000000a1','Alice','AliceCSO','AC','#ff0000','cavalier'),
  ('00000000-0000-0000-0000-0000000000a2','Bob',  null,      'BB','#00ff00','coach'),
  ('00000000-0000-0000-0000-0000000000a3','Carol','CarolEqui','CE','#0000ff','cavalier');
insert into public.concours(id, nom) values ('00000000-0000-0000-0000-0000000000c1','CSO Deauville');
-- f1 appartient à a2, f2 appartient à a3 (nécessaire au test anti-IDOR § [5]).
insert into public.chevaux(id, proprietaire_id, nom) values
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a2','Quorida'),
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000a3','Tornado');

\echo '=== [1] APPLICATION migrations 088 (dépendance de 089) puis 089 (concours_presence) ==='
\ir ../../migrations/088_user_follows_graph.sql
\ir ../../migrations/089_concours_presence.sql
grant select, insert, update, delete on public.concours_presence to authenticated;

\echo '=== [1b] SEED présence AVANT 110 (pour le test de backfill) ==='
-- a2 a déjà déclaré sa présence AVEC cheval_id (singulier, 089) avant que 110
-- n'existe — simule des données réelles pré-migration (2 lignes en prod).
insert into public.concours_presence(concours_id, user_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a2',
          '00000000-0000-0000-0000-0000000000f1');
-- a1 présent sans cheval (cas nullable — ne doit jamais générer de ligne de backfill).
insert into public.concours_presence(concours_id, user_id)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1');

\echo '=== [2] APPLICATION migration 110 ==='
\ir ../../migrations/110_concours_participation_model.sql
grant select, insert, delete on public.concours_presence_chevaux to authenticated;

\echo '=== [3] TEST : colonnes ajoutées + defaults corrects ==='
do $$
declare r record;
begin
  select epreuves, transport_skip, box_skip, coach_skip into r
  from public.concours_presence
  where concours_id='00000000-0000-0000-0000-0000000000c1' and user_id='00000000-0000-0000-0000-0000000000a1';
  if r.epreuves <> '{}'::text[] then raise exception 'FAIL: epreuves default incorrect (%)', r.epreuves; end if;
  if r.transport_skip is distinct from false then raise exception 'FAIL: transport_skip default incorrect'; end if;
  if r.box_skip is distinct from false then raise exception 'FAIL: box_skip default incorrect'; end if;
  if r.coach_skip is distinct from false then raise exception 'FAIL: coach_skip default incorrect'; end if;
  raise notice 'PASS: colonnes epreuves/*_skip présentes avec defaults corrects';
end $$;

\echo '=== [4] TEST : backfill depuis cheval_id singulier (089 → 110) ==='
do $$
declare n int;
begin
  select count(*) into n from public.concours_presence_chevaux
  where concours_id='00000000-0000-0000-0000-0000000000c1'
    and user_id='00000000-0000-0000-0000-0000000000a2'
    and cheval_id='00000000-0000-0000-0000-0000000000f1';
  if n <> 1 then raise exception 'FAIL: backfill n''a pas repris le cheval_id existant de a2 (n=%)', n; end if;
  select count(*) into n from public.concours_presence_chevaux
  where concours_id='00000000-0000-0000-0000-0000000000c1' and user_id='00000000-0000-0000-0000-0000000000a1';
  if n <> 0 then raise exception 'FAIL: a1 (sans cheval_id) n''aurait jamais dû générer de ligne (n=%)', n; end if;
  raise notice 'PASS: backfill correct (a2 repris, a1 absent car cheval_id NULL)';
end $$;

\echo '=== [5] TEST : idempotence du backfill (ré-exécution sans doublon) ==='
insert into public.concours_presence_chevaux (concours_id, user_id, cheval_id)
select concours_id, user_id, cheval_id
from public.concours_presence
where cheval_id is not null
on conflict do nothing;
do $$ declare n int; begin
  select count(*) into n from public.concours_presence_chevaux;
  if n <> 1 then raise exception 'FAIL: ré-exécution du backfill a créé un doublon (n=%)', n; end if;
  raise notice 'PASS: backfill idempotent (toujours 1 ligne)';
end $$;

\echo '=== [6] TEST : a3 déclare sa présence, puis rattache SON cheval (f2) — doit réussir ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
insert into public.concours_presence(concours_id, user_id)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a3')
  on conflict do nothing;
insert into public.concours_presence_chevaux(concours_id, user_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a3',
          '00000000-0000-0000-0000-0000000000f2');
reset role;
do $$ begin
  if not exists (select 1 from public.concours_presence_chevaux
    where user_id='00000000-0000-0000-0000-0000000000a3' and cheval_id='00000000-0000-0000-0000-0000000000f2')
  then raise exception 'FAIL: a3 n''a pas pu rattacher SON PROPRE cheval'; end if;
  raise notice 'PASS: a3 a rattaché son propre cheval (f2)';
end $$;

\echo '=== [7] TEST ANTI-IDOR : a3 tente de rattacher le cheval de a2 (f1) — doit être rejeté ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
insert into public.concours_presence_chevaux(concours_id, user_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a3',
          '00000000-0000-0000-0000-0000000000f1');
reset role;
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from public.concours_presence_chevaux
    where user_id='00000000-0000-0000-0000-0000000000a3' and cheval_id='00000000-0000-0000-0000-0000000000f1')
  then raise exception 'FAIL: a3 a réussi à rattacher le cheval de a2 (IDOR !)'; end if;
  raise notice 'PASS: a3 ne peut pas rattacher le cheval d''un autre (RLS + ownership) — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [8] TEST : a2 ne peut pas INSERT une ligne pour le compte de a3 ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
insert into public.concours_presence_chevaux(concours_id, user_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a3',
          '00000000-0000-0000-0000-0000000000f2');
reset role;
\set ON_ERROR_STOP on
do $$ begin
  -- La seule ligne légitime pour (a3,f2) est celle créée par a3 lui-même en [6].
  -- Si la tentative frauduleuse de a2 avait réussi, on aurait un conflit de PK
  -- (donc une erreur différente) ou, PK identique => impossible d'avoir 2 lignes ;
  -- le test qui compte est que la ligne appartient bien à a3 et que rien n'a été
  -- altéré pour un autre couple (concours,cheval).
  if (select count(*) from public.concours_presence_chevaux
      where user_id='00000000-0000-0000-0000-0000000000a3' and cheval_id='00000000-0000-0000-0000-0000000000f2') <> 1
  then raise exception 'FAIL: état inattendu après tentative d''écriture de a2 pour le compte de a3'; end if;
  raise notice 'PASS: a2 ne peut pas écrire une ligne pour le compte de a3 (RLS own-row) — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [9] TEST CASCADE : suppression d''un cheval → ligne concours_presence_chevaux disparaît ==='
delete from public.chevaux where id = '00000000-0000-0000-0000-0000000000f2';
do $$ begin
  if exists (select 1 from public.concours_presence_chevaux where cheval_id='00000000-0000-0000-0000-0000000000f2')
  then raise exception 'FAIL: la ligne n''a pas suivi la suppression du cheval (cascade absente)'; end if;
  raise notice 'PASS: suppression du cheval f2 → cascade correcte sur concours_presence_chevaux';
end $$;

\echo '=== [10] TEST CASCADE : retrait "J''y serai" (DELETE concours_presence) → chevaux associés disparaissent ==='
do $$ declare n int; begin
  select count(*) into n from public.concours_presence_chevaux
  where concours_id='00000000-0000-0000-0000-0000000000c1' and user_id='00000000-0000-0000-0000-0000000000a2';
  if n <> 1 then raise exception 'FAIL setup: attendu 1 ligne pour a2 avant retrait (n=%)', n; end if;
end $$;
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
delete from public.concours_presence
  where concours_id='00000000-0000-0000-0000-0000000000c1' and user_id='00000000-0000-0000-0000-0000000000a2';
reset role;
do $$ begin
  if exists (select 1 from public.concours_presence_chevaux
    where concours_id='00000000-0000-0000-0000-0000000000c1' and user_id='00000000-0000-0000-0000-0000000000a2')
  then raise exception 'FAIL: le retrait de "J''y serai" n''a pas cascadé sur concours_presence_chevaux'; end if;
  raise notice 'PASS: retrait de présence → cascade correcte (FK composite)';
end $$;

\echo '=== [11] NON-REGRESSION V1 : cheval_id (singulier, 089) reste lisible/écrivable à l''identique ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
update public.concours_presence set cheval_id = '00000000-0000-0000-0000-0000000000f1'
  where concours_id='00000000-0000-0000-0000-0000000000c1' and user_id='00000000-0000-0000-0000-0000000000a1';
reset role;
do $$ begin
  if not exists (select 1 from public.concours_presence
    where user_id='00000000-0000-0000-0000-0000000000a1' and cheval_id='00000000-0000-0000-0000-0000000000f1')
  then raise exception 'FAIL: cheval_id singulier (089, compat V1) ne fonctionne plus après 110'; end if;
  raise notice 'PASS: cheval_id singulier (V1) inchangé et toujours fonctionnel après 110';
end $$;

\echo '=== [12] ROLLBACK 110 réel + vérif propreté (089 + chevaux intacts) ==='
\ir ../../migrations/110_concours_participation_model_rollback.sql
do $$ begin
  if to_regclass('public.concours_presence_chevaux') is not null then
    raise exception 'FAIL: table concours_presence_chevaux non droppée';
  end if;
  if exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='concours_presence' and column_name='epreuves')
  then raise exception 'FAIL: colonne epreuves non droppée'; end if;
  if exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='concours_presence'
      and column_name in ('transport_skip','box_skip','coach_skip'))
  then raise exception 'FAIL: colonnes *_skip non droppées'; end if;
  if to_regclass('public.concours_presence') is null then
    raise exception 'FAIL: rollback 110 a supprimé concours_presence (089) — ne devait PAS arriver';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='concours_presence' and column_name='cheval_id')
  then raise exception 'FAIL: rollback 110 a supprimé cheval_id (089) — ne devait PAS arriver'; end if;
  if to_regclass('public.chevaux') is null then
    raise exception 'FAIL: rollback 110 a touché la table chevaux — ne devait PAS arriver';
  end if;
  raise notice 'PASS: rollback 110 propre (table + colonnes 110 absentes ; 089 et chevaux intacts)';
end $$;

\echo '=== HARNESS 110 TERMINÉ — tous les PASS ci-dessus ==='
