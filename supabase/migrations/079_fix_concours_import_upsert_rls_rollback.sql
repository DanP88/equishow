-- ============================================================================
-- ROLLBACK 079 — restaure l'index unique partiel + les policies is_admin().
-- ⚠️ Réintroduit les 2 blocages d'import (ON CONFLICT 42P10 + RLS is_admin()=false).
-- Aucune donnée touchée.
-- ============================================================================

begin;

alter table public.concours drop constraint if exists concours_numero_ffe_key;
create unique index if not exists ux_concours_numero_ffe
  on public.concours (numero_ffe) where (numero_ffe is not null);

drop policy if exists concours_insert_admin on public.concours;
create policy concours_insert_admin on public.concours
  for insert with check (is_admin());

drop policy if exists concours_update_admin on public.concours;
create policy concours_update_admin on public.concours
  for update using (is_admin()) with check (is_admin());

drop policy if exists concours_delete_admin on public.concours;
create policy concours_delete_admin on public.concours
  for delete using (is_admin());

commit;
