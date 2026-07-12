-- ============================================================================
-- ROLLBACK 093 — retire la garde anti auto-promotion de rôle.
-- ⚠️ Réintroduit la vulnérabilité P0 (self-admin via UPDATE direct). Ne rollback
-- que pour diagnostic sur cluster jetable.
-- ============================================================================
begin;

drop trigger if exists trg_users_guard_role on public.users;
drop function if exists public.tg_users_guard_role();

commit;
