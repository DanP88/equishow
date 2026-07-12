-- ============================================================================
-- HARNESS 094 — VERROU ANTI-ESCALADE profiles.role_id (F2, P0 sécurité)
-- ============================================================================
-- AUTO-PORTANT. POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_094
--   psql -d eq_harness_094 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/094_profiles_guard_role_id/harness.sql
--
--   1. schéma minimal roles + profiles + is_admin() + auth.uid() stub + rôles,
--      RÉPLIQUE de la config prod : policy profiles_update_own USING SANS with
--      check, profiles_insert_own (check id), roles_select_authenticated (true),
--      grants colonne INSERT/UPDATE(role_id) à authenticated ;
--   2. [A][A2] PROUVE la faille AVANT correctif (self-admin via UPDATE puis via
--      INSERT du role_id admin, lu librement dans roles) ;
--   3. applique 094 (revoke colonne role_id + with check + is_admin search_path) ;
--   4. [C..G] prouve : UPDATE role_id refusé, INSERT role_id refusé, is_admin
--      reste false, édition profil normale OK, chemin admin/owner (service_role)
--      inchangé, is_admin() a bien search_path épinglé ;
--   5. [H] rollback 094 + prouve que la faille revient.
-- Chaque test échoué => RAISE EXCEPTION ; sinon RAISE NOTICE 'PASS …'.
-- ============================================================================

\set ON_ERROR_STOP on
\echo '=== [0] SETUP schéma minimal (réplique prod : roles + profiles + is_admin + RLS + grants) ==='

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

-- roles (réplique 001)
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);
insert into public.roles (name) values ('cavalier'), ('admin');
alter table public.roles enable row level security;
grant select, insert, update, delete on public.roles to authenticated;
grant select on public.roles to anon;

-- profiles (réplique 001)
create table public.profiles (
  id uuid primary key,
  full_name text,
  phone text,
  role_id uuid references public.roles(id) on delete set null,
  is_active boolean default true
);
alter table public.profiles enable row level security;
-- Grants RÉPLIQUE prod : authenticated peut écrire toutes colonnes (dont role_id).
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.profiles to anon;

-- is_admin() : réplique EXACTE prod (SECURITY DEFINER, SANS search_path au départ).
create or replace function public.is_admin() returns boolean
  language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and r.name = 'admin' and p.is_active = true
  );
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- Policies roles (réplique prod) : admin ALL + SELECT ouvert à tout authentifié.
create policy roles_all_admin on public.roles for all using (public.is_admin());
create policy roles_select_authenticated on public.roles for select to authenticated using (true);

-- Policies profiles RÉPLIQUE prod (mig 001) : la faille = update sans with check.
create policy profiles_select_own   on public.profiles for select using (id = auth.uid());
create policy profiles_select_admin on public.profiles for select using (public.is_admin());
create policy profiles_insert_own   on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_own   on public.profiles for update using (id = auth.uid());

-- Seed : un cavalier attaquant (a1) avec un profil rôle cavalier.
do $$
declare v_cav uuid := gen_random_uuid();
begin
  perform set_config('test.a1', v_cav::text, false);
  insert into public.profiles (id, full_name, role_id, is_active)
    values (v_cav, 'Attaquant', (select id from public.roles where name='cavalier'), true);
end $$;

\echo '=== [A] AVANT correctif : le cavalier lit l UUID admin et se promeut via UPDATE ==='
do $$
declare v_a1 uuid := current_setting('test.a1')::uuid; v_admin uuid; v_isadmin boolean;
begin
  perform set_config('test.uid', v_a1::text, false);
  set local role authenticated;
  -- lit librement l'uuid admin (roles_select_authenticated USING true)
  select id into v_admin from public.roles where name='admin';
  if v_admin is null then raise exception 'SETUP[A]: admin uuid illisible'; end if;
  update public.profiles set role_id = v_admin where id = v_a1;   -- escalade
  select public.is_admin() into v_isadmin;
  reset role;
  if not v_isadmin then raise exception 'PASS[A] attendu: faille non reproduite (is_admin=false)'; end if;
  raise notice 'PASS[A]: faille UPDATE reproduite AVANT correctif (is_admin=true)';
  -- reset pour le test suivant
  update public.profiles set role_id = (select id from public.roles where name='cavalier') where id = v_a1;
end $$;

\echo '=== [A2] AVANT correctif : escalade aussi via INSERT (nouveau user, role_id=admin) ==='
do $$
declare v_new uuid := gen_random_uuid(); v_admin uuid; v_isadmin boolean;
begin
  perform set_config('test.uid', v_new::text, false);
  set local role authenticated;
  select id into v_admin from public.roles where name='admin';
  insert into public.profiles (id, full_name, role_id, is_active) values (v_new, 'Neo', v_admin, true);
  select public.is_admin() into v_isadmin;
  reset role;
  if not v_isadmin then raise exception 'PASS[A2] attendu: INSERT non exploité'; end if;
  raise notice 'PASS[A2]: faille INSERT reproduite AVANT correctif (is_admin=true)';
  delete from public.profiles where id = v_new;  -- cleanup
end $$;

