-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 029 — REPLICA IDENTITY FULL sur notifications
--
-- Contexte : avec REPLICA IDENTITY DEFAULT (= PRIMARY KEY), Postgres ne
-- réplique que la colonne `id` dans le payload `old` des events DELETE.
-- Du coup le filter Supabase realtime `destinataire_id=eq.{user_id}` côté
-- channel postgres_changes ne match jamais les DELETE — l'event n'est jamais
-- transmis au client.
--
-- Symptôme observé : suppression d'une notif réussit en DB mais la carte
-- reste affichée jusqu'au refresh manuel (cf. mig 028 publication + commit
-- de l'optimistic update front).
--
-- Coût : double le volume de WAL pour cette table (acceptable, throughput
-- notifications modéré). Pas d'impact RLS.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.notifications replica identity full;
