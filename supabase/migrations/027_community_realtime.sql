-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 027 — Add community posts tables to realtime publication
--
-- Contexte : mig 025 a créé les 6 tables posts_* / com_posts_* mais ne les a
-- pas ajoutées à supabase_realtime → les channels postgres_changes s'abonnent
-- mais ne reçoivent jamais d'event INSERT/UPDATE/DELETE.
--
-- Symptôme observé : addComment() insère en DB mais le commentaire n'apparaît
-- pas dans la liste car reload() n'est jamais déclenché.
-- ─────────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.posts_community;
alter publication supabase_realtime add table public.com_posts_community;
alter publication supabase_realtime add table public.posts_coach;
alter publication supabase_realtime add table public.com_posts_coach;
alter publication supabase_realtime add table public.posts_organisateur;
alter publication supabase_realtime add table public.com_posts_organisateur;
