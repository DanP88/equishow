-- ============================================================================
-- HARNESS 092 — Concours création organisateur (PR2-A)
-- ============================================================================
-- AUTO-PORTANT. POSTGRES LOCAL JETABLE uniquement (jamais prod) :
--   createdb eq_harness_092
--   psql -d eq_harness_092 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/092_concours_org_creation/harness.sql
--
-- Reconstruit un schéma concours PRÉ-092 (colonnes/RLS/FK→profiles/fn claim-only +
-- concours_messages minimal LOT2), applique la VRAIE migration 092, teste sous RLS,
-- puis applique le VRAI rollback et vérifie la restauration.
-- Chaque test : RAISE EXCEPTION si échec, RAISE NOTICE 'PASS …' sinon.
-- ============================================================================

\echo '=== [0] SETUP schéma pré-092 + stub auth + rôles ==='

create schema if not exists auth;
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end $$;
grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

create table public.users (id uuid primary key, prenom text, nom text, role text);
create table public.profiles (id uuid primary key);
grant select on public.users to authenticated, anon;

-- concours : forme PRÉ-092 (FK organisateur_id → profiles, pas de statut/infos).
create table public.concours (
  id uuid primary key default gen_random_uuid(),
  numero_ffe text unique,
  nom text not null,
  date_debut date,
  date_fin date,
  lieu text,
  etat text,
  organisateur_id uuid references public.profiles(id) on delete set null,
  source_import text default 'csv',
  followers_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.concours to authenticated;
grant select on public.concours to anon;
alter table public.concours enable row level security;

-- Policies PRÉ-092 (état 079 : select public, write admin).
create policy concours_select_all on public.concours for select using (true);
create policy concours_insert_admin on public.concours for insert
  with check (exists (select 1 from public.users u where u.id=auth.uid() and u.role='admin'));
create policy concours_update_admin on public.concours for update
  using (exists (select 1 from public.users u where u.id=auth.uid() and u.role='admin'))
  with check (exists (select 1 from public.users u where u.id=auth.uid() and u.role='admin'));
create policy concours_delete_admin on public.concours for delete
  using (exists (select 1 from public.users u where u.id=auth.uid() and u.role='admin'));

create table public.concours_claims (
  concours_id uuid, organisateur_id uuid, status text
);

-- fn_org_owns_concours version PRÉ-092 (claim approuvé + admin).
create or replace function public.fn_org_owns_concours(p_concours_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.concours_claims
    where concours_id = p_concours_id and organisateur_id = auth.uid() and status='approved'
  ) or exists (
    select 1 from public.users u where u.id=auth.uid() and u.role='admin'
  );
$$;
grant execute on function public.fn_org_owns_concours(uuid) to authenticated;

-- concours_messages minimal (LOT2) : soft-delete = auteur OU org propriétaire OU admin.
create table public.concours_messages (
  id uuid primary key default gen_random_uuid(),
  concours_id uuid not null,
  auteur_id uuid not null,
  contenu text,
  is_deleted boolean not null default false
);
grant select, insert, update on public.concours_messages to authenticated;
alter table public.concours_messages enable row level security;
create policy cm_select on public.concours_messages for select using (true);
create policy cm_insert on public.concours_messages for insert
  with check (auteur_id = auth.uid());
create policy cm_softdelete on public.concours_messages for update
  using (auteur_id = auth.uid() or public.fn_org_owns_concours(concours_id))
  with check (auteur_id = auth.uid() or public.fn_org_owns_concours(concours_id));

-- Acteurs.
insert into public.users(id, prenom, nom, role) values
  ('00000000-0000-0000-0000-0000000000a1','Org','Un','organisateur'),
  ('00000000-0000-0000-0000-0000000000a2','Org','Deux','organisateur'),
  ('00000000-0000-0000-0000-0000000000b1','Cava','X','cavalier'),
  ('00000000-0000-0000-0000-0000000000b2','Cava','Y','cavalier'),
  ('00000000-0000-0000-0000-0000000000ad','Admin','Z','admin');
-- profiles : org1/org2 présents (pour valider le re-FK→profiles au rollback).
insert into public.profiles(id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2');

-- Concours "FFE" pré-existants (organisateur_id null, sans statut).
insert into public.concours(id, numero_ffe, nom, date_debut, date_fin, lieu, etat) values
  ('00000000-0000-0000-0000-00000000ffe1','202600001','CSO FFE 1', current_date+30, current_date+31, 'Lyon', 'Ouvert aux engagements'),
  ('00000000-0000-0000-0000-00000000ffe2','202600002','CSO FFE 2', current_date+40, current_date+41, 'Dijon', 'Calendrier');

\echo '=== [1] APPLICATION migration 092 (fichier réel) ==='
\ir ../../migrations/092_concours_org_creation.sql

do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='concours' and column_name='statut')
     or not exists (select 1 from information_schema.columns where table_name='concours' and column_name='infos')
  then raise exception 'FAIL [1] colonnes statut/infos absentes'; end if;
  -- 313-safe : lignes FFE pré-existantes = 'publie' par défaut.
  if (select count(*) from public.concours where statut='publie') <> 2 then
    raise exception 'FAIL [1] FFE pré-existants non défaultés à publie'; end if;
  raise notice 'PASS [1] statut/infos ajoutés ; FFE pré-existants = publie';
end $$;

\echo '=== [2] FK organisateur_id → users(id) ==='
do $$ begin
  -- FK invalide (uuid absent de users) rejetée.
  begin
    insert into public.concours(nom, organisateur_id) values ('x','00000000-0000-0000-0000-0000000000ff');
    raise exception 'FAIL [2] FK vers users non appliquée (insert accepté)';
  exception when foreign_key_violation then raise notice 'PASS [2] FK organisateur_id→users active (uuid inconnu rejeté)';
  end;
end $$;

\echo '=== [3] RLS INSERT own-row organisateur ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
insert into public.concours(id, nom, date_debut, date_fin, lieu, organisateur_id, statut, source_import, infos)
  values ('00000000-0000-0000-0000-0000000000d1','Concours Org1', current_date+50, current_date+51, 'Paris',
          '00000000-0000-0000-0000-0000000000a1','brouillon','org',
          jsonb_build_object('nbPlaces',60,'prix',45,'disciplines',array['CSO']));
do $$ begin
  -- insert pour autrui (organisateur_id ≠ self) refusé par la policy.
  begin
    insert into public.concours(nom, organisateur_id, statut)
      values ('vol','00000000-0000-0000-0000-0000000000a2','brouillon');
    raise exception 'FAIL [3] insert organisateur_id≠self accepté';
  exception when insufficient_privilege then raise notice 'PASS [3] RLS insert own-row OK (autrui refusé)';
  end;
end $$;
reset role;

\echo '=== [4] CHECK statut ==='
do $$ begin
  begin
    insert into public.concours(nom, statut) values ('bad','n_importe_quoi');
    raise exception 'FAIL [4] statut invalide accepté';
  exception when check_violation then raise notice 'PASS [4] CHECK statut (brouillon/publie/archive)';
  end;
end $$;

\echo '=== [5] Visibilité RLS des brouillons ==='
-- Autre cavalier : ne voit PAS le brouillon dra1, voit le publie ffe1.
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000b1';
do $$ begin
  if exists (select 1 from public.concours where id='00000000-0000-0000-0000-0000000000d1')
    then raise exception 'FAIL [5a] brouillon visible par un tiers'; end if;
  if not exists (select 1 from public.concours where id='00000000-0000-0000-0000-00000000ffe1')
    then raise exception 'FAIL [5b] publie invisible par un tiers'; end if;
  raise notice 'PASS [5a/b] tiers : brouillon masqué, publie visible';
end $$;
reset role;
-- Anon : idem (brouillon masqué, publie visible).
set role anon; set test.uid='';
do $$ begin
  if exists (select 1 from public.concours where id='00000000-0000-0000-0000-0000000000d1')
    then raise exception 'FAIL [5c] brouillon visible par anon'; end if;
  if not exists (select 1 from public.concours where id='00000000-0000-0000-0000-00000000ffe1')
    then raise exception 'FAIL [5d] publie invisible par anon'; end if;
  raise notice 'PASS [5c/d] anon : brouillon masqué, publie visible';
end $$;
reset role;
-- Propriétaire : voit son brouillon.
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if not exists (select 1 from public.concours where id='00000000-0000-0000-0000-0000000000d1')
    then raise exception 'FAIL [5e] propriétaire ne voit pas son brouillon'; end if;
  raise notice 'PASS [5e] propriétaire voit son brouillon';
end $$;
reset role;
-- Admin : voit le brouillon.
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000ad';
do $$ begin
  if not exists (select 1 from public.concours where id='00000000-0000-0000-0000-0000000000d1')
    then raise exception 'FAIL [5f] admin ne voit pas le brouillon'; end if;
  raise notice 'PASS [5f] admin voit le brouillon';
end $$;
reset role;

\echo '=== [6] RLS UPDATE own-row (publication) ==='
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
do $$ declare n int; begin
  update public.concours set statut='publie' where id='00000000-0000-0000-0000-0000000000d1';
  get diagnostics n = row_count;
  if n<>1 then raise exception 'FAIL [6a] propriétaire ne peut publier (n=%)', n; end if;
  raise notice 'PASS [6a] propriétaire publie son concours (brouillon→publie)';
end $$;
reset role;
-- remettre en brouillon (service_role) pour le test tiers.
update public.concours set statut='brouillon' where id='00000000-0000-0000-0000-0000000000d1';
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000b1';
do $$ declare n int; begin
  update public.concours set statut='publie' where id='00000000-0000-0000-0000-0000000000d1';
  get diagnostics n = row_count;
  if n<>0 then raise exception 'FAIL [6b] un tiers a pu modifier (n=%)', n; end if;
  raise notice 'PASS [6b] tiers ne peut pas modifier le concours d''autrui';
end $$;
reset role;

\echo '=== [7] fn_org_owns_concours : ownership direct + claim + admin ==='
-- claim approuvé pour org2 sur ffe1 (teste la branche claim conservée).
insert into public.concours_claims values ('00000000-0000-0000-0000-00000000ffe1','00000000-0000-0000-0000-0000000000a2','approved');
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if not public.fn_org_owns_concours('00000000-0000-0000-0000-0000000000d1')
    then raise exception 'FAIL [7a] créateur ne possède pas son concours (sans claim)'; end if;
  raise notice 'PASS [7a] ownership DIRECT à la création (sans claim)';
end $$;
reset role;
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000b1';
do $$ begin
  if public.fn_org_owns_concours('00000000-0000-0000-0000-0000000000d1')
    then raise exception 'FAIL [7b] un tiers possède le concours'; end if;
  raise notice 'PASS [7b] tiers ne possède pas';
end $$;
reset role;
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a2';
do $$ begin
  if not public.fn_org_owns_concours('00000000-0000-0000-0000-00000000ffe1')
    then raise exception 'FAIL [7c] claim approuvé ne donne pas ownership'; end if;
  raise notice 'PASS [7c] branche claim approuvé conservée';
end $$;
reset role;

\echo '=== [8] Non-régression LOT2 : soft-delete message par org propriétaire ==='
-- cavalier X poste un message dans le concours d''org1 (dra1).
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000b1';
insert into public.concours_messages(id, concours_id, auteur_id, contenu)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000d1',
          '00000000-0000-0000-0000-0000000000b1','coucou');
