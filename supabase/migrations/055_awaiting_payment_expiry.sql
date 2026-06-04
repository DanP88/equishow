-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 055 — C-AWAITING-EXPIRY : expirer les réservations box/transport
-- bloquées en `awaiting_payment` (abandon Stripe, webhook jamais reçu).
--
-- Problème (audit 2026-06-04) :
--   `useBoxes` / `useTransports` passent la réservation en `awaiting_payment`
--   AVANT la redirection Stripe (clic « Payer »). Si l'acheteur abandonne le
--   checkout, le webhook ne revient jamais → la réservation reste
--   `awaiting_payment` à vie. Elle est invisible côté acheteur (les écrans
--   pending-*-payments ne listent que `accepted`) donc impossible à relancer,
--   et reste affichée comme active côté vendeur.
--
--   course_demands / stage_reservations ne sont PAS concernés : `awaiting_payment`
--   n'est pas dans leur CHECK → l'écriture y échoue et la demande reste
--   `accepted` (cas couvert par ailleurs). Cette migration ne traite donc que
--   box + transport.
--
-- Choix de conception :
--   - INDÉPENDANTE de F1 (052/053/054) : aucune modification de CHECK, aucune
--     nouvelle valeur de statut. On réutilise `cancelled`, déjà valide dans les
--     deux CHECK existants. Le marqueur sémantique `{"event":"payment_expired"}`
--     dans la notification permet de distinguer cette annulation automatique.
--   - SECURITY DEFINER → la fonction s'exécute hors rôle PostgREST →
--     `fn_can_bypass_reservation_guard()` (mig 047) = true → la transition vers
--     `cancelled` (statut sensible) est autorisée pour le cron.
--   - Garde anti-faux-positif : on n'expire JAMAIS une réservation pour laquelle
--     un paiement `succeeded`/`refunded` existe (protège un webhook en retard).
--   - Fenêtre mesurée sur le `payments` row `pending` (créé au clic « Payer ») :
--     proxy fiable de l'entrée dans le flux paiement. Fallback défensif sur le
--     timestamp de la réservation si aucun payments row (cas anormal).
--
-- N'agit NI sur Stripe, NI sur l'escrow, NI sur les webhooks : pure transition
-- de statut + notification in-app.
--
-- Réversible : `cron.unschedule('equishow_expire_awaiting_payment')` +
--   `drop function public.fn_expire_awaiting_payment(interval,interval)`.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Fonction d'expiration : awaiting_payment → cancelled (box + transport) ───
create or replace function public.fn_expire_awaiting_payment(
  p_stale    interval default interval '24 hours',
  p_fallback interval default interval '24 hours'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ── box_reservations (colonne `status`, timestamp `updated_at`) ──
  with upd as (
    update public.box_reservations b
       set status = 'cancelled', updated_at = now()
     where b.status = 'awaiting_payment'
       and not exists (
         select 1 from public.payments p
          where p.box_reservation_id = b.id
            and p.payment_status in ('succeeded', 'refunded'))
       and (
         exists (
           select 1 from public.payments p
            where p.box_reservation_id = b.id
              and p.payment_status = 'pending'
              and p.created_at < now() - p_stale)
         or (
           not exists (select 1 from public.payments p where p.box_reservation_id = b.id)
           and b.updated_at < now() - p_fallback)
       )
     returning b.buyer_id, b.seller_id)
  insert into public.notifications (destinataire_id, type, titre, message, donnees)
  select buyer_id, 'box_reservation', 'Paiement expiré',
         'Votre réservation de box a été annulée faute de paiement. Vous pouvez refaire une demande.',
         '{"event":"payment_expired"}'::jsonb
    from upd
  union all
  select seller_id, 'box_reservation', 'Réservation expirée',
         'Une réservation de box a expiré (paiement non reçu). Le créneau est de nouveau disponible.',
         '{"event":"payment_expired"}'::jsonb
    from upd;

  -- ── transport_reservations (colonne `statut`, timestamp `date_creation`) ──
  with upd as (
    update public.transport_reservations t
       set statut = 'cancelled'
     where t.statut = 'awaiting_payment'
       and not exists (
         select 1 from public.payments p
          where p.transport_reservation_id = t.id
            and p.payment_status in ('succeeded', 'refunded'))
       and (
         exists (
           select 1 from public.payments p
            where p.transport_reservation_id = t.id
              and p.payment_status = 'pending'
              and p.created_at < now() - p_stale)
         or (
           not exists (select 1 from public.payments p where p.transport_reservation_id = t.id)
           and t.date_creation < now() - p_fallback)
       )
     returning t.buyer_id, t.seller_id)
  insert into public.notifications (destinataire_id, type, titre, message, donnees)
  select buyer_id, 'transport_reservation', 'Paiement expiré',
         'Votre réservation de transport a été annulée faute de paiement. Vous pouvez refaire une demande.',
         '{"event":"payment_expired"}'::jsonb
    from upd
  union all
  select seller_id, 'transport_reservation', 'Réservation expirée',
         'Une réservation de transport a expiré (paiement non reçu).',
         '{"event":"payment_expired"}'::jsonb
    from upd;
end $$;

comment on function public.fn_expire_awaiting_payment(interval, interval) is
  'Expire (→ cancelled) les réservations box/transport bloquées en
   awaiting_payment après abandon Stripe. Garde succeeded/refunded. Fenêtre 24h
   sur le payments row pending. SECURITY DEFINER. Indépendant de F1. C-AWAITING-EXPIRY.';


-- ── pg_cron : toutes les 15 minutes (idempotent : unschedule si déjà posé) ──
do $$
begin
  if exists (select 1 from cron.job where jobname = 'equishow_expire_awaiting_payment') then
    perform cron.unschedule('equishow_expire_awaiting_payment');
  end if;
end $$;

select cron.schedule(
  'equishow_expire_awaiting_payment',
  '*/15 * * * *',
  $$select public.fn_expire_awaiting_payment();$$
);
