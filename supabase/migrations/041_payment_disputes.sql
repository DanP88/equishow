-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 041 — Litiges paiement (V2 séquestre, PHASE 6) : table d'audit
--
-- Trace tout litige affectant un paiement : interne (cavalier/admin) ou
-- chargeback Stripe. Le BLOCAGE effectif de la libération se fait via les
-- colonnes déjà présentes sur payments (dispute_status / release_blocked_reason,
-- mig 040) — cette table sert d'historique/traçabilité.
--
-- 100% ADDITIVE. Aucune table existante modifiée, aucun paiement impacté.
-- Accès service_role uniquement (Edge Functions) — aucune policy authenticated.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.payment_disputes (
  id                uuid primary key default gen_random_uuid(),
  payment_id        uuid not null references public.payments(id) on delete cascade,
  source            text not null check (source in ('buyer','admin','stripe')),
  status            text not null default 'open'
                      check (status in ('open','resolved_release','resolved_refund')),
  reason            text,
  stripe_dispute_id text,                 -- id du dispute Stripe (chargeback)
  opened_by         uuid references public.users(id) on delete set null,
  resolved_by       uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

create index if not exists idx_payment_disputes_payment on public.payment_disputes(payment_id);
create index if not exists idx_payment_disputes_open
  on public.payment_disputes(payment_id) where status = 'open';

alter table public.payment_disputes enable row level security;
-- Pas de policy : seul service_role (webhook-stripe, manage-dispute) y accède.
