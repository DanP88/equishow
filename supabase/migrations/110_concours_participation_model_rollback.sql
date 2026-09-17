-- ============================================================================
-- ROLLBACK 110 — CONCOURS PARTICIPATION MODEL
-- ============================================================================
-- Réversible à 100%. Retire concours_presence_chevaux (table + index + RLS
-- policies droppés en cascade) et les 4 colonnes ajoutées à concours_presence
-- (epreuves, transport_skip, box_skip, coach_skip). Ne touche PAS cheval_id
-- (colonne pré-existante, 089) ni la table chevaux. Aucune donnée annonce/
-- réservation/paiement impactée.
-- ============================================================================

begin;

drop table if exists public.concours_presence_chevaux cascade;

alter table public.concours_presence
  drop column if exists epreuves,
  drop column if exists transport_skip,
  drop column if exists box_skip,
  drop column if exists coach_skip;

commit;
