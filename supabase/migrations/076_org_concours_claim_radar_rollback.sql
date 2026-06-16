-- ============================================================================
-- ROLLBACK 076 — Espace Organisateur P0 (claim + radar)
-- Réversible et idempotent. N'affecte que les objets créés par 076.
-- ============================================================================
begin;

drop function if exists public.fn_org_concours_radar(uuid, int);
drop function if exists public.fn_org_owns_concours(uuid);

drop trigger if exists trg_concours_claims_review on public.concours_claims;
drop function if exists public.tg_concours_claims_review();

drop policy if exists cc_update_admin        on public.concours_claims;
drop policy if exists cc_select_own_or_admin on public.concours_claims;
drop policy if exists cc_insert_own          on public.concours_claims;

drop table if exists public.concours_claims;

commit;
