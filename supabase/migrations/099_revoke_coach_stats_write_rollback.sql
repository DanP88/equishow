-- Rollback 099 — Restauration des droits d'écriture sur coach_stats
-- ⚠ Ne restaurer que si régression avérée (aucune attendue — aucun code n'écrit via cette vue).

GRANT INSERT, UPDATE, DELETE ON public.coach_stats TO authenticated;
