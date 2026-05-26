-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 040 — Paiements V2 (séquestre / escrow) : socle DB ADDITIF
--
-- Objectif : permettre le modèle "Separate Charges & Transfers" (fonds retenus
-- sur la plateforme puis libérés au vendeur après prestation), SANS rien casser.
--
-- GARANTIES :
--   • 100% additif : uniquement ADD COLUMN (défauts neutres) + 1 index + seed config.
--     Aucune colonne supprimée, aucun montant/commission touché.
--   • Compat ascendante : `transfer_state` défaut 'not_applicable' → les paiements
--     existants et le code actuel (destination charge) ne sont pas affectés.
--   • Rollbackable : le comportement V2 n'est activé que par le flag
--     platform_settings.escrow_enabled (défaut false). Tant que false → flux actuel
--     inchangé. Aucune migration inverse nécessaire (colonnes inertes).
--   • Enums des réservations NON modifiés ici (la libération s'appuie sur
--     payments.release_due_at + buyer_confirmed_at, pas sur un statut 'completed').
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Colonnes séquestre sur public.payments (toutes additives) ────────────
alter table public.payments
  -- Cycle de vie des fonds retenus. 'not_applicable' = paiement hors séquestre
  -- (anciens paiements / flag off). 'releasing' = verrou transitoire anti-double
  -- transfert pendant l'appel /transfers.
  add column if not exists transfer_state text not null default 'not_applicable'
    check (transfer_state in (
      'not_applicable','held','releasing','released','reversed','failed'
    )),
  -- Snapshot de la date de fin de prestation (informatif / admin).
  add column if not exists prestation_end_at    timestamptz,
  -- Date à partir de laquelle la libération auto devient éligible.
  add column if not exists release_due_at        timestamptz,
  -- Confirmation anticipée par le cavalier (accélère la libération).
  add column if not exists buyer_confirmed_at    timestamptz,
  -- Horodatages de libération / reversal.
  add column if not exists released_at           timestamptz,
  add column if not exists transfer_reversed_at  timestamptz,
  -- Observabilité / retries de la libération.
  add column if not exists release_attempts      integer not null default 0,
  add column if not exists last_release_error    text,
  -- Qui a déclenché la libération.
  add column if not exists release_trigger       text
    check (release_trigger in ('manual_buyer','auto_cron','admin')),
  -- Raison d'un blocage de libération (litige, hold admin…). NULL = non bloqué.
  add column if not exists release_blocked_reason text,
  -- Statut de litige interne (NULL = aucun litige).
  add column if not exists dispute_status        text
    check (dispute_status in ('open','resolved_release','resolved_refund'));

-- ── 2. Index pour le cron de libération (held + échus uniquement) ───────────
create index if not exists idx_payments_escrow_release_due
  on public.payments (release_due_at)
  where transfer_state = 'held';

-- ── 3. Feature flag + paramètres (modifiables par admin, sans redeploy) ─────
-- value est JSONB : booléens / nombres / tableau de modules.
insert into public.platform_settings (key, value, description) values
  ('escrow_enabled',             'false', 'V2 séquestre : flag global (false = destination charge actuel)'),
  ('escrow_enabled_modules',     '[]',    'Modules activés en séquestre : course,stage,transport,box'),
  ('escrow_hold_hours_course',   '48',    'Délai libération auto après la séance (cours), en heures'),
  ('escrow_hold_hours_stage',    '48',    'Délai libération auto après le stage, en heures'),
  ('escrow_hold_hours_transport','48',    'Délai libération auto après le trajet, en heures'),
  ('escrow_hold_hours_box',      '48',    'Délai libération auto après la fin de location, en heures'),
  ('escrow_hard_cap_days',       '14',    'Cap dur : libération forcée au-delà de N jours en held')
on conflict (key) do nothing;
