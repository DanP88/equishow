-- ============================================================================
-- ROLLBACK 075 — CONCOURS FOLLOWERS · LOT 2A + 2B
-- ============================================================================
-- Réversible à 100%. Ne touche pas 074 (table concours conservée), retire
-- seulement la couche followers + le compteur dénormalisé. Aucune donnée
-- annonce/réservation/paiement impactée.
-- ============================================================================

begin;

-- 3. trigger + fonction compteur
drop trigger if exists trg_concours_followers_count on public.concours_followers;
drop function if exists public.tg_concours_followers_count();

-- 1/2/5. table followers (index + RLS policies droppés en cascade avec la table)
drop table if exists public.concours_followers cascade;

-- 3. colonne dénormalisée sur concours
alter table public.concours drop column if exists followers_count;

commit;
