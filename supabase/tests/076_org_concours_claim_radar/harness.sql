-- ============================================================================
-- HARNESS 076 — Espace Organisateur P0 (claim + radar)
-- ============================================================================
-- AUTO-PORTANT. À jouer sur un POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_076
--   psql -d eq_harness_076 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/076_org_concours_claim_radar/harness.sql
--
-- Ce script :
--   1. crée un schéma MINIMAL (tables lues par fn_org_concours_radar) ;
--   2. stubbe auth.uid() (lecture du GUC `test.uid`) + rôle `authenticated` ;
--   3. charge la VRAIE migration 076 via \ir (on teste le fichier réel) ;
--   4. seed un scénario déterministe (C1 riche, C2 sparse pour le masquage) ;
--   5. exécute les tests sous RLS (set role authenticated + test.uid) ;
--   6. applique le rollback réel et vérifie la propreté.
--
-- Chaque test : RAISE EXCEPTION en cas d'échec (psql s'arrête, ON_ERROR_STOP),
-- RAISE NOTICE 'PASS …' sinon.
-- ============================================================================

\echo '=== [0] SETUP schéma minimal + stub auth + rôle authenticated ==='

-- Stub auth.uid() : lit le GUC de session `test.uid`.
create schema if not exists auth;
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

-- Rôle applicatif (doit exister AVANT \ir 076 : la migration grant execute dessus).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
grant usage on schema public to authenticated;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

-- Tables minimales (colonnes EXACTES utilisées par 076).
create table public.users (id uuid primary key, role text);
-- La policy SELECT de concours_claims lit public.users (check admin) → le rôle
-- applicatif a besoin du SELECT sur users (en prod : GRANT Supabase + RLS users).
grant select on public.users to authenticated;
create table public.concours (id uuid primary key, nom text);
create table public.concours_followers (
  concours_id uuid, user_id uuid, created_at timestamptz not null default now(),
  primary key (concours_id, user_id)
);
create table public.box_annonces        (id uuid primary key, concours_id uuid);
create table public.box_reservations     (id uuid primary key default gen_random_uuid(), box_id uuid, buyer_id uuid, status text);
create table public.transport_annonces   (id uuid primary key, concours_id uuid);
create table public.transport_reservations(id uuid primary key default gen_random_uuid(), transport_id uuid, buyer_id uuid, status text);
create table public.coach_annonces       (id uuid primary key, concours_id uuid);
create table public.course_demands       (id uuid primary key default gen_random_uuid(), annonce_id uuid, cavalier_id uuid, status text);
create table public.stages               (id uuid primary key, concours_id uuid);
create table public.stage_reservations   (id uuid primary key default gen_random_uuid(), stage_id uuid, cavalier_id uuid, status text);
create table public.user_events (
  id uuid primary key default gen_random_uuid(), user_id uuid, session_id text,
  event_type text, screen text, action text, duration_ms int,
  metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

-- Acteurs (uuids lisibles).
insert into public.users(id, role) values
  ('00000000-0000-0000-0000-0000000000a1','organisateur'),  -- org1 (propriétaire)
  ('00000000-0000-0000-0000-0000000000a2','organisateur'),  -- org2
  ('00000000-0000-0000-0000-0000000000a3','organisateur'),  -- org3 (non-owner)
  ('00000000-0000-0000-0000-0000000000ad','admin'),         -- admin
  ('00000000-0000-0000-0000-0000000000e1','cavalier'),
  ('00000000-0000-0000-0000-0000000000e2','cavalier'),
  ('00000000-0000-0000-0000-0000000000e3','cavalier'),
  ('00000000-0000-0000-0000-0000000000e4','cavalier'),
  ('00000000-0000-0000-0000-0000000000e5','cavalier'),
  ('00000000-0000-0000-0000-0000000000e6','cavalier');

insert into public.concours(id, nom) values
  ('00000000-0000-0000-0000-0000000000c1','Concours Riche'),
  ('00000000-0000-0000-0000-0000000000c2','Concours Sparse'),
  ('00000000-0000-0000-0000-0000000000c3','Concours Unicite');

-- Annonces rattachées (C1) + C2.
insert into public.box_annonces(id, concours_id) values
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000c2');
insert into public.transport_annonces(id, concours_id) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1');
insert into public.coach_annonces(id, concours_id) values
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000c1');
insert into public.stages(id, concours_id) values
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000c1');

-- Réservations C1 : 5 cavaliers distincts engagés (v1,v5 box / v2 transport /
-- v3 coach / v4 stage) + 1 ANNULÉE (v6) qui NE doit PAS compter.
insert into public.box_reservations(box_id, buyer_id, status) values
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000e1','paid'),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000e5','accepted'),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000e6','cancelled');
insert into public.transport_reservations(transport_id, buyer_id, status) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000e2','paid');
insert into public.course_demands(annonce_id, cavalier_id, status) values
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000e3','accepted');
insert into public.stage_reservations(stage_id, cavalier_id, status) values
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000e4','paid');
-- C2 : 1 seul engagé (v1) → masquage.
insert into public.box_reservations(box_id, buyer_id, status) values
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000e1','paid');

