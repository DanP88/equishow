-- ============================================================================
-- 084 ROLLBACK — CONCOURS CATÉGORIES
-- ============================================================================
-- Annule 084 intégralement. Aucun effet sur concours, payments, reservations,
-- escrow, followers, discussions. La table est enfant et isolée.
-- ============================================================================

begin;

drop view  if exists public.v_concours_categories_counts;
drop table if exists public.concours_categories cascade;

commit;