\echo '=== [B] APPLICATION migration 094 ==='
-- Verrou colonne : retire le grant table-level (couvre role_id) puis re-grant
-- uniquement les colonnes non sensibles présentes dans la table du harness.
revoke insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant insert (id, full_name, phone, is_active) on public.profiles to authenticated;
grant update (full_name, phone, is_active) on public.profiles to authenticated;
alter policy profiles_update_own on public.profiles
  using (id = auth.uid()) with check (id = auth.uid());
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and r.name = 'admin' and p.is_active = true
  );
$$;

\echo '=== [C] APRÈS correctif : UPDATE role_id refusé (permission denied colonne) ==='
do $$
declare v_a1 uuid := current_setting('test.a1')::uuid; v_admin uuid; v_denied boolean := false; v_isadmin boolean;
begin
  perform set_config('test.uid', v_a1::text, false);
  select id into v_admin from public.roles where name='admin';
  begin
    set local role authenticated;
    update public.profiles set role_id = v_admin where id = v_a1;
    reset role;
  exception when insufficient_privilege then
    v_denied := true; reset role;
  end;
  perform set_config('test.uid', v_a1::text, false);
  set local role authenticated;
  select public.is_admin() into v_isadmin;
  reset role;
  if not v_denied then raise exception 'FAIL[C]: UPDATE role_id NON refusé'; end if;
  if v_isadmin then raise exception 'FAIL[C]: is_admin=true malgré le correctif'; end if;
  raise notice 'PASS[C]: UPDATE role_id refusé + is_admin reste false';
end $$;

\echo '=== [D] APRÈS correctif : INSERT avec role_id refusé ==='
do $$
declare v_new uuid := gen_random_uuid(); v_admin uuid; v_denied boolean := false;
begin
  perform set_config('test.uid', v_new::text, false);
  select id into v_admin from public.roles where name='admin';
  begin
    set local role authenticated;
    insert into public.profiles (id, full_name, role_id, is_active) values (v_new, 'Neo2', v_admin, true);
    reset role;
  exception when insufficient_privilege then
    v_denied := true; reset role;
  end;
  if not v_denied then raise exception 'FAIL[D]: INSERT role_id NON refusé'; end if;
  raise notice 'PASS[D]: INSERT avec role_id refusé';
end $$;

\echo '=== [E] APRÈS correctif : édition profil normale (full_name) toujours OK ==='
do $$
declare v_a1 uuid := current_setting('test.a1')::uuid; v_name text;
begin
  perform set_config('test.uid', v_a1::text, false);
  set local role authenticated;
  update public.profiles set full_name = 'Attaquant repenti', phone = '0600000000' where id = v_a1;
  reset role;
  select full_name into v_name from public.profiles where id = v_a1;
  if v_name <> 'Attaquant repenti' then raise exception 'FAIL[E]: update profil KO'; end if;
  raise notice 'PASS[E]: update profil normal OK (role_id non touché)';
end $$;

\echo '=== [F] APRÈS correctif : le propriétaire/service (owner) peut toujours écrire role_id ==='
do $$
declare v_a1 uuid := current_setting('test.a1')::uuid; v_rid uuid;
begin
  -- exécuté SANS set role authenticated → rôle courant = owner du harness (≈ service_role/postgres)
  update public.profiles set role_id = (select id from public.roles where name='admin') where id = v_a1;
  select role_id into v_rid from public.profiles where id = v_a1;
  if v_rid <> (select id from public.roles where name='admin') then raise exception 'FAIL[F]: owner ne peut pas écrire role_id'; end if;
  raise notice 'PASS[F]: chemin owner/service_role écrit role_id (garde ciblée authenticated)';
  update public.profiles set role_id = (select id from public.roles where name='cavalier') where id = v_a1; -- reset
end $$;

\echo '=== [G] APRÈS correctif : is_admin() a bien search_path épinglé ==='
do $$
declare v_cfg text;
begin
  select array_to_string(proconfig, ',') into v_cfg from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='is_admin';
  if v_cfg is null or v_cfg not like '%search_path=public%' then
    raise exception 'FAIL[G]: is_admin search_path non épinglé (%)', coalesce(v_cfg,'<none>');
  end if;
  raise notice 'PASS[G]: is_admin search_path=public épinglé';
end $$;

\echo '=== [H] ROLLBACK 094 : la faille revient (prouve que 094 = la protection) ==='
grant insert on public.profiles to authenticated;
grant update on public.profiles to authenticated;
revoke insert (id, full_name, phone, is_active) on public.profiles from authenticated;
revoke update (full_name, phone, is_active) on public.profiles from authenticated;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid());
create or replace function public.is_admin() returns boolean
  language sql stable security definer as $$
  select exists (select 1 from public.profiles p join public.roles r on r.id=p.role_id
    where p.id=auth.uid() and r.name='admin' and p.is_active=true);
$$;
do $$
declare v_a1 uuid := current_setting('test.a1')::uuid; v_isadmin boolean;
begin
  perform set_config('test.uid', v_a1::text, false);
  set local role authenticated;
  update public.profiles set role_id = (select id from public.roles where name='admin') where id = v_a1;
  select public.is_admin() into v_isadmin;
  reset role;
  if not v_isadmin then raise exception 'FAIL[H]: faille non revenue après rollback'; end if;
  raise notice 'PASS[H]: sans garde la faille revient (confirme que 094 est la protection)';
end $$;

\echo '=== HARNESS 094 TERMINÉ — tous les PASS ci-dessus ==='