-- Followers : C1 = 6 (unmasked), C2 = 2 (masked).
insert into public.concours_followers(concours_id, user_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e2'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e3'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e4'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e5'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e6'),
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000e2');

-- user_events : C1 = 8 vues (6 users distincts + 2 null) + 3 clics FFE.
--               C2 = 2 vues (v1,v2). + bruit C3 (4 vues) qui NE doit PAS compter pour C1.
insert into public.user_events(user_id, session_id, event_type, action, metadata) values
  ('00000000-0000-0000-0000-0000000000e1','s1','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c1"}'),
  ('00000000-0000-0000-0000-0000000000e2','s2','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c1"}'),
  ('00000000-0000-0000-0000-0000000000e3','s3','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c1"}'),
  ('00000000-0000-0000-0000-0000000000e4','s4','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c1"}'),
  ('00000000-0000-0000-0000-0000000000e5','s5','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c1"}'),
  ('00000000-0000-0000-0000-0000000000e6','s6','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c1"}'),
  (null,'s7','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c1"}'),
  (null,'s8','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c1"}'),
  ('00000000-0000-0000-0000-0000000000e1','s1','cta_click','click_ffe','{"concours_id":"00000000-0000-0000-0000-0000000000c1"}'),
  ('00000000-0000-0000-0000-0000000000e2','s2','cta_click','click_ffe','{"concours_id":"00000000-0000-0000-0000-0000000000c1"}'),
  ('00000000-0000-0000-0000-0000000000e3','s3','cta_click','click_ffe','{"concours_id":"00000000-0000-0000-0000-0000000000c1"}'),
  ('00000000-0000-0000-0000-0000000000e1','s9','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c2"}'),
  ('00000000-0000-0000-0000-0000000000e2','s10','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c2"}'),
  (null,'s11','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c3"}'),
  (null,'s12','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c3"}'),
  (null,'s13','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c3"}'),
  (null,'s14','page_view',null,'{"concours_id":"00000000-0000-0000-0000-0000000000c3"}');

-- Claims pré-seedés (superuser, bypass RLS) :
--   C2 approved par org1 (radar masquage) ; C3 approved org1 + pending org2 (unicité).
-- (C1 sera créé/approuvé PAR LES TESTS sous RLS.)

\echo '=== [1] APPLICATION de la migration 076 (fichier réel) ==='
\ir ../../migrations/076_org_concours_claim_radar.sql

-- Grants applicatifs sur la table créée par 076 (Supabase les pose via default
-- privileges ; en local on les ajoute pour exercer la RLS sous `authenticated`).
grant select, insert, update on public.concours_claims to authenticated;

-- Pré-seed claims (après création de la table).
insert into public.concours_claims(concours_id, organisateur_id, status, concours_nom, organisateur_nom) values
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000a1','approved','Concours Sparse','Org 1'),
  ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000a1','approved','Concours Unicite','Org 1'),
  ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000a2','pending','Concours Unicite','Org 2');

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='concours_claims')
     and exists (select 1 from pg_proc where proname='fn_org_concours_radar')
     and exists (select 1 from pg_proc where proname='fn_org_owns_concours')
  then raise notice 'PASS [1] migration 076 appliquée (table + 2 fonctions présentes)';
  else raise exception 'FAIL [1] objets 076 manquants'; end if;
