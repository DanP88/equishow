-- ============================================================================
-- ROLLBACK 078 — retire cheval_id des 4 tables de réservation.
-- Sûr : colonne nullable additive, aucune dépendance. Perd les rattachements
-- cheval↔réservation saisis depuis l'application.
-- ============================================================================

begin;

drop index if exists public.idx_box_reservations_cheval;
drop index if exists public.idx_transport_reservations_cheval;
drop index if exists public.idx_course_demands_cheval;
drop index if exists public.idx_stage_reservations_cheval;

alter table public.box_reservations       drop column if exists cheval_id;
alter table public.transport_reservations  drop column if exists cheval_id;
alter table public.course_demands          drop column if exists cheval_id;
alter table public.stage_reservations      drop column if exists cheval_id;

commit;
