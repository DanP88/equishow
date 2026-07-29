-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback 102 — Aucune action requise
--
-- La migration 102 est une migration d'assertion pure : elle ne modifie aucune
-- contrainte, donnée, policy ni grant. Il n'y a rien à annuler.
--
-- Si un état incorrect est détecté APRÈS application de mig 102, c'est que les
-- gardes de mig 103 empêcheront de procéder. Aucun rollback de mig 102 n'est
-- nécessaire ou possible.
-- ─────────────────────────────────────────────────────────────────────────────

-- no-op intentionnel
select 'rollback 102 : rien à annuler (migration d''assertion pure)' as status;
