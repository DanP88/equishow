-- ============================================================================
-- ROLLBACK 088 — USER FOLLOWS · GRAPHE SOCIAL
-- ============================================================================
-- Réversible à 100%. Retire la RPC + la table user_follows (index + RLS
-- policies droppés en cascade avec la table). Aucune table existante n'a été
-- altérée par 088 → rien à restaurer ailleurs. Aucune donnée
-- annonce/réservation/paiement impactée.
-- ============================================================================

begin;

-- 4. RPC graphe social
drop function if exists public.fn_people_i_know(uuid);

-- 1/2/3. table (drop cascade => index idx_user_follows_followee + policies
-- uf_select_auth / uf_insert_own / uf_delete_own supprimés avec la table)
drop table if exists public.user_follows cascade;

commit;
