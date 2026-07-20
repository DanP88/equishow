-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback 096 — Supprime la protection serveur de la limite d'essai coach
-- ─────────────────────────────────────────────────────────────────────────────

drop trigger if exists trg_guard_coach_trial_accept on public.course_demands;
drop function if exists public.fn_guard_coach_trial_accept();
drop function if exists public.fn_coach_trial_consumed(uuid, uuid);
