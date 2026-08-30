-- ============================================================================
-- ROLLBACK 106 — retire le trigger de status par défaut sur les notifs de demande.
-- NB : ne « dé-résout » pas les notifs déjà passées à 'rejected' (elles
--   correspondaient à des demandes expirées / non abouties de toute façon).
-- ============================================================================

begin;

drop trigger if exists trg_notifications_default_demand_status on public.notifications;
drop function if exists public.fn_notif_default_demand_status();

commit;
