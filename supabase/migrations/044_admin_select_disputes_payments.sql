-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 044 — RLS admin SELECT sur payment_disputes + payments (P1.3)
--
-- Permet à l'UI admin (écran /admin-disputes) de lister les litiges ouverts et
-- de joindre les paiements associés via supabase-js (sans Edge Function dédiée).
-- Validé E2E le 2026-05-29 (dispute 65bb64b9 résolue, transfer tr_3TcMDd…).
--
-- 100 % ADDITIVE. Cohabite avec payments_select_parties existante (mig P8) —
-- les policies SELECT sont combinées en OR : un user lambda reste limité à ses
-- propres paiements, seul un compte role='admin' (is_app_admin()) voit tout.
--
-- Aucun INSERT/UPDATE/DELETE policy : les écritures restent réservées au
-- service_role (Edge Functions release-payment, process-refund, manage-dispute).
-- ─────────────────────────────────────────────────────────────────────────────

-- Idempotence (les policies ont pu être appliquées manuellement avant la mig).
drop policy if exists "payment_disputes_select_admin" on public.payment_disputes;
drop policy if exists "payments_select_admin" on public.payments;

create policy "payment_disputes_select_admin"
  on public.payment_disputes
  for select
  to authenticated
  using (is_app_admin());

create policy "payments_select_admin"
  on public.payments
  for select
  to authenticated
  using (is_app_admin());
