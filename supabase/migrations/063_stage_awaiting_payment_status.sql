-- ═══════════════════════════════════════════════════════════════════════════
-- 063_stage_awaiting_payment_status.sql
-- Aligne Stage sur Box/Transport : `awaiting_payment` devient un VRAI statut.
--
-- Décision produit (2026-06-09) : le cycle Stage cible est
--   pending → accepted → awaiting_payment → paid → completed
-- avec séquestre/escrow (déjà câblé, module-agnostique). Le seul chaînon
-- manquant était l'état `awaiting_payment` côté Stage.
--
-- Cette migration fait DEUX choses, et rien d'autre :
--   1. Étendre le CHECK stage_reservations.status pour accepter 'awaiting_payment'.
--   2. Étendre fn_expire_awaiting_payment (mig 055) pour expirer aussi les
--      stages bloqués en awaiting_payment (abandon Stripe) → 'cancelled'.
--
-- PRÉREQUIS D'ORDRE : la migration 062 (dispo symétrique Stage+Box, S inclut
--   awaiting_payment) DOIT être appliquée AVANT 063. Sinon, sous l'ancien corps
--   053, la transition awaiting_payment→cancelled ne libère PAS la place
--   (awaiting_payment absent du release set 053) → fuite de place.
--
-- N'agit NI sur Stripe, NI sur l'escrow, NI sur le webhook (qui pose 'paid' sans
--   condition de statut antérieur), NI sur les guards 047 (awaiting_payment
--   n'est pas un statut sensible → le cavalier l'écrit sans bypass), NI sur 054
--   (Job B accepted→payment_expired reste valide pour « accepté jamais payé »),
--   NI sur 049 (paid→completed déjà module-agnostique), NI sur 062.
--
-- Réversible : restaurer le CHECK 052 (sans awaiting_payment) + restaurer le
--   corps 055 de fn_expire_awaiting_payment (box+transport seulement). Voir bloc
--   ROLLBACK en fin de fichier. ⚠ Avant rollback du CHECK : s'assurer qu'aucune
--   ligne stage n'est en 'awaiting_payment' (sinon la contrainte échoue).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. CHECK stage_reservations.status : +awaiting_payment ──────────────────
do $$ declare cn text; begin
  select conname into cn from pg_constraint
   where conrelid='public.stage_reservations'::regclass and contype='c'
     and pg_get_constraintdef(oid) ilike '%status = ANY%';
  if cn is not null then execute format('alter table public.stage_reservations drop constraint %I', cn); end if;
  alter table public.stage_reservations add constraint stage_reservations_status_check
    check (status = any (array['pending','accepted','rejected','awaiting_payment','paid','completed','cancelled','expired','payment_expired']));
end $$;

-- ── 2. fn_expire_awaiting_payment : +bloc stage (box+transport conservés) ────
--    Mirror exact du bloc box (col `status`, ts `updated_at`, fk
--    `stage_reservation_id`, notif type 'stage_reservation', destinataires
--    cavalier_id/coach_id). Garde succeeded/refunded. SECURITY DEFINER → la
--    transition vers 'cancelled' (sensible) est autorisée pour le cron, et le
--    trigger 062 trg_zz_availability_stage libère la place (awaiting_payment ∈ S
--    → cancelled ∈ release).
create or replace function public.fn_expire_awaiting_payment(
  p_stale    interval default interval '24 hours',
  p_fallback interval default interval '24 hours'
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ── box_reservations (col `status`, ts `updated_at`) ──
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

  -- ── transport_reservations (col `statut`, ts `date_creation`) ──
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

  -- ── stage_reservations (col `status`, ts `updated_at`, parties cavalier/coach) ──
  with upd as (
    update public.stage_reservations s
       set status = 'cancelled', updated_at = now()
     where s.status = 'awaiting_payment'
       and not exists (
         select 1 from public.payments p
          where p.stage_reservation_id = s.id
            and p.payment_status in ('succeeded', 'refunded'))
       and (
         exists (
           select 1 from public.payments p
            where p.stage_reservation_id = s.id
              and p.payment_status = 'pending'
              and p.created_at < now() - p_stale)
         or (
           not exists (select 1 from public.payments p where p.stage_reservation_id = s.id)
           and s.updated_at < now() - p_fallback)
       )
     returning s.cavalier_id, s.coach_id)
  insert into public.notifications (destinataire_id, type, titre, message, donnees)
  select cavalier_id, 'stage_reservation', 'Paiement expiré',
         'Votre réservation de stage a été annulée faute de paiement. Vous pouvez refaire une demande.',
         '{"event":"payment_expired"}'::jsonb
    from upd
  union all
  select coach_id, 'stage_reservation', 'Réservation expirée',
         'Une réservation de stage a expiré (paiement non reçu). Les places sont de nouveau disponibles.',
         '{"event":"payment_expired"}'::jsonb
    from upd;
end $$;

comment on function public.fn_expire_awaiting_payment(interval, interval) is
  'Expire (→ cancelled) les réservations box/transport/stage bloquées en
   awaiting_payment après abandon Stripe. Garde succeeded/refunded. Fenêtre 24h
   sur le payments row pending. SECURITY DEFINER. Stage ajouté en mig 063.';

-- Le cron 'equishow_expire_awaiting_payment' (mig 055, */15) appelle cette
-- fonction sans signature explicite → il prend automatiquement le nouveau corps.
-- Aucun reschedule nécessaire.

-- ═════════════════════════════════════════════════════════════════════════════
-- ROLLBACK :
--   1) Vérifier : select count(*) from stage_reservations where status='awaiting_payment';
--      (doit être 0 ; sinon repasser ces lignes en 'cancelled' avant de restaurer le CHECK).
--   2) CHECK : restaurer la version 052 (sans 'awaiting_payment') :
--        alter table public.stage_reservations drop constraint stage_reservations_status_check;
--        alter table public.stage_reservations add constraint stage_reservations_status_check
--          check (status = any (array['pending','accepted','rejected','paid','completed','cancelled','expired','payment_expired']));
--   3) fn_expire_awaiting_payment : restaurer le corps 055 (box+transport uniquement).
-- ═════════════════════════════════════════════════════════════════════════════
