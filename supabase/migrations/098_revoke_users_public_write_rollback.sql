-- Rollback 098 — Restauration des droits d'écriture sur users_public
-- ⚠ Ne restaurer que si régression avérée (aucune attendue — aucun code n'écrit via cette vue).

GRANT INSERT, UPDATE, DELETE ON public.users_public TO authenticated;
