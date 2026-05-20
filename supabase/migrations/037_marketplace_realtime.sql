-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 037 — Activer realtime pour les tables marketplace
--
-- Symptôme : après création d'un stage (proposer-stage), il n'apparaît sur la
-- page de stages qu'après rechargement manuel. Cause : la table `stages`
-- n'était pas dans la publication supabase_realtime, donc le hook useStages
-- (`.on('postgres_changes', { table: 'stages' })`) ne recevait jamais d'event
-- → pas de reload auto. Combiné au fire-and-navigate (la page liste se monte
-- après l'émission du pubsub optimistic), rien ne déclenche l'affichage.
--
-- Même piège que mig 028 (notifications), 034 (chevaux), 035 (users).
-- 4e occurrence → on corrige TOUTES les tables marketplace abonnées en
-- postgres_changes mais absentes de la publication, d'un coup.
--
-- Exclues volontairement : conversations / messages (tables inexistantes,
-- messagerie encore in-memory).
--
-- Fix idempotent : ajoute chaque table à la publication si absente, puis
-- replica identity full (pour que les UPDATE/DELETE embarquent les colonnes
-- nécessaires aux hooks qui filtrent sur une colonne non-PK).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
  tables text[] := array[
    'stages',
    'stage_reservations',
    'coach_annonces',
    'course_demands',
    'box_annonces',
    'box_reservations',
    'transport_annonces',
    'transport_reservations',
    'avis'
  ];
begin
  foreach t in array tables loop
    -- Garde-fou : ne traite que les tables réellement présentes
    if exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = t
    ) then
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
      execute format('alter table public.%I replica identity full', t);
    end if;
  end loop;
end $$;
