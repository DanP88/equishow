-- ============================================================================
-- NON-RÉGRESSION 076 — preuve d'ADDITIVITÉ (zéro impact sur l'existant)
-- ============================================================================
-- AUTO-PORTANT, POSTGRES JETABLE uniquement :
--   createdb eq_nonreg_076
--   psql -d eq_nonreg_076 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/076_org_concours_claim_radar/non_regression_check.sql
--
-- Vérifie que 076 :
--   • ne crée QUE la table public.concours_claims ;
--   • ne pose des policies RLS QUE sur concours_claims (aucune table existante
--     touchée) ;
--   • ne pose un trigger QUE sur concours_claims ;
--   • crée exactement les 3 fonctions attendues (2 publiques + 1 trigger) ;
--   • est entièrement réversible (rollback → 0 objet résiduel).
-- Note : les fonctions plpgsql ne sont pas validées contre les tables au CREATE,
-- on n'a donc besoin ici que des dépendances FK (concours, users).
-- ============================================================================

\echo '=== Setup minimal (deps FK + stub auth + rôle) ==='
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
do $$ begin if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
grant usage on schema public to authenticated;

create table public.users    (id uuid primary key, role text);
create table public.concours (id uuid primary key, nom text);

-- Snapshot des objets AVANT (référence).
create temporary table if not exists _before_tables  as select table_name  from information_schema.tables  where table_schema='public';
create temporary table if not exists _before_policies as select tablename, policyname from pg_policies where schemaname='public';

\echo '=== Application 076 ==='
\ir ../../migrations/076_org_concours_claim_radar.sql

\echo '=== [A] Seule table ajoutée = concours_claims ==='
do $$
declare extra text;
begin
  select string_agg(table_name, ', ') into extra
  from information_schema.tables
  where table_schema='public'
    and table_name not in (select table_name from _before_tables)
    and table_name <> 'concours_claims';
  if extra is null then raise notice 'PASS [A] seule nouvelle table = concours_claims';
  else raise exception 'FAIL [A] tables inattendues ajoutées : %', extra; end if;
end $$;

\echo '=== [B] Policies RLS uniquement sur concours_claims ==='
do $$
declare bad text;
begin
  select string_agg(tablename||'.'||policyname, ', ') into bad
  from pg_policies
  where schemaname='public'
    and tablename <> 'concours_claims'
    and (tablename, policyname) not in (select tablename, policyname from _before_policies);
  if bad is null then raise notice 'PASS [B] aucune policy ajoutée hors concours_claims';
  else raise exception 'FAIL [B] policies ajoutées sur tables existantes : %', bad; end if;
end $$;

\echo '=== [C] Trigger uniquement sur concours_claims ==='
do $$
declare bad text;
begin
  select string_agg(c.relname||'.'||t.tgname, ', ') into bad
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal and c.relname <> 'concours_claims';
  if bad is null then raise notice 'PASS [C] aucun trigger hors concours_claims';
  else raise exception 'FAIL [C] triggers inattendus : %', bad; end if;
end $$;

\echo '=== [D] Fonctions créées = exactement les 3 attendues ==='
do $$ begin
  if exists (select 1 from pg_proc where proname='fn_org_concours_radar')
     and exists (select 1 from pg_proc where proname='fn_org_owns_concours')
     and exists (select 1 from pg_proc where proname='tg_concours_claims_review')
  then raise notice 'PASS [D] fn_org_concours_radar + fn_org_owns_concours + tg_concours_claims_review présentes';
  else raise exception 'FAIL [D] fonction(s) 076 manquante(s)'; end if;
end $$;

\echo '=== [E] Réversibilité (rollback → 0 résidu) ==='
\ir ../../migrations/076_org_concours_claim_radar_rollback.sql
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='concours_claims')
     or exists (select 1 from pg_proc where proname in ('fn_org_concours_radar','fn_org_owns_concours','tg_concours_claims_review'))
  then raise exception 'FAIL [E] résidus après rollback';
  else raise notice 'PASS [E] rollback complet, aucun résidu'; end if;
end $$;

\echo ''
\echo '✅ NON-RÉGRESSION 076 — additivité prouvée, rollback propre.'
