-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 019 — GRANTs manquants sur public.users + tables critiques
--
-- Symptôme constaté : PostgREST avec service_role retourne 403
-- "permission denied for table users" au SELECT/INSERT sur public.users.
-- Cause probable : la table créée en mig 005 a été créée AVANT que les default
-- privileges Supabase ne soient configurés sur ce projet, donc l'autogrant
-- aux rôles `anon`/`authenticated`/`service_role` ne s'est jamais fait.
--
-- Cette migration : GRANTs explicites + ALTER DEFAULT PRIVILEGES pour les
-- futures tables.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tables existantes
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Séquences (pour les colonnes serial / identity)
grant usage on all sequences in schema public to anon, authenticated, service_role;

-- Fonctions
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Default privileges pour les FUTURES tables créées par le rôle postgres
alter default privileges in schema public
  grant select on tables to anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant usage on sequences to anon, authenticated, service_role;

alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
