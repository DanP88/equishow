-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 028 — Add notifications table to realtime publication
--
-- Même bug que mig 027 pour posts/commentaires : la table `notifications`
-- (mig 015) n'a jamais été ajoutée à supabase_realtime → les channels
-- postgres_changes s'abonnent mais ne reçoivent jamais d'event.
--
-- Symptôme observé : suppression d'une notif réussit en DB (DELETE OK, RLS
-- passe) mais la carte reste affichée jusqu'au refresh manuel car le
-- useNotifications.load() n'est jamais re-déclenché.
-- ─────────────────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.notifications;
