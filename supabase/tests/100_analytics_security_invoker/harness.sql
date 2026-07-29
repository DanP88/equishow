-- Harness 100 — Vérification security_invoker=true sur les 6 vues analytics
-- Exécuter après application de la migration :
--   supabase db query --linked -f supabase/tests/100_analytics_security_invoker/harness.sql
--
-- Tous les tests doivent afficher PASS.

\echo '=== H1-H6 : toutes les vues analytics doivent avoir security_invoker=true ==='
SELECT
  v.relname AS view_name,
  CASE
    WHEN (SELECT opt FROM unnest(v.reloptions) opt WHERE opt = 'security_invoker=true') IS NOT NULL
    THEN 'PASS — security_invoker=true'
    ELSE 'FAIL — security_invoker non défini ou false'
  END AS result
FROM pg_class v
JOIN pg_namespace n ON n.oid = v.relnamespace
WHERE n.nspname = 'public'
  AND v.relkind = 'v'
  AND v.relname IN (
    'v_analytics_active_sessions',
    'v_analytics_funnel_payment',
    'v_analytics_kpi_7d',
    'v_analytics_recent_errors',
    'v_analytics_top_ctas',
    'v_analytics_top_screens'
  )
ORDER BY v.relname;

\echo '=== H7 : les vues v_mkt_* ne doivent pas être affectées ==='
SELECT
  v.relname AS view_name,
  CASE
    WHEN (SELECT opt FROM unnest(v.reloptions) opt WHERE opt = 'security_invoker=true') IS NOT NULL
    THEN 'PASS — security_invoker=true (inchangé)'
    ELSE 'WARN — vérifier (était déjà true avant mig 100)'
  END AS result
FROM pg_class v
JOIN pg_namespace n ON n.oid = v.relnamespace
WHERE n.nspname = 'public'
  AND v.relkind = 'v'
  AND v.relname LIKE 'v_mkt_%'
ORDER BY v.relname;

\echo '=== H8 : aucune vue public sans security_invoker=true NE doit lire user_events ==='
-- Détecte toute vue SECURITY DEFINER qui lirait user_events (régression ou oubli)
SELECT
  v.relname AS view_name,
  'WARN — vue SECURITY DEFINER accédant à user_events' AS result
FROM pg_class v
JOIN pg_namespace n ON n.oid = v.relnamespace
JOIN pg_depend d ON d.objid = v.oid AND d.deptype = 'n'
JOIN pg_class t ON t.oid = d.refobjid AND t.relname = 'user_events'
WHERE n.nspname = 'public'
  AND v.relkind = 'v'
  AND NOT EXISTS (
    SELECT 1 FROM unnest(v.reloptions) opt WHERE opt = 'security_invoker=true'
  );
-- Résultat attendu : 0 rows
