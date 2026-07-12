-- ============================================================================
-- HARNESS 095 — REBASE AUTORISATIONS ADMIN SUR users.role (is_app_admin)
-- ============================================================================
-- AUTO-PORTANT. POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_095
--   psql -d eq_harness_095 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/095_admin_authz_on_users_role/harness.sql
--
-- Réplique la config prod pertinente :
--   • users(role) + is_app_admin() (users.role) + change_user_role() + garde 093
--     (trg_users_guard_role) + verrou colonne 094-like (grant par colonne) ;
--   • legacy profiles/roles + is_admin() (role_id NULL ⇒ false partout) ;
--   • 2 tables cibles représentatives : audit_logs (SELECT admin restauré) et
--     concours_categories (écriture admin restaurée) ; + profiles/roles pour les
--     policies admin NON reconduites.
-- Démontre AVANT (is_admin legacy ⇒ admin sans accès) puis APRÈS 095
-- (is_app_admin ⇒ admin a l'accès prévu, non-admins refusés), + les 10 scénarios.
-- Chaque échec => RAISE EXCEPTION ; sinon RAISE NOTICE 'PASS …'.
-- ============================================================================

\set ON_ERROR_STOP on
\echo '=== [0] SETUP (réplique prod : users/is_app_admin/093/094 + legacy + cibles) ==='

create schema if not exists auth;
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end $$;
grant usage on schema public, auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

-- ── users (autoritatif) ────────────────────────────────────────────────────
create table public.users (id uuid primary key, full_name text, role text not null default 'cavalier');
grant select, insert on public.users to authenticated;
grant update (full_name) on public.users to authenticated;   -- (094-like : role non grantable direct)
grant update (full_name, role) on public.users to authenticated; -- réplique la FAILLE d'origine pour prouver la garde 093
alter table public.users enable row level security;

create or replace function public.is_app_admin() returns boolean
  language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin'); $$;
grant execute on function public.is_app_admin() to authenticated, anon;

-- garde 093 : neutralise l'auto-promotion de users.role par un authenticated non-admin
create or replace function public.tg_users_guard_role() returns trigger
  language plpgsql security invoker set search_path=public as $$
  begin
    if new.role is distinct from old.role and current_user='authenticated'
       and not exists (select 1 from public.users u where u.id=auth.uid() and u.role='admin')
    then new.role := old.role; end if;
    return new;
  end; $$;
create trigger trg_users_guard_role before update on public.users for each row execute function public.tg_users_guard_role();

create policy users_select_self on public.users for select using (id = auth.uid());
create policy users_admin_all   on public.users for all    using (public.is_app_admin());
create policy users_insert_own  on public.users for insert with check (id = auth.uid());
create policy users_update_own  on public.users for update using (id = auth.uid()) with check (id = auth.uid());

-- change_user_role() : réplique fidèle (SECURITY DEFINER owner, bloque promo admin)
create or replace function public.change_user_role(p_new_role text) returns void
  language plpgsql security definer set search_path=public as $$
  begin
    if p_new_role = 'admin' then raise exception 'forbidden_admin_promotion'; end if;
    update public.users set role = p_new_role where id = auth.uid();
  end; $$;
grant execute on function public.change_user_role(text) to authenticated;

-- ── legacy profiles/roles/is_admin (role_id NULL ⇒ is_admin=false partout) ──
create table public.roles (id uuid primary key default gen_random_uuid(), name text unique);
insert into public.roles(name) values('cavalier'),('admin');
alter table public.roles enable row level security;
grant select on public.roles to authenticated;
create table public.profiles (id uuid primary key, role_id uuid references public.roles(id) on delete set null, is_active boolean default true);
alter table public.profiles enable row level security;
grant select, insert on public.profiles to authenticated;
grant update (is_active) on public.profiles to authenticated;   -- 094-like : role_id NON grantable
create policy profiles_update_own on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.profiles p join public.roles r on r.id=p.role_id
    where p.id=auth.uid() and r.name='admin' and p.is_active=true); $$;
grant execute on function public.is_admin() to authenticated, anon;

-- ── tables cibles représentatives ──────────────────────────────────────────
create table public.audit_logs (id serial primary key, msg text);
insert into public.audit_logs(msg) values ('secret-audit');
alter table public.audit_logs enable row level security;
grant select on public.audit_logs to authenticated;

create table public.concours_categories (id serial primary key, label text);
alter table public.concours_categories enable row level security;
grant select, insert, update, delete on public.concours_categories to authenticated;
grant usage, select on sequence public.concours_categories_id_seq to authenticated;
create policy cc_select_public on public.concours_categories for select using (true);

