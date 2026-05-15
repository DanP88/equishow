-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 023 — RPC change_user_role : autoriser organisateur libre
--
-- Avant (mig 006) : organisateur réservé à un user déjà organisateur/admin
-- (concept "promotion contrôlée").
--
-- Décision produit : un cavalier ou un coach doit pouvoir basculer organisateur
-- librement depuis /compte-type (un seul utilisateur peut porter plusieurs
-- casquettes : il monte ET organise des concours).
--
-- Admin reste strictement protégé (jamais attribuable côté client).
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.change_user_role(text);

create or replace function public.change_user_role(p_new_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid;
  v_current public.users%rowtype;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  if p_new_role not in ('cavalier','coach','organisateur','admin') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  select * into v_current from public.users where id = v_uid;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  -- Promotion admin interdite sauf si déjà admin (anti-élévation client).
  if p_new_role = 'admin' and v_current.role <> 'admin' then
    raise exception 'forbidden_admin_promotion' using errcode = '42501';
  end if;

  -- cavalier ↔ coach ↔ organisateur : transitions libres.
  -- (l'ancienne restriction "organisateur réservé" est levée.)

  update public.users
     set role = p_new_role
   where id = v_uid;

  return p_new_role;
end;
$$;

revoke all     on function public.change_user_role(text) from public;
revoke all     on function public.change_user_role(text) from anon;
grant  execute on function public.change_user_role(text) to authenticated;

comment on function public.change_user_role(text) is
  'Change le rôle du caller (auth.uid). cavalier/coach/organisateur libres. Admin protégé (mig 023).';
