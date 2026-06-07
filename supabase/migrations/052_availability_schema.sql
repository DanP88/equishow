-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 052 — F1 disponibilités : schéma (statuts, accepted_at, garde-fous)
--
-- Contexte : règle métier globale de gestion des disponibilités (validée 2026-06-03).
--   Consommation au passage pending→accepted ; libération sur rejected/cancelled/
--   expired/payment_expired. Délais 72h (vendeur) / 24h (paiement) via cron (mig 054).
--   Mécanique de dispo : Stage/Transport (compteur) + Box (chevauchement de dates).
--   COACH : exclusion de chevauchement (GiST) DIFFÉRÉE (données de test à assainir).
--           Toute l'architecture coach est conservée (statuts, accepted_at, guard,
--           cron) afin d'activer l'exclusion plus tard SANS refonte. Le DDL exact
--           est fourni en commentaire en fin de fichier (lot séparé futur).
--
-- Cette migration (052) ne fait que du schéma : étendre les CHECK statut, ajouter
--   accepted_at, et poser les CHECK >= 0 sur les compteurs Stage/Transport.
-- Non destructif. Aucune donnée réécrite.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Étendre les CHECK statut : +expired +payment_expired (vocabulaire unifié) ──

-- course_demands.status
do $$ declare cn text; begin
  select conname into cn from pg_constraint
   where conrelid='public.course_demands'::regclass and contype='c'
     and pg_get_constraintdef(oid) ilike '%status = ANY%';
  if cn is not null then execute format('alter table public.course_demands drop constraint %I', cn); end if;
  alter table public.course_demands add constraint course_demands_status_check
    check (status = any (array['pending','accepted','rejected','paid','completed','cancelled','expired','payment_expired']));
end $$;

-- stage_reservations.status
do $$ declare cn text; begin
  select conname into cn from pg_constraint
   where conrelid='public.stage_reservations'::regclass and contype='c'
     and pg_get_constraintdef(oid) ilike '%status = ANY%';
  if cn is not null then execute format('alter table public.stage_reservations drop constraint %I', cn); end if;
  alter table public.stage_reservations add constraint stage_reservations_status_check
    check (status = any (array['pending','accepted','rejected','paid','completed','cancelled','expired','payment_expired']));
end $$;

-- box_reservations.status (conserve awaiting_payment vestigial)
do $$ declare cn text; begin
  select conname into cn from pg_constraint
   where conrelid='public.box_reservations'::regclass and contype='c'
     and pg_get_constraintdef(oid) ilike '%status = ANY%';
  if cn is not null then execute format('alter table public.box_reservations drop constraint %I', cn); end if;
  alter table public.box_reservations add constraint box_reservations_status_check
    check (status = any (array['pending','accepted','rejected','awaiting_payment','paid','completed','cancelled','expired','payment_expired']));
end $$;

-- transport_reservations.statut (FR ; completed présent depuis mig 049)
do $$ declare cn text; begin
  select conname into cn from pg_constraint
   where conrelid='public.transport_reservations'::regclass and contype='c'
     and pg_get_constraintdef(oid) ilike '%statut = ANY%';
  if cn is not null then execute format('alter table public.transport_reservations drop constraint %I', cn); end if;
  alter table public.transport_reservations add constraint transport_reservations_statut_check
    check (statut = any (array['pending','accepted','rejected','awaiting_payment','paid','cancelled','completed','expired','payment_expired']));
end $$;


-- ── 2. accepted_at : base du délai paiement 24h (les 4 tables) ───────────────
alter table public.course_demands       add column if not exists accepted_at timestamptz;
alter table public.stage_reservations   add column if not exists accepted_at timestamptz;
alter table public.box_reservations     add column if not exists accepted_at timestamptz;
alter table public.transport_reservations add column if not exists accepted_at timestamptz;


-- ── 3. Garde-fous compteurs Stage / Transport (CHECK >= 0) ──────────────────
--    Valeurs actuelles toutes >= 0 (audit préalable) → ajout sûr.
--    Box : pas de compteur (logique de chevauchement, cf. mig 053). Coach : idem (exclusion).
alter table public.stages             drop constraint if exists stages_places_dispo_nonneg;
alter table public.stages             add  constraint stages_places_dispo_nonneg check (places_disponibles >= 0);

alter table public.transport_annonces drop constraint if exists transport_places_dispo_nonneg;
alter table public.transport_annonces add  constraint transport_places_dispo_nonneg check (nb_places_disponibles >= 0);


-- ═════════════════════════════════════════════════════════════════════════════
-- DIFFÉRÉ (lot séparé après assainissement des données de test coach) :
-- Exclusion de chevauchement créneau coach. À activer tel quel dans une future
-- migration une fois qu'il ne reste qu'au plus 1 course_demands active par
-- créneau chevauchant et par coach (cf. rapport A1, 2026-06-03).
--
--   create extension if not exists btree_gist;
--
--   alter table public.course_demands add constraint coach_slot_no_overlap
--     exclude using gist (
--       coach_id with =,
--       daterange(date_debut, date_fin, '[]') with &&
--     ) where (status in ('accepted','paid','completed'));
-- ═════════════════════════════════════════════════════════════════════════════
