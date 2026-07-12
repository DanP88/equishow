-- ============================================================================
-- HARNESS 093 — GARDE ANTI AUTO-PROMOTION DE RÔLE (P0 sécurité)
-- ============================================================================
-- AUTO-PORTANT. POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_093
--   psql -d eq_harness_093 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/093_users_guard_role/harness.sql
--
--   1. schéma minimal users + RLS (réplique de la config prod : users_update_own
--      SANS with check + grant update role) + auth.uid() stub + rôles ;
--   2. is_app_admin() + change_user_role() (réplique fidèle SECURITY DEFINER prod) ;
--   3. [A] PROUVE la faille AVANT correctif (self-admin réussit) ;
--   4. applique 093 (trigger de garde) ;
--   5. [C..G] prouve : self-promotion neutralisée, profil toujours modifiable,
--      change_user_role toujours fonctionnel + blocage admin conservé, admin OK ;
--   6. [H] rollback 093 + prouve que la faille revient (=> le trigger EST la garde).
-- Chaque test échoué => RAISE EXCEPTION ; sinon RAISE NOTICE 'PASS …'.
-- ============================================================================

\set ON_ERROR_STOP on
\echo '=== [0] SETUP schéma minimal + auth + rôles + RLS (réplique prod) ==='

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
  id uuid primary key,
  full_name text,
  role text not null default 'cavalier'
);
-- Réplique EXACTE du grant prod (authenticated peut écrire, y compris la colonne role).
grant select, insert, update on public.users to authenticated;

alter table public.users enable row level security;

-- is_app_admin() : SECURITY DEFINER (comme prod) → lit users hors RLS.
create or replace function public.is_app_admin() returns boolean
  language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_app_admin() to authenticated, anon;

-- Policies RÉPLIQUES de la prod (mig 005 + users_admin_all) :
create policy users_select_self on public.users for select using (id = auth.uid());
create policy users_admin_all   on public.users for all    using (is_app_admin());
create policy users_insert_own  on public.users for insert with check (id = auth.uid());
-- ⚠️ La faille : USING sans WITH CHECK → role non contraint.
create policy users_update_own  on public.users for update using (id = auth.uid());

-- change_user_role() : réplique fidèle de la RPC prod (SECURITY DEFINER, owner=superuser).
create or replace function public.change_user_role(p_new_role text)
returns text language plpgsql security definer set search_path=public as $$
declare v_uid uuid; v_current public.users%rowtype;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'unauthenticated' using errcode='28000'; end if;
  if p_new_role not in ('cavalier','coach','organisateur','admin') then
    raise exception 'invalid_role' using errcode='22023'; end if;
  select * into v_current from public.users where id=v_uid;
  if not found then raise exception 'user_not_found' using errcode='P0002'; end if;
  if p_new_role='admin' and v_current.role <> 'admin' then
    raise exception 'forbidden_admin_promotion' using errcode='42501'; end if;
  update public.users set role=p_new_role where id=v_uid;
  return p_new_role;
end $$;
grant execute on function public.change_user_role(text) to authenticated;