-- Policies admin ÉTAT D'ORIGINE (legacy is_admin) sur profiles/roles/audit/cc.
create policy profiles_select_admin on public.profiles for select using (public.is_admin());
create policy roles_all_admin       on public.roles    for all    using (public.is_admin());
create policy audit_logs_select_admin on public.audit_logs for select using (public.is_admin());
create policy cc_insert_admin on public.concours_categories for insert with check (public.is_admin());
create policy cc_update_admin on public.concours_categories for update using (public.is_admin()) with check (public.is_admin());
create policy cc_delete_admin on public.concours_categories for delete using (public.is_admin());

-- Seed acteurs (users.role autoritatif ; profiles.role_id NULL comme en prod)
do $$
declare v_cav uuid:=gen_random_uuid(); v_coa uuid:=gen_random_uuid(); v_org uuid:=gen_random_uuid(); v_adm uuid:=gen_random_uuid();
begin
  insert into public.users(id,role) values (v_cav,'cavalier'),(v_coa,'coach'),(v_org,'organisateur'),(v_adm,'admin');
  insert into public.profiles(id,role_id,is_active) values (v_cav,null,true),(v_adm,null,true); -- role_id NULL (prod)
  perform set_config('test.cav',v_cav::text,false);
  perform set_config('test.coa',v_coa::text,false);
  perform set_config('test.org',v_org::text,false);
  perform set_config('test.adm',v_adm::text,false);
end $$;

-- Helper : compte de lignes audit_logs visibles pour un uid donné (sous authenticated)
create or replace function public._visible_audit(p_uid uuid) returns bigint
  language plpgsql as $$
  declare n bigint;
  begin
    perform set_config('test.uid', p_uid::text, true);
    set local role authenticated;
    select count(*) into n from public.audit_logs;
    reset role;
    return n;
  end; $$;

\echo '=== [A] AVANT 095 : admin réel N''A PAS accès (is_admin legacy=false, role_id NULL) ==='
do $$ begin
  if public._visible_audit(current_setting('test.adm')::uuid) <> 0 then
    raise exception 'FAIL[A]: admin voit audit_logs AVANT (legacy devait être cassé)'; end if;
  raise notice 'PASS[A]: AVANT 095 l''admin ne voit pas audit_logs (legacy is_admin=false)';
end $$;

\echo '=== [B] APPLICATION migration 095 (rebase is_app_admin + drop legacy admin) ==='
alter policy audit_logs_select_admin on public.audit_logs using (public.is_app_admin());
alter policy cc_insert_admin on public.concours_categories with check (public.is_app_admin());
alter policy cc_update_admin on public.concours_categories using (public.is_app_admin()) with check (public.is_app_admin());
alter policy cc_delete_admin on public.concours_categories using (public.is_app_admin());
drop policy profiles_select_admin on public.profiles;
drop policy roles_all_admin on public.roles;

\echo '=== [1-3] cavalier / coach / organisateur : AUCUN accès admin ==='
do $$
declare k text; uid uuid; denied boolean;
begin
  foreach k in array array['cav','coa','org'] loop
    uid := current_setting('test.'||k)::uuid;
    -- lecture audit_logs = 0 ligne
    if public._visible_audit(uid) <> 0 then raise exception 'FAIL[1-3] % voit audit_logs', k; end if;
    -- insert concours_categories refusé (RLS with check is_app_admin false)
    denied := false;
    begin
      perform set_config('test.uid', uid::text, true);
      set local role authenticated;
      insert into public.concours_categories(label) values ('x-'||k);
      reset role;
    exception when others then denied := true; reset role;
    end;
    if not denied then raise exception 'FAIL[1-3] % a pu insérer une catégorie', k; end if;
  end loop;
  raise notice 'PASS[1-3]: cavalier/coach/organisateur = 0 accès admin (lecture + écriture refusées)';
end $$;

\echo '=== [4] admin réel : lit les tables prévues (audit_logs) ==='
do $$ begin
  if public._visible_audit(current_setting('test.adm')::uuid) <> 1 then
    raise exception 'FAIL[4]: admin ne lit pas audit_logs après 095'; end if;
  raise notice 'PASS[4]: admin lit audit_logs (rebase users.role OK)';
end $$;

