-- Rollback migration 086 — essai gratuit Coach (RPC)
-- Supprime les 2 fonctions créées. Aucune donnée impactée (lecture seule).

drop function if exists public.fn_my_coach_access();
drop function if exists public.fn_coach_paid_sessions(uuid);
