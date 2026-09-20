-- ============================================================================
-- ROLLBACK 116 — PUBLICATION ATOMIQUE RECHERCHE BOX (create_box_recherche)
-- ============================================================================
-- Retire uniquement la fonction créée par 116. Ne touche à AUCUNE table,
-- policy, trigger de 114/115 (fichiers non modifiés par 116, rien à restaurer
-- ici pour eux). Réversible à 100%.
--
-- Application manuelle si besoin :
--   supabase db query -f supabase/rollbacks/116_create_box_recherche_atomic_rollback.sql --linked
-- (jamais via `migration repair` — ce fichier n'est pas une migration).
-- ============================================================================

begin;

drop function if exists public.create_box_recherche(uuid, text, date, date, boolean, uuid[]);

commit;
