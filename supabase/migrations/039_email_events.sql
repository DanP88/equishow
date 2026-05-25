-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 039 — Emails transactionnels : table `email_events`
--
-- Journalise et déduplique chaque email transactionnel envoyé (réservation
-- confirmée, paiement confirmé/échoué/remboursé). La contrainte UNIQUE sur
-- `event_key` est le filet anti-doublon : un INSERT en conflit => on n'envoie
-- pas une 2e fois (cf. _shared/email.ts).
--
-- Écrite/lue UNIQUEMENT en service_role (webhook-stripe + Edge Function
-- send-reservation-email). Aucune policy `authenticated` : le front n'y touche
-- jamais, et aucun email d'autrui ne fuite côté client.
--
-- N'altère AUCUNE table de paiement/montant/commission existante.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.email_events (
  id                  uuid primary key default gen_random_uuid(),
  -- Clé d'idempotence déterministe (1 par email logique). Ex :
  --   reservation_confirmed:{module}:{entityId}:{role}
  --   payment_succeeded:{stripe_event_id}:{role}
  event_key           text not null unique,
  event_type          text not null check (event_type in (
    'reservation_confirmed','payment_succeeded','payment_failed','payment_refunded'
  )),
  module              text not null check (module in ('course','stage','transport','box')),
  recipient_id        uuid references public.users(id) on delete set null,
  recipient_role      text not null check (recipient_role in ('buyer','seller')),
  recipient_email     text not null,
  related_payment_id  uuid references public.payments(id) on delete set null,
  -- text : l'id de transport_reservations est text (pas uuid).
  related_entity_id   text,
  provider            text not null default 'resend',
  provider_message_id text,
  status              text not null default 'pending'
                        check (status in ('pending','sent','failed','skipped')),
  error_message       text,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);

-- Retrouver rapidement les envois à rejouer (sweeper manuel éventuel).
create index if not exists idx_email_events_failed
  on public.email_events(created_at desc)
  where status = 'failed';

create index if not exists idx_email_events_payment
  on public.email_events(related_payment_id);

alter table public.email_events enable row level security;

-- Aucune policy pour `authenticated` : seul service_role (Edge Functions) accède.
-- (La policy admin globale `users_admin_all` ne couvre que public.users ; si un
--  futur dashboard admin doit lire email_events, ajouter une policy is_app_admin()
--  dédiée — hors périmètre v1.)
