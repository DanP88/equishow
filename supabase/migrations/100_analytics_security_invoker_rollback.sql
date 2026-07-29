-- Rollback 100 — Restauration du mode SECURITY DEFINER sur les vues analytics
-- ⚠ Rétablit l'exposition des données analytics à anon — n'utiliser qu'en urgence.

ALTER VIEW public.v_analytics_active_sessions  SET (security_invoker = false);
ALTER VIEW public.v_analytics_funnel_payment   SET (security_invoker = false);
ALTER VIEW public.v_analytics_kpi_7d           SET (security_invoker = false);
ALTER VIEW public.v_analytics_recent_errors    SET (security_invoker = false);
ALTER VIEW public.v_analytics_top_ctas         SET (security_invoker = false);
ALTER VIEW public.v_analytics_top_screens      SET (security_invoker = false);