reset role;
-- org1 (NON auteur, propriétaire par création) soft-delete → autorisé via fn.
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
do $$ declare n int; begin
  update public.concours_messages set is_deleted=true where id='00000000-0000-0000-0000-0000000000e1';
  get diagnostics n = row_count;
  if n<>1 then raise exception 'FAIL [8a] org propriétaire ne peut pas soft-delete (n=%)', n; end if;
  raise notice 'PASS [8a] org propriétaire (par création) soft-delete OK — LOT2 intact';
end $$;
reset role;
-- cavalier Y (ni auteur ni proprio) → refusé (0 ligne).
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000b2';
do $$ declare n int; begin
  update public.concours_messages set is_deleted=true where id='00000000-0000-0000-0000-0000000000e1';
  get diagnostics n = row_count;
  if n<>0 then raise exception 'FAIL [8b] tiers a pu soft-delete (n=%)', n; end if;
  raise notice 'PASS [8b] tiers ne peut pas soft-delete';
end $$;
reset role;

\echo '=== [9] ROLLBACK 092 + restauration ==='
\ir ../../migrations/092_concours_org_creation_rollback.sql
do $$ begin
  if exists (select 1 from information_schema.columns where table_name='concours' and column_name in ('statut','infos'))
    then raise exception 'FAIL [9a] colonnes statut/infos subsistent'; end if;
  if exists (select 1 from pg_policies where tablename='concours' and policyname='concours_select_visible')
     or not exists (select 1 from pg_policies where tablename='concours' and policyname='concours_select_all')
    then raise exception 'FAIL [9b] SELECT public non restauré'; end if;
  if exists (select 1 from pg_policies where tablename='concours' and policyname in ('concours_insert_organisateur','concours_update_organisateur'))
    then raise exception 'FAIL [9c] policies org subsistent'; end if;
  raise notice 'PASS [9a/b/c] colonnes + policies org retirées, SELECT public restauré';
end $$;
-- FK de nouveau vers profiles.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='concours_organisateur_id_fkey'
      and confrelid='public.profiles'::regclass)
  then raise exception 'FAIL [9d] FK non repointée vers profiles'; end if;
  raise notice 'PASS [9d] FK organisateur_id → profiles restaurée';
end $$;
-- fn claim-only restaurée : org1 ne possède plus dra1 (aucun claim).
set role authenticated; set test.uid='00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if public.fn_org_owns_concours('00000000-0000-0000-0000-0000000000d1')
    then raise exception 'FAIL [9e] fn étendue non restaurée (ownership création subsiste)'; end if;
  raise notice 'PASS [9e] fn_org_owns_concours claim-only restaurée';
end $$;
reset role;

\echo ''
\echo '============================================================'
\echo ' ✅ HARNESS 092 — TOUS LES TESTS PASSÉS (voir lignes PASS)'
\echo '============================================================'
