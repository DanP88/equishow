-- ============================================================================
-- ROLLBACK 114 — RECHERCHES OUVERTES (Box uniquement)
-- ============================================================================
-- Réversible à 100%. Retire la RPC, les triggers/fonctions de recalcul de
-- couverture, les 3 tables Box (index + RLS policies droppés en cascade avec
-- chaque table), et les 2 colonnes ajoutées par ALTER sur la vraie table V1
-- box_reservations (recherche_id, recherche_reponse_id — jamais écrites hors
-- du parcours recherche, DROP COLUMN sans impact sur le flux V1 direct). Ne
-- touche à AUCUNE autre colonne/table pré-existante (annonces/réservations/
-- payments/escrow/104/051/047 intacts). Transport/Coach non concernés.
--
-- Emplacement volontairement HORS de supabase/migrations/ (cf. 111/112/113) :
-- le CLI `supabase migration list` interprète tout fichier préfixé par un
-- numéro dans ce dossier comme une migration candidate, y compris un rollback.
--
-- Application manuelle si besoin :
--   supabase db query -f supabase/rollbacks/114_box_recherches_ouvertes_rollback.sql --linked
-- (jamais via `migration repair` — ce fichier n'est pas une migration).
-- ============================================================================

begin;

-- RPC
drop function if exists public.accept_box_recherche_response(uuid, uuid[]);

-- Triggers + fonctions de recalcul de couverture
drop trigger if exists trg_zz_sync_box_recherche_on_reservation on public.box_reservations;
drop function if exists public.fn_sync_box_recherche_on_reservation_change();

drop trigger if exists trg_zz_sync_box_recherche_chevaux on public.box_recherche_chevaux;
drop function if exists public.fn_sync_box_recherche_chevaux();

drop function if exists public.fn_recompute_box_recherche_status(uuid);

-- Réponses
drop table if exists public.box_recherche_reponses cascade;

-- Jonction recherche × chevaux — AVANT l'ALTER TABLE plus bas : la policy
-- box_recherche_chevaux_delete_own lit box_reservations.recherche_id dans
-- une sous-requête (dépendance de policy sur colonne ALTER).
drop table if exists public.box_recherche_chevaux cascade;

-- Recherches — également AVANT l'ALTER TABLE : box_recherches_delete_own lit
-- elle aussi box_reservations.recherche_id dans sa USING.
drop table if exists public.box_recherches cascade;

-- Colonnes ajoutées par ALTER sur la vraie table V1 box_reservations. Sûr
-- maintenant : plus aucune policy/vue ne dépend de ces colonnes.
alter table public.box_reservations drop column if exists recherche_reponse_id;
alter table public.box_reservations drop column if exists recherche_id;

commit;
