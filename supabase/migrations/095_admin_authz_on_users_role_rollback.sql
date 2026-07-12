-- ============================================================================
-- ROLLBACK 095 — restaure EXACTEMENT l'état antérieur : les 10 policies
-- repointent sur is_admin() (legacy), et les 2 policies droppées sont recréées
-- à l'identique (mig 001). is_admin()/profiles/roles n'ont jamais été touchés.
-- ⚠️ Réintroduit le comportement legacy (accès admin dépendant de is_admin(),
-- donc actuellement inopérant car role_id NULL). Diagnostic / réversibilité.
-- ============================================================================
begin;

-- (A) Repointe les 8 policies conservées vers is_admin() (état d'origine).
alter policy audit_logs_select_admin      on public.audit_logs      using (public.is_admin());
alter policy security_events_select_admin on public.security_events using (public.is_admin());
alter policy consents_select_admin        on public.user_consents   using (public.is_admin());
alter policy activity_logs_select_admin   on public.activity_logs   using (public.is_admin());
alter policy analytics_select_admin       on public.analytics_events using (public.is_admin());

alter policy cc_insert_admin on public.concours_categories with check (public.is_admin());
alter policy cc_update_admin on public.concours_categories using (public.is_admin()) with check (public.is_admin());
alter policy cc_delete_admin on public.concours_categories using (public.is_admin());

-- (B) Recrée les 2 policies droppées, à l'identique de la mig 001.
create policy profiles_select_admin on public.profiles for select using (public.is_admin());
create policy roles_all_admin       on public.roles    for all    using (public.is_admin());

commit;
