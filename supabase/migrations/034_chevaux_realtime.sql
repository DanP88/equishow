-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 034 — Activer realtime pour public.chevaux
--
-- Symptôme : après update d'un cheval (ex changement de nom), le détail se
-- mettait à jour mais la liste (chevaux.tsx) gardait l'ancien nom. Cause :
-- chevaux n'était pas dans la publication supabase_realtime, donc les hooks
-- useMyChevaux / useCheval ne recevaient jamais d'event postgres_changes.
--
-- Fix idempotent : ajoute la table à la publication + replica identity full
-- (sinon les UPDATE n'embarquent que la PK, useChevaux n'a pas accès aux
-- nouveaux champs sur l'event).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chevaux'
  ) then
    alter publication supabase_realtime add table public.chevaux;
  end if;
end $$;

alter table public.chevaux replica identity full;
