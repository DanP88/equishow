-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 026 — RPC toggle_post_like + toggle_comment_like (P26 bugfix)
--
-- Contexte : la policy UPDATE de mig 025 sur posts_* / com_posts_* est
-- `auteur_id = auth.uid()`. Liker le post/comment d'un autre user passe par
-- update(liked_by) qui est silencieusement bloqué par RLS → like UI optimistic
-- visible 1s puis revert au reload.
--
-- Fix : 2 RPC SECURITY DEFINER qui mutent liked_by en bypassant RLS, avec
-- check de rôle pour les scopes 'coach' / 'organisateur'.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── toggle_post_like ────────────────────────────────────────────────────────
create or replace function public.toggle_post_like(p_scope text, p_post_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_table text;
  v_role text;
  v_liked_by uuid[];
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;

  if p_scope = 'community' then
    v_table := 'public.posts_community';
  elsif p_scope = 'coach' then
    v_table := 'public.posts_coach';
    select role into v_role from public.users where id = v_uid;
    if v_role not in ('coach','admin') then
      raise exception 'forbidden';
    end if;
  elsif p_scope = 'organisateur' then
    v_table := 'public.posts_organisateur';
    select role into v_role from public.users where id = v_uid;
    if v_role not in ('organisateur','admin') then
      raise exception 'forbidden';
    end if;
  else
    raise exception 'invalid scope';
  end if;

  execute format(
    'update %s set liked_by = case when $1 = any(liked_by) then array_remove(liked_by, $1) else liked_by || $1 end where id = $2 returning liked_by',
    v_table
  ) using v_uid, p_post_id into v_liked_by;

  if v_liked_by is null then
    raise exception 'post not found';
  end if;

  return v_liked_by;
end;
$$;

revoke all on function public.toggle_post_like(text, uuid) from public;
grant execute on function public.toggle_post_like(text, uuid) to authenticated;

-- ── toggle_comment_like ─────────────────────────────────────────────────────
create or replace function public.toggle_comment_like(p_scope text, p_comment_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_table text;
  v_role text;
  v_liked_by uuid[];
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;

  if p_scope = 'community' then
    v_table := 'public.com_posts_community';
  elsif p_scope = 'coach' then
    v_table := 'public.com_posts_coach';
    select role into v_role from public.users where id = v_uid;
    if v_role not in ('coach','admin') then
      raise exception 'forbidden';
    end if;
  elsif p_scope = 'organisateur' then
    v_table := 'public.com_posts_organisateur';
    select role into v_role from public.users where id = v_uid;
    if v_role not in ('organisateur','admin') then
      raise exception 'forbidden';
    end if;
  else
    raise exception 'invalid scope';
  end if;

  execute format(
    'update %s set liked_by = case when $1 = any(liked_by) then array_remove(liked_by, $1) else liked_by || $1 end where id = $2 returning liked_by',
    v_table
  ) using v_uid, p_comment_id into v_liked_by;

  if v_liked_by is null then
    raise exception 'comment not found';
  end if;

  return v_liked_by;
end;
$$;

revoke all on function public.toggle_comment_like(text, uuid) from public;
grant execute on function public.toggle_comment_like(text, uuid) to authenticated;
