-- ============================================================================
-- ROLLBACK 111 — RECHERCHES OUVERTES (design multi-chevaux Transport)
-- ============================================================================
-- Réversible à 100%. Retire la RPC, les triggers/fonctions de recalcul de
-- couverture, les 10 tables (index + RLS policies droppés en cascade avec
-- chaque table), et les 2 colonnes ajoutées par ALTER sur la vraie table V1
-- transport_reservations (recherche_id, recherche_reponse_id — jamais
-- écrites hors du parcours recherche, DROP COLUMN sans impact sur le flux V1
-- direct). Ne touche à AUCUNE autre colonne/table pré-existante (annonces/
-- réservations/payments/escrow intacts).
--
-- Emplacement volontairement HORS de supabase/migrations/ (cf. 111) : le CLI
-- `supabase migration list` interprète tout fichier préfixé par un numéro
-- dans ce dossier comme une migration candidate, y compris un rollback.
--
-- Application manuelle si besoin :
--   supabase db query -f supabase/rollbacks/111_recherches_ouvertes_rollback.sql --linked
-- (jamais via `migration repair` — ce fichier n'est pas une migration).
-- ============================================================================

begin;

-- RPC (signature actuelle + ancienne signature pilote, défensif)
drop function if exists public.accept_transport_recherche_response(uuid, uuid[]);
drop function if exists public.accept_transport_recherche_response(uuid);

-- Triggers + fonctions de recalcul de couverture (design multi-chevaux)
drop trigger if exists trg_zz_sync_transport_recherche_on_reservation on public.transport_reservations;
drop function if exists public.fn_sync_transport_recherche_on_reservation_change();

drop trigger if exists trg_zz_sync_transport_recherche_chevaux on public.transport_recherche_chevaux;
drop function if exists public.fn_sync_transport_recherche_chevaux();

drop function if exists public.fn_recompute_transport_recherche_status(uuid);

-- Trigger/fonction de l'itération précédente (fix audit R2, jamais en prod —
-- défensif au cas où ce fichier aurait déjà tourné une fois localement).
drop trigger if exists trg_zz_reopen_transport_recherche on public.transport_reservations;
drop function if exists public.fn_reopen_transport_recherche_on_cancel();

-- Table réservation × chevaux (design multi-cheval)
drop table if exists public.transport_reservation_chevaux cascade;

-- Réponses
drop table if exists public.transport_recherche_reponses cascade;
drop table if exists public.box_recherche_reponses cascade;
drop table if exists public.coach_recherche_reponses cascade;

-- Jonctions recherche × chevaux — AVANT l'ALTER TABLE plus bas : la policy
-- trc_delete_own lit transport_reservations.recherche_id dans une sous-requête,
-- Postgres trace ça comme une dépendance de la policy sur la colonne.
drop table if exists public.transport_recherche_chevaux cascade;
drop table if exists public.box_recherche_chevaux cascade;
drop table if exists public.coach_recherche_chevaux cascade;

-- Recherches — également AVANT l'ALTER TABLE : tr_delete_own (fix traçabilité)
-- lit elle aussi transport_reservations.recherche_id dans sa USING. Toutes les
-- tables 111 doivent avoir disparu (et avec elles, toutes les policies qui
-- référencent les colonnes ALTER de transport_reservations) avant de pouvoir
-- DROP COLUMN sans CASCADE explicite.
drop table if exists public.transport_recherches cascade;
drop table if exists public.box_recherches cascade;
drop table if exists public.coach_recherches cascade;

-- Colonnes ajoutées par ALTER sur la vraie table V1 transport_reservations.
-- Sûr maintenant : plus aucune policy/vue ne dépend de ces colonnes (toutes
-- les tables 111 qui les référençaient ont été supprimées ci-dessus).
alter table public.transport_reservations drop column if exists recherche_reponse_id;
alter table public.transport_reservations drop column if exists recherche_id;

commit;
