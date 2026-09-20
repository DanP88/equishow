-- ============================================================================
-- ROLLBACK 115 — DURCISSEMENT PERMISSIONS RPC « recherches ouvertes »
-- ============================================================================
-- Restaure l'état AVANT 115 : ré-accorde EXECUTE à PUBLIC (et donc, par
-- transitivité, à anon) sur les 2 RPC. Ne touche à AUCUNE définition de
-- fonction, RLS, policy ou trigger. Purement réversible.
--
-- Application manuelle si besoin :
--   supabase db query -f supabase/rollbacks/115_harden_recherche_rpc_permissions_rollback.sql --linked
-- (jamais via `migration repair` — ce fichier n'est pas une migration).
-- ============================================================================

begin;

grant execute on function public.accept_transport_recherche_response(uuid, uuid[]) to public;
grant execute on function public.accept_box_recherche_response(uuid, uuid[]) to public;

commit;
