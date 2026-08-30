-- ============================================================================
-- ROLLBACK 105 — retire le trigger de synchro notif ↔ demande.
-- NB : ne « dé-résout » pas les notifs déjà mises à jour par le backfill
-- (elles étaient de toute façon obsolètes).
-- ============================================================================

begin;

drop trigger if exists trg_sync_notif_course on public.course_demands;
drop trigger if exists trg_sync_notif_stage  on public.stage_reservations;
drop function if exists public.fn_sync_demand_notification();

commit;
