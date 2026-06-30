-- ============================================================================
-- ROLLBACK 089 — CONCOURS PRESENCE · PR2a
-- ============================================================================
-- Réversible à 100%. Retire la RPC + la table concours_presence (index + RLS
-- policies droppés en cascade avec la table). Ne touche pas 074 (concours) ni
-- 088 (fn_people_i_know). Aucune donnée annonce/réservation/paiement impactée.
-- ============================================================================

begin;

-- 4. RPC
drop function if exists public.fn_concours_known_attendees(uuid, uuid);

-- 1/2/3. table (drop cascade => index idx_concours_presence_user + policies
-- cp_select_auth / cp_insert_own / cp_update_own / cp_delete_own)
drop table if exists public.concours_presence cascade;

commit;
