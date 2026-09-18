-- ============================================================================
-- ROLLBACK 112 — Realtime recherches ouvertes Transport (Lot 0)
-- ============================================================================
-- Réversible à 100%. Retire les 4 tables 111 de la publication
-- `supabase_realtime` et remet leur REPLICA IDENTITY à DEFAULT (clé
-- primaire uniquement). Ne touche à AUCUNE donnée, AUCUNE RLS, AUCUNE autre
-- table ou publication. Aucun impact V1/Box/Coach/payments/escrow.
--
-- Emplacement volontairement HORS de supabase/migrations/ (même raison que
-- 111 : le CLI `supabase migration list` interprète tout fichier préfixé
-- par un numéro dans ce dossier comme une migration candidate).
--
-- Application manuelle si besoin :
--   supabase db query -f supabase/rollbacks/112_transport_recherches_realtime_rollback.sql --linked
-- (jamais via `migration repair` — ce fichier n'est pas une migration).
-- ============================================================================

do $$
declare
  t text;
  tables text[] := array[
    'transport_recherches',
    'transport_recherche_chevaux',
    'transport_recherche_reponses',
    'transport_reservation_chevaux'
  ];
begin
  foreach t in array tables loop
    if exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = t
    ) then
      if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime drop table public.%I', t);
      end if;
      execute format('alter table public.%I replica identity default', t);
    end if;
  end loop;
end $$;
