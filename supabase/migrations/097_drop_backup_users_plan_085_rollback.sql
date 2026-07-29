-- Rollback 097 — Recrée la structure de _backup_users_plan_085 (vide).
--
-- ⚠️ Les 2 rows supprimées par la migration 097 sont définitivement perdues.
--    Ce rollback recrée uniquement la structure ; le rollback 085 reste
--    techniquement impossible (11 migrations appliquées par-dessus).

create table if not exists public._backup_users_plan_085 (
  user_id      uuid primary key references public.users(id) on delete cascade,
  old_plan     text,
  old_plan_id  text,
  backed_up_at timestamptz not null default now()
);
