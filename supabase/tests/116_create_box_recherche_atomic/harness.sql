-- ============================================================================
-- HARNESS 116 — PUBLICATION ATOMIQUE create_box_recherche
-- ============================================================================
-- AUTO-PORTANT. POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_116
--   psql -d eq_harness_116 -v ON_ERROR_STOP=1 -f supabase/tests/116_create_box_recherche_atomic/harness.sql
--
-- Charge la chaîne réelle 088→089→110→114→116 (fichiers réels — 116 dépend
-- structurellement de 114, lui-même de 110). box_annonces/box_reservations
-- sont des STUBS minimalistes (colonnes strictement nécessaires pour que
-- l'ALTER + le trigger de 114 s'appliquent) — 116 ne les touche jamais et ne
-- crée aucune ligne dedans, donc pas besoin de répliquer recalc_box_
-- reservation_amounts / fn_availability_box ici (contrairement au harness 114
-- qui testait le cycle complet jusqu'à l'acceptation).
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

create table public.users (id uuid primary key, prenom text, role text default 'cavalier');
grant select on public.users to authenticated, anon;
create table public.concours (id uuid primary key, nom text);
create table public.chevaux (id uuid primary key, proprietaire_id uuid, nom text not null);
grant select, insert, update, delete on public.chevaux to authenticated;

