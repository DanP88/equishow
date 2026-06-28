-- Rollback migration 086 — anti-abus essai Coach
-- Supprime fonctions + table de suivi. (TRUNCATE non requis : DROP CASCADE de la
-- table de suivi uniquement ; aucune donnée métier escrow/réservation impactée.)

drop function if exists public.fn_admin_coach_duplicates();
drop function if exists public.fn_my_coach_trial_status();
drop function if exists public.fn_coach_trial_status(uuid);
drop table if exists public.coach_trial_identity;
