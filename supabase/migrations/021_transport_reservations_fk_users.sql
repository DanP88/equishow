-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 021 — Aligner les FKs de transport_reservations sur public.users.
--
-- Symptôme : `insert or update on table "transport_reservations" violates
-- foreign key constraint "transport_reservations_seller_id_fkey"` quand un
-- user (existant dans public.users) tente de réserver un trajet.
--
-- Cause : les FK `buyer_id_fkey` / `seller_id_fkey` pointaient vers la table
-- legacy `public.profiles` (créée mig 001), alors que `public.users` est la
-- source de vérité depuis mig 005. Les users créés via Admin API peuplent
-- `public.users` mais pas `public.profiles` → FK fail.
--
-- Mig 016 a déjà fait ce travail pour `transport_annonces.auteur_id`. Ici on
-- complète pour les réservations.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Drop FKs legacy ─────────────────────────────────────────────────────
alter table public.transport_reservations
  drop constraint if exists transport_reservations_buyer_id_fkey;

alter table public.transport_reservations
  drop constraint if exists transport_reservations_seller_id_fkey;

-- ── 2. Nettoyer les lignes orphelines (réservations dont buyer/seller n'est
--    pas dans public.users) — non destructif sur les autres données.
delete from public.transport_reservations
  where buyer_id is not null and buyer_id not in (select id from public.users);

delete from public.transport_reservations
  where seller_id is not null and seller_id not in (select id from public.users);

-- ── 3. Recréer les FKs vers public.users ───────────────────────────────────
alter table public.transport_reservations
  add constraint transport_reservations_buyer_id_fkey
  foreign key (buyer_id) references public.users(id) on delete cascade;

alter table public.transport_reservations
  add constraint transport_reservations_seller_id_fkey
  foreign key (seller_id) references public.users(id) on delete cascade;