end $$;

\echo '=== [2] Création claim organisateur (RLS insert own) ==='
set role authenticated;
set test.uid = '00000000-0000-0000-0000-0000000000a1';
-- org1 crée sa demande sur C1 (pending) → OK
insert into public.concours_claims(concours_id, organisateur_id, status, concours_nom, organisateur_nom)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','pending','Concours Riche','Org 1');
do $$ begin
  if (select count(*) from public.concours_claims where concours_id='00000000-0000-0000-0000-0000000000c1') = 1
  then raise notice 'PASS [2] claim org1 sur C1 créé';
  else raise exception 'FAIL [2] claim non créé'; end if;
end $$;
-- insert pour le compte d'un AUTRE org → refusé par RLS (with check organisateur_id=auth.uid())
do $$ begin
  begin
    insert into public.concours_claims(concours_id, organisateur_id, status)
      values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a2','pending');
    raise exception 'FAIL [2] insert cross-org aurait dû être bloqué par RLS';
  exception when insufficient_privilege or check_violation then
    raise notice 'PASS [2] insert cross-org bloqué (RLS)';
  end;
end $$;
reset role;

\echo '=== [3] RLS visibilité (org voit ses claims, pas ceux des autres ; admin voit tout) ==='
-- org1 : voit ses claims (C1,C2,C3) et AUCUN claim d''un autre org.
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if (select count(*) from public.concours_claims) = 3
     and (select count(*) from public.concours_claims where organisateur_id <> '00000000-0000-0000-0000-0000000000a1') = 0
  then raise notice 'PASS [3] org1 voit uniquement ses 3 claims';
  else raise exception 'FAIL [3] visibilité org1 incorrecte (count=%)', (select count(*) from public.concours_claims); end if;
end $$;
reset role;
-- org2 : ne voit que son claim pending (C3).
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000a2';
do $$ begin
  if (select count(*) from public.concours_claims) = 1
     and (select count(*) from public.concours_claims where organisateur_id='00000000-0000-0000-0000-0000000000a2') = 1
  then raise notice 'PASS [3] org2 voit uniquement son claim';
  else raise exception 'FAIL [3] org2 voit % claims (attendu 1)', (select count(*) from public.concours_claims); end if;
end $$;
reset role;
-- admin : voit tout (>=4).
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000ad';
do $$ begin
  if (select count(*) from public.concours_claims) >= 4
  then raise notice 'PASS [3] admin voit tous les claims';
  else raise exception 'FAIL [3] admin ne voit pas tout (count=%)', (select count(*) from public.concours_claims); end if;
end $$;
reset role;

\echo '=== [4] Approbation admin (pending → approved, reviewed_at/by) ==='
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000ad';
update public.concours_claims
  set status='approved', reviewed_by='00000000-0000-0000-0000-0000000000ad'
  where concours_id='00000000-0000-0000-0000-0000000000c1'
    and organisateur_id='00000000-0000-0000-0000-0000000000a1';
do $$
declare r record;
begin
  select status, reviewed_at, reviewed_by into r
    from public.concours_claims
    where concours_id='00000000-0000-0000-0000-0000000000c1'
      and organisateur_id='00000000-0000-0000-0000-0000000000a1';
  if r.status='approved' and r.reviewed_at is not null and r.reviewed_by='00000000-0000-0000-0000-0000000000ad'
  then raise notice 'PASS [4] C1 approuvé, reviewed_at + reviewed_by renseignés';
  else raise exception 'FAIL [4] approbation incomplète (status=% at=% by=%)', r.status, r.reviewed_at, r.reviewed_by; end if;