\echo '=== [5] admin : écritures explicitement autorisées (concours_categories) ==='
do $$
declare v_adm uuid := current_setting('test.adm')::uuid; v_id int;
begin
  perform set_config('test.uid', v_adm::text, true);
  set local role authenticated;
  insert into public.concours_categories(label) values ('CSO') returning id into v_id;
  update public.concours_categories set label='CSO-maj' where id=v_id;
  delete from public.concours_categories where id=v_id;
  reset role;
  raise notice 'PASS[5]: admin insert/update/delete concours_categories OK';
end $$;

\echo '=== [6] admin : écritures NON nécessaires refusées (roles legacy, policy droppée) ==='
do $$
declare v_adm uuid := current_setting('test.adm')::uuid; denied boolean := false;
begin
  begin
    perform set_config('test.uid', v_adm::text, true);
    set local role authenticated;
    insert into public.roles(name) values ('should-fail');
    reset role;
  exception when others then denied := true; reset role;
  end;
  if not denied then raise exception 'FAIL[6]: admin a pu écrire dans roles (droit non reconduit)'; end if;
  raise notice 'PASS[6]: admin NE peut PAS écrire roles (moindre privilège respecté)';
end $$;

\echo '=== [7] un user ne devient pas admin en modifiant profiles (verrou 094) ==='
do $$
declare v_cav uuid := current_setting('test.cav')::uuid; denied boolean := false; v_admrole uuid;
begin
  select id into v_admrole from public.roles where name='admin';
  begin
    perform set_config('test.uid', v_cav::text, true);
    set local role authenticated;
    update public.profiles set role_id = v_admrole where id = v_cav;  -- role_id non grantable
    reset role;
  exception when insufficient_privilege then denied := true; reset role;
  end;
  if not denied then raise exception 'FAIL[7]: update profiles.role_id non refusé'; end if;
  -- et is_app_admin reste false (autoritatif = users.role)
  perform set_config('test.uid', v_cav::text, true);
  set local role authenticated;
  if public.is_app_admin() then reset role; raise exception 'FAIL[7]: is_app_admin=true via profiles'; end if;
  reset role;
  raise notice 'PASS[7]: modifier profiles ne donne pas admin';
end $$;

\echo '=== [8] un user ne devient pas admin en modifiant users.role (garde 093) ==='
do $$
declare v_cav uuid := current_setting('test.cav')::uuid; v_role text;
begin
  perform set_config('test.uid', v_cav::text, true);
  set local role authenticated;
  update public.users set role='admin' where id=v_cav;  -- neutralisé par la garde
  select role into v_role from public.users where id=v_cav;
  reset role;
  if v_role = 'admin' then raise exception 'FAIL[8]: users.role auto-promu admin'; end if;
  raise notice 'PASS[8]: modifier users.role directement ne donne pas admin (role=%)', v_role;
end $$;

\echo '=== [9] change_user_role(admin) reste bloqué ==='
do $$
declare v_cav uuid := current_setting('test.cav')::uuid; blocked boolean := false;
begin
  begin
    perform set_config('test.uid', v_cav::text, true);
    set local role authenticated;
    perform public.change_user_role('admin');
    reset role;
  exception when others then blocked := true; reset role;
  end;
  if not blocked then raise exception 'FAIL[9]: change_user_role(admin) non bloqué'; end if;
  raise notice 'PASS[9]: change_user_role(admin) bloqué';
end $$;

\echo '=== [10] ROLLBACK 095 : restaure l''état antérieur (admin de nouveau sans accès) ==='
alter policy audit_logs_select_admin on public.audit_logs using (public.is_admin());
alter policy cc_insert_admin on public.concours_categories with check (public.is_admin());
alter policy cc_update_admin on public.concours_categories using (public.is_admin()) with check (public.is_admin());
alter policy cc_delete_admin on public.concours_categories using (public.is_admin());
create policy profiles_select_admin on public.profiles for select using (public.is_admin());
create policy roles_all_admin on public.roles for all using (public.is_admin());
do $$
declare has_prof boolean; has_roles boolean;
begin
  if public._visible_audit(current_setting('test.adm')::uuid) <> 0 then
    raise exception 'FAIL[10]: après rollback l''admin voit encore audit_logs (is_admin devait être false)'; end if;
  select exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_admin') into has_prof;
  select exists(select 1 from pg_policies where schemaname='public' and tablename='roles' and policyname='roles_all_admin') into has_roles;
  if not (has_prof and has_roles) then raise exception 'FAIL[10]: policies legacy non recréées (prof=%,roles=%)', has_prof, has_roles; end if;
  raise notice 'PASS[10]: rollback restaure l''état antérieur (policies legacy is_admin recréées)';
end $$;

\echo '=== HARNESS 095 TERMINÉ — tous les PASS ci-dessus ==='
