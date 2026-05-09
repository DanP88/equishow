-- Migration 006 : RPC sécurisée pour changement de rôle utilisateur
-- Audit P6 : empêche l'élévation de privilèges côté client.
-- Règle métier :
--   * promotion admin réservée à un user déjà admin en base
--   * promotion organisateur réservée à un user déjà organisateur ou admin
--   * cavalier <-> coach libre (rôles classiques)
--   * un user ne peut modifier QUE son propre rôle (auth.uid())

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
  -- 1. Authentification obligatoire
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  -- 2. Validation enum (defense in depth + check constraint en DB)
  if p_new_role not in ('cavalier','coach','organisateur','admin') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  -- 3. Charger le row courant (par auth.uid uniquement -> pas d'IDOR possible)
  select * into v_current from public.users where id = v_uid;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  -- 4. AuthZ : promotion admin interdite sauf si déjà admin
  if p_new_role = 'admin' and v_current.role <> 'admin' then
    raise exception 'forbidden_admin_promotion' using errcode = '42501';
  end if;

  -- 5. AuthZ : promotion organisateur interdite sauf si déjà organisateur ou admin
  if p_new_role = 'organisateur'
     and v_current.role not in ('organisateur','admin') then
    raise exception 'forbidden_organisateur_promotion' using errcode = '42501';
  end if;

  -- 6. Update strict du caller (clause WHERE id = auth.uid -> aucune IDOR)
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
  'P6: secure self role change. Refuses admin/organisateur promotion if not already at that level.';
