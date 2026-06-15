-- ============================================================================
-- ROLLBACK 074 — CONCOURS HUB · LOT 1
-- ============================================================================
-- Réversible à 100%. Retire colonnes + table sans toucher aux données annonces
-- (les colonnes concours_id étant nullables et additives, leur drop ne perd que
-- le lien concours, jamais une annonce/réservation/paiement).
-- ============================================================================

begin;

-- 5/4. concours_id sur annonces (index droppés en cascade avec la colonne)
alter table public.box_annonces        drop column if exists concours_id;
alter table public.transport_annonces  drop column if exists concours_id;
alter table public.coach_annonces       drop column if exists concours_id;
alter table public.stages               drop column if exists concours_id;
alter table public.course_demands       drop column if exists concours_id;

-- 3/2/1. trigger + table concours (RLS/policies/index droppés avec la table)
drop trigger if exists trg_concours_touch on public.concours;
drop function if exists public.tg_concours_touch_updated_at();
drop table if exists public.concours cascade;

commit;