-- Seed : u1 cavalier (attaquant/self), uad admin, u2 cavalier (cible admin).
insert into public.users(id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000a1','Alice','cavalier'),
  ('00000000-0000-0000-0000-0000000000ad','Admin','admin'),
  ('00000000-0000-0000-0000-0000000000a2','Bob','cavalier');

\echo '=== [A] AVANT correctif : un cavalier PEUT se promouvoir admin (faille) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
update public.users set role='admin' where id='00000000-0000-0000-0000-0000000000a1';
reset role;
do $$ begin
  if (select role from public.users where id='00000000-0000-0000-0000-0000000000a1') <> 'admin' then
    raise exception 'FAIL[A]: la faille attendue ne se reproduit pas (setup incorrect)';
  end if;
  raise notice 'PASS[A]: faille reproduite AVANT correctif (a1 est devenu admin)';
end $$;
-- remise à l'état initial (superuser, sans trigger)
update public.users set role='cavalier' where id='00000000-0000-0000-0000-0000000000a1';

\echo '=== [B] APPLICATION migration 093 (trigger de garde) ==='
\ir ../../migrations/093_users_guard_role.sql

\echo '=== [C] APRÈS correctif : auto-promotion NEUTRALISÉE (role inchangé) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
update public.users set role='admin' where id='00000000-0000-0000-0000-0000000000a1';  -- neutralisé, pas d'erreur
reset role;
do $$ begin
  if (select role from public.users where id='00000000-0000-0000-0000-0000000000a1') <> 'cavalier' then
    raise exception 'FAIL[C]: a1 a réussi à se promouvoir admin malgré le trigger';
  end if;
  raise notice 'PASS[C]: auto-promotion bloquée (a1 reste cavalier)';
end $$;

\echo '=== [D] APRÈS correctif : les champs de profil restent modifiables ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
update public.users set full_name='Alice Modifiée' where id='00000000-0000-0000-0000-0000000000a1';
reset role;
do $$ begin
  if (select full_name from public.users where id='00000000-0000-0000-0000-0000000000a1') <> 'Alice Modifiée' then
    raise exception 'FAIL[D]: mise à jour du profil bloquée à tort';
  end if;
  raise notice 'PASS[D]: profil (full_name) toujours modifiable';
end $$;

\echo '=== [E] change_user_role : changement légitime cavalier->coach fonctionne ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.change_user_role('coach');
reset role;
do $$ begin
  if (select role from public.users where id='00000000-0000-0000-0000-0000000000a1') <> 'coach' then
    raise exception 'FAIL[E]: change_user_role(coach) neutralisé à tort par le trigger';
  end if;
  raise notice 'PASS[E]: change_user_role(coach) fonctionne (definer contourne la garde)';
end $$;

\echo '=== [F] change_user_role : promotion admin par non-admin toujours bloquée ==='
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
do $$ begin
  begin
    perform public.change_user_role('admin');   -- a1 = coach → doit lever forbidden_admin_promotion (42501)
    raise exception 'FAIL[F]: promotion admin acceptée';
  exception
    when insufficient_privilege then raise notice 'PASS[F]: change_user_role(admin) bloqué (forbidden_admin_promotion)';
  end;
end $$;
do $$ begin
  if (select role from public.users where id='00000000-0000-0000-0000-0000000000a1') = 'admin' then
    raise exception 'FAIL[F]: a1 est devenu admin';
  end if;
  raise notice 'PASS[F bis]: a1 n''est pas admin après tentative';
end $$;

\echo '=== [G] Un admin PEUT changer le rôle d''un autre user (écriture directe) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000ad', false);
update public.users set role='coach' where id='00000000-0000-0000-0000-0000000000a2';
reset role;
do $$ begin
  if (select role from public.users where id='00000000-0000-0000-0000-0000000000a2') <> 'coach' then
    raise exception 'FAIL[G]: admin n''a pas pu changer le rôle de a2';
  end if;
  raise notice 'PASS[G]: admin peut changer un rôle (garde ignorée pour admin)';
end $$;

\echo '=== [H] ROLLBACK 093 : la garde disparaît et la faille revient ==='
\ir ../../migrations/093_users_guard_role_rollback.sql
do $$ begin
  if exists (select 1 from pg_trigger where tgname='trg_users_guard_role') then
    raise exception 'FAIL[H]: trigger non retiré par le rollback';
  end if;
  if exists (select 1 from pg_proc where proname='tg_users_guard_role') then
    raise exception 'FAIL[H]: fonction non retirée par le rollback';
  end if;
  raise notice 'PASS[H]: rollback propre (trigger + fonction absents)';
end $$;
-- re-preuve : sans la garde, l'auto-promotion réussit à nouveau (a2 est cavalier->admin)
update public.users set role='cavalier' where id='00000000-0000-0000-0000-0000000000a2';
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
update public.users set role='admin' where id='00000000-0000-0000-0000-0000000000a2';
reset role;
do $$ begin
  if (select role from public.users where id='00000000-0000-0000-0000-0000000000a2') <> 'admin' then
    raise exception 'FAIL[H bis]: incohérence — la faille aurait dû revenir après rollback';
  end if;
  raise notice 'PASS[H bis]: sans garde la faille revient (confirme que 093 est bien la protection)';
end $$;

\echo '=== HARNESS 093 TERMINÉ — tous les PASS ci-dessus ==='
