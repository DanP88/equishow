-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback 101 — Restauration de public.is_admin()
--
-- Usage : uniquement si la mig 101 doit être annulée.
-- Corps et attributs reproduits à l'identique depuis prod (2026-07-29).
-- Note : les policies qui appelaient is_admin() ont toutes été migrées par 079
-- et 095 — elles ne sont PAS restaurées ici (rollback 101 seul = inutile sans
-- rollback simultané de 079 et 095, ce qui est irréaliste).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and r.name = 'admin'
      and p.is_active = true
  );
$$;