end $$;
reset role;
-- un org NON admin ne peut PAS approuver (RLS update admin).
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000a2';
do $$
declare n int;
begin
  update public.concours_claims set status='approved'
    where organisateur_id='00000000-0000-0000-0000-0000000000a2';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'PASS [4] org non-admin ne peut pas approuver (0 ligne affectée par RLS)';
  else raise exception 'FAIL [4] org a pu modifier % ligne(s)', n; end if;
end $$;
reset role;

\echo '=== [5] Unicité : un seul claim approved par concours ==='
-- C3 a déjà un approved (org1). Approuver le pending org2 sur C3 → doit échouer (index unique partiel).
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000ad';
do $$ begin
  begin
    update public.concours_claims set status='approved'
      where concours_id='00000000-0000-0000-0000-0000000000c3'
        and organisateur_id='00000000-0000-0000-0000-0000000000a2';
    raise exception 'FAIL [5] 2e approved sur C3 aurait dû échouer';
  exception when unique_violation then
    raise notice 'PASS [5] 2e claim approved bloqué (unicité propriétaire)';
  end;
end $$;
reset role;

\echo '=== [6] fn_org_owns_concours ==='
do $$ begin
  -- propriétaire approuvé (org1/C1) → true
  perform set_config('test.uid','00000000-0000-0000-0000-0000000000a1', true);
  if not public.fn_org_owns_concours('00000000-0000-0000-0000-0000000000c1') then raise exception 'FAIL [6] owner C1 devrait être true'; end if;
  -- org1/C2 (approuvé) → true
  if not public.fn_org_owns_concours('00000000-0000-0000-0000-0000000000c2') then raise exception 'FAIL [6] owner C2 devrait être true'; end if;
  -- org2/C3 (pending) → false
  perform set_config('test.uid','00000000-0000-0000-0000-0000000000a2', true);
  if public.fn_org_owns_concours('00000000-0000-0000-0000-0000000000c3') then raise exception 'FAIL [6] org2 pending ne doit pas posséder C3'; end if;
  -- org3 (rien) → false
  perform set_config('test.uid','00000000-0000-0000-0000-0000000000a3', true);
  if public.fn_org_owns_concours('00000000-0000-0000-0000-0000000000c1') then raise exception 'FAIL [6] org3 ne doit pas posséder C1'; end if;
  -- admin → true (override)
  perform set_config('test.uid','00000000-0000-0000-0000-0000000000ad', true);
  if not public.fn_org_owns_concours('00000000-0000-0000-0000-0000000000c1') then raise exception 'FAIL [6] admin devrait avoir accès'; end if;
  raise notice 'PASS [6] fn_org_owns_concours (owner/pending/autre/admin)';
end $$;

\echo '=== [7]+[8] fn_org_concours_radar : accès, agrégats, masquage ==='
-- Non-owner → 42501
do $$ begin
  perform set_config('test.uid','00000000-0000-0000-0000-0000000000a3', true);
  begin
    perform public.fn_org_concours_radar('00000000-0000-0000-0000-0000000000c1', 30);
    raise exception 'FAIL [7] non-owner aurait dû recevoir 42501';
  exception when insufficient_privilege then
    raise notice 'PASS [7] non-owner → 42501 (insufficient_privilege)';
  end;
