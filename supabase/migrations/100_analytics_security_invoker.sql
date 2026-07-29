-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 100 — security_invoker=true sur les 6 vues v_analytics_*
--
-- Contexte :
--   Les vues v_analytics_* lisent la table user_events, protégée par la policy
--   user_events_select_admin (authenticated + is_app_admin() uniquement).
--
--   Ces vues étaient en mode SECURITY DEFINER (security_invoker non défini,
--   défaut false) : elles s'exécutent comme postgres (superuser), bypassant
--   la policy admin-only sur user_events. Le rôle anon (clé publique embarquée
--   dans le bundle Expo) avait SELECT sur ces vues, exposant :
--
--   - v_analytics_recent_errors : 50 dernières erreurs individuelles avec user_id
--     et metadata (stack traces, noms d'écrans, contexte d'erreur)
--   - v_analytics_kpi_7d : KPIs globaux agrégés (pageviews, DAU, sessions)
--   - v_analytics_top_screens : classement écrans + durées
--   - v_analytics_top_ctas : classement CTAs par screen/action
--   - v_analytics_funnel_payment : taux conversion funnel paiement
--   - v_analytics_active_sessions : compteur sessions actives
--
--   Le dashboard admin (admin-analytics.tsx) ne disposait que d'une protection
--   client-side (<AuthGuard requiredRole="admin">) — contournable par appel direct
--   à l'API REST avec la clé anon publique.
--
--   Note : les vues v_mkt_* (même dashboard, mig 070) sont déjà correctement
--   configurées avec security_invoker=true. Cette migration aligne les vues
--   analytics sur le même pattern.
--
-- Correction :
--   ALTER VIEW ... SET (security_invoker=true) sur les 6 vues.
--   Avec security_invoker=true :
--   - Admin authentifié → policy user_events_select_admin passe → accès ✅
--   - Non-admin authentifié → policy bloque → 0 rows ✅
--   - Rôle anon → aucune policy SELECT sur user_events → 0 rows / accès refusé ✅
--
--   Les grants existants sur les vues ne changent pas (mais deviennent inoffensifs
--   pour anon et non-admin car la RLS de user_events s'applique désormais).
--   La définition SQL des vues est inchangée.
--
-- Impact :
--   - Fonctionnel : aucun pour le dashboard admin (role='admin' → accès maintenu)
--   - Sécurité : ferme l'exposition analytics à anon/non-admin
--   - Escrow / Stripe / payments : aucun
--   - RLS / policies / triggers : aucun
--
-- Rollback : 100_analytics_security_invoker_rollback.sql
-- ─────────────────────────────────────────────────────────────────────────────

ALTER VIEW public.v_analytics_active_sessions  SET (security_invoker = true);
ALTER VIEW public.v_analytics_funnel_payment   SET (security_invoker = true);
ALTER VIEW public.v_analytics_kpi_7d           SET (security_invoker = true);
ALTER VIEW public.v_analytics_recent_errors    SET (security_invoker = true);
ALTER VIEW public.v_analytics_top_ctas         SET (security_invoker = true);
ALTER VIEW public.v_analytics_top_screens      SET (security_invoker = true);