-- Stubs MINIMAUX box_annonces/box_reservations : 114 fait un ALTER TABLE +
-- CREATE TRIGGER dessus, ces tables doivent donc exister avec les colonnes
-- que 114 référence, même si 116 ne les touche jamais.
create table public.box_annonces (
  id uuid primary key default gen_random_uuid(),
  auteur_id uuid not null,
  lieu text not null,
  date_debut timestamptz not null,
  date_fin timestamptz not null,
  nb_boxes int not null default 1,
  nb_boxes_disponibles int not null default 1,
  prix_nuit_ht numeric not null default 25,
  concours_id uuid
);
create table public.box_reservations (
  id uuid primary key default gen_random_uuid(),
  box_id uuid references public.box_annonces(id) on delete cascade,
  seller_id uuid, buyer_id uuid,
  title text not null default '',
  lieu text,
  nb_nuits int not null default 1,
  date_debut date not null,
  date_fin date not null,
  message text,
  price_total_ht numeric, platform_commission numeric, price_total_ttc numeric,
  status text not null default 'pending',
  cheval_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.box_annonces to authenticated;
grant select on public.box_reservations to authenticated;

-- Seed utilisateurs / concours / chevaux.
insert into public.users(id, prenom) values
  ('00000000-0000-0000-0000-0000000000a1','Alice'),   -- demandeur
  ('00000000-0000-0000-0000-0000000000a3','Carol');   -- tiers (anti-IDOR)
insert into public.concours(id, nom) values ('00000000-0000-0000-0000-0000000000c1','CSO Deauville');
insert into public.chevaux(id, proprietaire_id, nom) values
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','Tornado'),
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000a1','Spirit'),
  ('00000000-0000-0000-0000-0000000000f9','00000000-0000-0000-0000-0000000000a1','Duchesse'),
  ('00000000-0000-0000-0000-0000000000f7','00000000-0000-0000-0000-0000000000a3','Nala');  -- a3 (anti-IDOR)

\echo '=== [1] APPLICATION 088 → 089 → 110 → 114 (chaîne réelle) ==='
\ir ../../migrations/088_user_follows_graph.sql
\ir ../../migrations/089_concours_presence.sql
grant select, insert, update, delete on public.concours_presence to authenticated;
\ir ../../migrations/110_concours_participation_model.sql
grant select, insert, delete on public.concours_presence_chevaux to authenticated;
\ir ../../migrations/114_box_recherches_ouvertes.sql
grant select, insert, update, delete on public.box_recherches to authenticated;
grant select, insert, delete on public.box_recherche_chevaux to authenticated;

-- Duchesse (f9) engagée sur c1. Tornado/Spirit (f1/f2) NON engagés sur c1
-- (servent au test de cohérence concours). Nala (f7, a3) sert à l'anti-IDOR.
insert into public.concours_presence (concours_id, user_id, status, cheval_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','going','00000000-0000-0000-0000-0000000000f9');
insert into public.concours_presence_chevaux (concours_id, user_id, cheval_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f9');

\echo '=== [2] APPLICATION 116 (RPC create_box_recherche) ==='
\ir ../../migrations/116_create_box_recherche_atomic.sql

\echo '=== [3] PERMISSIONS : PUBLIC/anon refusés, authenticated OK (avant même le 1er appel) ==='
do $$ begin
  if exists (
    select 1 from information_schema.routine_privileges
     where routine_name='create_box_recherche' and grantee='PUBLIC'
  ) then raise exception 'FAIL: PUBLIC porte EXECUTE sur create_box_recherche'; end if;
  if exists (
    select 1 from information_schema.routine_privileges
     where routine_name='create_box_recherche' and grantee='anon'
  ) then raise exception 'FAIL: anon porte EXECUTE sur create_box_recherche'; end if;
  if not exists (
    select 1 from information_schema.routine_privileges
     where routine_name='create_box_recherche' and grantee='authenticated'
  ) then raise exception 'FAIL: authenticated ne porte PAS EXECUTE sur create_box_recherche'; end if;
  raise notice 'PASS: permissions conformes dès la création (PUBLIC/anon refusés, authenticated OK)';
end $$;

\echo '=== [4] anon → EXECUTE refusé au niveau permission ==='
\set ON_ERROR_STOP off
set role anon;
select public.create_box_recherche(null, 'Test anon', '2026-11-01', '2026-11-03', true, array['00000000-0000-0000-0000-0000000000f9']::uuid[]);
reset role;
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from public.box_recherches where lieu='Test anon')
  then raise exception 'FAIL: anon a pu créer une recherche malgré le REVOKE'; end if;
  raise notice 'PASS: anon refusé au niveau permission — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [5] 1 cheval valide, sans concours → succès ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.create_box_recherche(null, 'Deauville', '2026-11-01', '2026-11-03', true, array['00000000-0000-0000-0000-0000000000f1']::uuid[]) as r5 \gset
reset role;
select set_config('test.r5', :'r5', false);
do $$
declare v_row record; v_cnt int;
begin
  select * into v_row from public.box_recherches where id = current_setting('test.r5')::uuid;
  if v_row.demandeur_id <> '00000000-0000-0000-0000-0000000000a1' then raise exception 'FAIL: demandeur_id incorrect (%)', v_row.demandeur_id; end if;
  if v_row.nb_box <> 1 or v_row.status <> 'open' then raise exception 'FAIL: nb_box/status incorrects (nb_box=%, status=%)', v_row.nb_box, v_row.status; end if;
  select count(*) into v_cnt from public.box_recherche_chevaux where recherche_id = current_setting('test.r5')::uuid;
  if v_cnt <> 1 then raise exception 'FAIL: % lignes chevaux (attendu 1)', v_cnt; end if;
  raise notice 'PASS: 1 cheval valide → recherche + périmètre créés atomiquement, nb_box=1 dérivé par trigger 114';
end $$;

\echo '=== [6] Plusieurs chevaux valides → succès atomique ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.create_box_recherche(null, 'Clinique', '2026-11-05', '2026-11-07', false, array['00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f2']::uuid[]) as r6 \gset
reset role;
select set_config('test.r6', :'r6', false);
do $$
declare v_row record; v_cnt int;
begin
  select * into v_row from public.box_recherches where id = current_setting('test.r6')::uuid;
  if v_row.nb_box <> 2 then raise exception 'FAIL: nb_box incorrect (%, attendu 2)', v_row.nb_box; end if;
  select count(*) into v_cnt from public.box_recherche_chevaux where recherche_id = current_setting('test.r6')::uuid;
  if v_cnt <> 2 then raise exception 'FAIL: % lignes chevaux (attendu 2)', v_cnt; end if;
  raise notice 'PASS: 2 chevaux valides → périmètre exact, atomique';
end $$;

-- ============================================================================
-- [7] TEST CRITIQUE — un cheval provoque un rejet volontaire → ROLLBACK TOTAL
-- ============================================================================
\echo '=== [7] Tornado (valide, a1) + Nala (a3, IDOR) dans le MÊME appel → 0 ligne, aucune des deux ==='
do $$ declare v_before_r int; v_before_c int; begin
  select count(*) into v_before_r from public.box_recherches;
  select count(*) into v_before_c from public.box_recherche_chevaux;
  perform set_config('test.before_r', v_before_r::text, false);
  perform set_config('test.before_c', v_before_c::text, false);
end $$;
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.create_box_recherche(null, 'Test rollback critique', '2026-11-10', '2026-11-11', true,
  array['00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f7']::uuid[]);
reset role;
\set ON_ERROR_STOP on
do $$
declare v_after_r int; v_after_c int;
begin
  select count(*) into v_after_r from public.box_recherches;
  select count(*) into v_after_c from public.box_recherche_chevaux;
  if v_after_r <> current_setting('test.before_r')::int then
    raise exception 'FAIL: ROLLBACK PARTIEL — box_recherches a changé (avant=%, après=%)', current_setting('test.before_r'), v_after_r;
  end if;
  if v_after_c <> current_setting('test.before_c')::int then
    raise exception 'FAIL: ROLLBACK PARTIEL — box_recherche_chevaux a changé (avant=%, après=%)', current_setting('test.before_c'), v_after_c;
  end if;
  if exists (select 1 from public.box_recherches where lieu='Test rollback critique') then
    raise exception 'FAIL: la recherche « Test rollback critique » existe malgré le rejet de Nala';
  end if;
  raise notice 'PASS: TEST CRITIQUE — 1 cheval valide + 1 cheval IDOR dans le même appel → 0 box_recherches, 0 box_recherche_chevaux, rollback total (voir ERROR ci-dessus, attendue)';
end $$;

\echo '=== [8] Cheval d''autrui seul (Nala) → rollback total ==='
do $$ declare v_before_r int; begin
  select count(*) into v_before_r from public.box_recherches; perform set_config('test.before_r8', v_before_r::text, false);
end $$;
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.create_box_recherche(null, 'Test IDOR seul', '2026-11-12', '2026-11-13', true, array['00000000-0000-0000-0000-0000000000f7']::uuid[]);
reset role;
\set ON_ERROR_STOP on
do $$ declare v_after_r int; begin
  select count(*) into v_after_r from public.box_recherches;
  if v_after_r <> current_setting('test.before_r8')::int then raise exception 'FAIL: cheval d''autrui a quand même créé une ligne'; end if;
  raise notice 'PASS: cheval d''autrui seul → rollback total — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [9] Cheval hors périmètre concours (Tornado non engagé sur c1) → rollback total ==='
do $$ declare v_before_r int; begin
  select count(*) into v_before_r from public.box_recherches; perform set_config('test.before_r9', v_before_r::text, false);
end $$;
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.create_box_recherche('00000000-0000-0000-0000-0000000000c1', 'Test hors concours', '2026-09-13', '2026-09-15', true, array['00000000-0000-0000-0000-0000000000f1']::uuid[]);
reset role;
\set ON_ERROR_STOP on
do $$ declare v_after_r int; begin
  select count(*) into v_after_r from public.box_recherches;
  if v_after_r <> current_setting('test.before_r9')::int then raise exception 'FAIL: cheval hors périmètre concours a quand même créé une ligne'; end if;
  raise notice 'PASS: cheval non engagé sur le concours lié → rollback total — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [9b] Contrôle positif symétrique : Duchesse (engagée sur c1) + concours lié → succès ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.create_box_recherche('00000000-0000-0000-0000-0000000000c1', 'Sur place', '2026-09-13', '2026-09-15', true, array['00000000-0000-0000-0000-0000000000f9']::uuid[]) as r9b \gset
reset role;
select set_config('test.r9b', :'r9b', false);
do $$ begin
  if not exists (select 1 from public.box_recherches where id = current_setting('test.r9b')::uuid and concours_id='00000000-0000-0000-0000-0000000000c1')
  then raise exception 'FAIL: cheval engagé sur le concours rejeté à tort'; end if;
  raise notice 'PASS: cheval engagé sur le concours lié → succès, concours_id correct';
end $$;

\echo '=== [10] Tableau vide → refus, 0 ligne ==='
do $$ declare v_before_r int; begin
  select count(*) into v_before_r from public.box_recherches; perform set_config('test.before_r10', v_before_r::text, false);
end $$;
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.create_box_recherche(null, 'Test vide', '2026-11-14', '2026-11-15', true, array[]::uuid[]);
reset role;
\set ON_ERROR_STOP on
do $$ declare v_after_r int; begin
  select count(*) into v_after_r from public.box_recherches;
  if v_after_r <> current_setting('test.before_r10')::int then raise exception 'FAIL: tableau vide a quand même créé une ligne'; end if;
  raise notice 'PASS: tableau de chevaux vide → refus propre, 0 ligne — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [11] Doublon de cheval dans le même appel → refus, 0 ligne ==='
do $$ declare v_before_r int; begin
  select count(*) into v_before_r from public.box_recherches; perform set_config('test.before_r11', v_before_r::text, false);
end $$;
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.create_box_recherche(null, 'Test doublon', '2026-11-16', '2026-11-17', true, array['00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f1']::uuid[]);
reset role;
\set ON_ERROR_STOP on
do $$ declare v_after_r int; begin
  select count(*) into v_after_r from public.box_recherches;
  if v_after_r <> current_setting('test.before_r11')::int then raise exception 'FAIL: doublon de cheval a quand même créé une ligne'; end if;
  raise notice 'PASS: doublon de cheval dans le même appel → refus, 0 ligne — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [12] Aucune box_reservations créée par tout ce test (0 depuis le début) ==='
do $$ declare v_cnt int; begin
  select count(*) into v_cnt from public.box_reservations;
  if v_cnt <> 0 then raise exception 'FAIL: % lignes box_reservations trouvées (attendu 0, RPC 116 n''en crée jamais)', v_cnt; end if;
  raise notice 'PASS: 0 box_reservations créée sur l''ensemble du harness';
end $$;

\echo '=== [13] ROLLBACK 116 : la fonction disparaît, 114/110 intacts ==='
\ir ../../rollbacks/116_create_box_recherche_atomic_rollback.sql
do $$ begin
  if exists (select 1 from pg_proc where proname='create_box_recherche') then
    raise exception 'FAIL: RPC create_box_recherche non supprimée par le rollback';
  end if;
  if to_regclass('public.box_recherches') is null then
    raise exception 'FAIL: le rollback 116 a supprimé une table de 114 — ne devait PAS arriver';
  end if;
  if to_regclass('public.concours_presence_chevaux') is null then
    raise exception 'FAIL: le rollback 116 a touché une table de 110 — ne devait PAS arriver';
  end if;
  raise notice 'PASS: rollback 116 propre — RPC absente, 114/110 intacts, données existantes préservées';
end $$;

\echo '=== HARNESS 116 TERMINÉ — tous les PASS ci-dessus ==='