end $$;
-- Owner C1 : agrégats exacts
do $$
declare r jsonb;
begin
  perform set_config('test.uid','00000000-0000-0000-0000-0000000000a1', true);
  r := public.fn_org_concours_radar('00000000-0000-0000-0000-0000000000c1', 30);
  if (r->'visibility'->>'views')::int <> 8 then raise exception 'FAIL [8] views=% (att 8)', r->'visibility'->>'views'; end if;
  if (r->'visibility'->>'unique_visitors')::int <> 6 then raise exception 'FAIL [8] unique=% (att 6)', r->'visibility'->>'unique_visitors'; end if;
  if (r->'visibility'->>'ffe_clicks')::int <> 3 then raise exception 'FAIL [8] ffe=% (att 3)', r->'visibility'->>'ffe_clicks'; end if;
  if (r->'interest'->>'followers')::int <> 6 then raise exception 'FAIL [8] followers=% (att 6)', r->'interest'->>'followers'; end if;
  if (r->'engagement'->>'cavaliers_engaged')::int <> 5 then raise exception 'FAIL [8] engaged=% (att 5)', r->'engagement'->>'cavaliers_engaged'; end if;
  if (r->'funnel'->>'views_to_followers')::numeric <> 0.75 then raise exception 'FAIL [8] v2f=%', r->'funnel'->>'views_to_followers'; end if;
  if (r->'funnel'->>'followers_to_reservations')::numeric <> 0.8333 then raise exception 'FAIL [8] f2r=%', r->'funnel'->>'followers_to_reservations'; end if;
  if (r->'funnel'->>'views_to_reservations')::numeric <> 0.625 then raise exception 'FAIL [8] v2r=%', r->'funnel'->>'views_to_reservations'; end if;
  if (r->'visibility'->>'unique_visitors_masked')::boolean then raise exception 'FAIL [8] C1 ne doit PAS être masqué'; end if;
  raise notice 'PASS [8] agrégats C1 exacts (vues=8, uniques=6, ffe=3, followers=6, engagés=5, funnel ok)';
end $$;
-- C2 sparse : masquage RGPD (< 5)
do $$
declare r jsonb;
begin
  perform set_config('test.uid','00000000-0000-0000-0000-0000000000a1', true);
  r := public.fn_org_concours_radar('00000000-0000-0000-0000-0000000000c2', 30);
  if (r->'visibility'->>'unique_visitors') is not null then raise exception 'FAIL [7] C2 unique_visitors aurait dû être masqué (null)'; end if;
  if not (r->'visibility'->>'unique_visitors_masked')::boolean then raise exception 'FAIL [7] flag unique_visitors_masked attendu'; end if;
  if not (r->'interest'->>'followers_masked')::boolean then raise exception 'FAIL [7] followers_masked attendu (2<5)'; end if;
  if (r->'engagement'->>'cavaliers_engaged') is not null then raise exception 'FAIL [7] engaged C2 aurait dû être masqué (null)'; end if;
  if not (r->'engagement'->>'masked')::boolean then raise exception 'FAIL [7] engagement.masked attendu'; end if;
  raise notice 'PASS [7] masquage RGPD < 5 sur C2 (uniques/followers/engagés masqués)';
end $$;

\echo '=== [9] Aucune donnée nominative dans le retour de la fonction ==='
do $$
declare r jsonb; t text;
begin
  perform set_config('test.uid','00000000-0000-0000-0000-0000000000a1', true);
  r := public.fn_org_concours_radar('00000000-0000-0000-0000-0000000000c1', 30);
  t := r::text;
  -- ne doit contenir AUCUN uuid de cavalier seedé, ni email, ni clé user_id / event.
  if t like '%0000000000e1%' or t like '%0000000000e2%' or t like '%0000000000e3%'
     or t like '%0000000000e4%' or t like '%0000000000e5%' or t like '%0000000000e6%'
  then raise exception 'FAIL [9] un uuid cavalier fuite dans le radar'; end if;
  if t like '%@%' then raise exception 'FAIL [9] un email fuite dans le radar'; end if;
  if t like '%user_id%' or t like '%session_id%' or t like '%"id"%' then raise exception 'FAIL [9] identifiant individuel / event brut exposé'; end if;
  raise notice 'PASS [9] aucune donnée nominative / id individuel / event brut exposé';
end $$;

\echo '=== [10] ROLLBACK 076 (fichier réel) + propreté ==='
reset role;
\ir ../../migrations/076_org_concours_claim_radar_rollback.sql
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='concours_claims')
     or exists (select 1 from pg_proc where proname in ('fn_org_concours_radar','fn_org_owns_concours'))
  then raise exception 'FAIL [10] rollback incomplet (objets 076 subsistent)';
  else raise notice 'PASS [10] rollback propre (table + fonctions supprimées)'; end if;
end $$;

\echo ''
\echo '============================================================'
\echo ' ✅ HARNESS 076 — TOUS LES TESTS PASSÉS (voir lignes PASS ci-dessus)'
\echo '============================================================'
