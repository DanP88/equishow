-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 101 — Suppression de public.is_admin()
--
-- Contexte :
--   La fonction is_admin() (mig 002, SECURITY DEFINER) lit profiles.role_id →
--   roles.name pour déterminer si l'utilisateur courant est admin. Elle fait
--   partie du système legacy (profiles / roles / is_admin) désormais sans
--   consommateur actif.
--
-- Pourquoi c'est sûr :
--   1. Toutes les policies qui l'appelaient ont été migrées par des migrations
--      antérieures :
--        • 079 : concours_insert/update/delete_admin → users.role='admin'
--        • 095 : 8 policies → is_app_admin() ; profiles_select_admin +
--                roles_all_admin droppées
--   2. Aucune Edge Function, aucun code front ne l'appelle.
--   3. Audit prod 2026-07-29 : pg_depend (deptype≠'p') = 0, grep policies = 0,
--      grep functions = 0, grep views = 0.
--   4. is_admin() renvoyait false pour tout le monde (profiles.role_id NULL sur
--      les 6 rows existantes) — aucun comportement live à préserver.
--
-- Périmètre :
--   DROP FUNCTION public.is_admin() uniquement.
--   Pas de CASCADE. Les tables profiles et roles sont conservées (mig 102/103).
--   is_app_admin() (lit users.role) reste intacte — c'est le successeur canonique.
--
-- Rollback : 101_drop_is_admin_rollback.sql
--   Recrée is_admin() avec sa définition prod exacte (corps + SECURITY DEFINER +
--   search_path). Rollback ne rétablit aucune policy (toutes migrées amont).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Garde 1 : dépendances pg_depend ──────────────────────────────────────────
-- Échoue si un objet DB (policy, fonction, vue, trigger…) dépend encore de
-- is_admin(). Protège contre toute dépendance créée directement sur prod.
do $$
declare
  v_dep_count int;
begin
  select count(*) into v_dep_count
  from pg_depend d
  join pg_proc p on p.oid = d.refobjid
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'is_admin'
    and n.nspname = 'public'
    and d.deptype <> 'p';   -- 'p' = pinned (système), non comptabilisé

  if v_dep_count > 0 then
    raise exception
      'is_admin() a % objet(s) dépendant(s) live — DROP annulé. '
      'Vérifier pg_depend et corriger avant de relancer.',
      v_dep_count;
  end if;
end $$;

-- ── Garde 2 : texte des policies ─────────────────────────────────────────────
-- Vérifie que plus aucune policy active ne mentionne is_admin dans son expression.
-- (Redondant avec pg_depend mais défense en profondeur.)
do $$
declare
  v_policy_count int;
begin
  select count(*) into v_policy_count
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  where pg_get_expr(pol.polqual,      pol.polrelid) ilike '%is_admin%'
     or pg_get_expr(pol.polwithcheck, pol.polrelid) ilike '%is_admin%';

  if v_policy_count > 0 then
    raise exception
      'is_admin() référencée dans % policy/policies live — DROP annulé.',
      v_policy_count;
  end if;
end $$;

-- ── DROP (sans CASCADE) ───────────────────────────────────────────────────────
drop function public.is_admin();
