-- Harness 099 — Vérification REVOKE écriture coach_stats
-- Exécuter après application de la migration :
--   supabase db query --linked -f supabase/tests/099_revoke_coach_stats_write/harness.sql
--
-- Tous les tests doivent afficher PASS.

\echo '=== H1 : authenticated ne doit plus avoir INSERT sur coach_stats ==='
SELECT CASE
  WHEN count(*) = 0 THEN 'PASS — INSERT révoqué pour authenticated'
  ELSE 'FAIL — INSERT toujours présent pour authenticated'
END AS result
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='coach_stats'
  AND grantee='authenticated' AND privilege_type='INSERT';

\echo '=== H2 : authenticated ne doit plus avoir UPDATE sur coach_stats ==='
SELECT CASE
  WHEN count(*) = 0 THEN 'PASS — UPDATE révoqué pour authenticated'
  ELSE 'FAIL — UPDATE toujours présent pour authenticated'
END AS result
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='coach_stats'
  AND grantee='authenticated' AND privilege_type='UPDATE';

\echo '=== H3 : authenticated ne doit plus avoir DELETE sur coach_stats ==='
SELECT CASE
  WHEN count(*) = 0 THEN 'PASS — DELETE révoqué pour authenticated'
  ELSE 'FAIL — DELETE toujours présent pour authenticated'
END AS result
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='coach_stats'
  AND grantee='authenticated' AND privilege_type='DELETE';

\echo '=== H4 : authenticated doit toujours avoir SELECT sur coach_stats ==='
SELECT CASE
  WHEN count(*) = 1 THEN 'PASS — SELECT conservé pour authenticated'
  ELSE 'FAIL — SELECT absent pour authenticated'
END AS result
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='coach_stats'
  AND grantee='authenticated' AND privilege_type='SELECT';

\echo '=== H5 : anon doit toujours avoir SELECT sur coach_stats ==='
SELECT CASE
  WHEN count(*) = 1 THEN 'PASS — SELECT conservé pour anon'
  ELSE 'FAIL — SELECT absent pour anon'
END AS result
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='coach_stats'
  AND grantee='anon' AND privilege_type='SELECT';

\echo '=== H6 : grants restants sur coach_stats (attendu : anon SELECT + authenticated SELECT) ==='
SELECT grantee,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='coach_stats'
  AND grantee IN ('anon','authenticated')
GROUP BY grantee ORDER BY grantee;
