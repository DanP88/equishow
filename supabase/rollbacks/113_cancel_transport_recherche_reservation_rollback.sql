-- ============================================================================
-- ROLLBACK 113 — Annulation réservation Transport issue d'une recherche (Lot 7)
-- ============================================================================
-- Réversible à 100%. Retire la RPC et les 3 colonnes de traçabilité ajoutées
-- par 113. Ne touche à AUCUNE donnée, AUCUN trigger, AUCUNE autre table.
-- trg_guard_statut_transition/fn_can_bypass_reservation_guard n'ont jamais
-- été modifiés par 113 — rien à en restaurer ici.
--
-- Emplacement volontairement HORS de supabase/migrations/ (même convention
-- que 111/112 : le CLI `supabase migration list` interprète tout fichier
-- préfixé par un numéro dans ce dossier comme une migration candidate).
--
-- Application manuelle si besoin :
--   supabase db query -f supabase/rollbacks/113_cancel_transport_recherche_reservation_rollback.sql --linked
-- (jamais via `migration repair` — ce fichier n'est pas une migration).
-- ============================================================================

begin;

drop function if exists public.cancel_transport_recherche_reservation(uuid, text);

alter table public.transport_reservations drop column if exists cancellation_reason;
alter table public.transport_reservations drop column if exists cancelled_at;
alter table public.transport_reservations drop column if exists cancelled_by;

commit;
