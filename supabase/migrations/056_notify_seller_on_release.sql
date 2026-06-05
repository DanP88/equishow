-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 056 — C-NOTIF-RELEASE : notifier le vendeur à la libération escrow
--
-- Problème (audit 2026-06-04) :
--   Quand les fonds séquestrés sont libérés (payments.transfer_state → 'released',
--   posé par release-payment OU escrow-cron-release), seul le trigger mig 049
--   (trg_payment_released_to_completed) réagit → il bascule la réservation en
--   'completed'. AUCUNE notification n'est envoyée au vendeur : il n'apprend
--   jamais que son versement a réellement été effectué. La seule notif vendeur
--   existante ("💰 Paiement reçu") est posée à l'événement PAID (webhook), donc
--   au moment du SÉQUESTRE, pas du versement.
--
-- Stratégie (point unique = DB, indépendant du chemin de release) :
--   - Trigger AFTER UPDATE OF transfer_state ON payments, PARALLÈLE à mig 049
--     (049 n'est pas modifiée).
--   - WHEN transfer_state passe à 'released' (et ne l'était pas avant) :
--     INSERT d'une notification au vendeur (payments.seller_id) avec le montant
--     net (amount_seller_ht, stocké en CENTS → /100).
--   - Couvre les 4 modules (course/stage/box/transport) via payments.type, et
--     les 2 chemins de release (manuel + cron) car les deux écrivent
--     transfer_state='released'.
--
-- Idempotence : condition `old.transfer_state is distinct from 'released'`
--   (miroir exact de mig 049) → une seule notification par libération.
--
-- SECURITY DEFINER → INSERT dans notifications hors RLS (même pattern que le cron
--   mig 054). Types réutilisés tels quels (course_request / stage_reservation /
--   box_reservation / transport_reservation), tous valides dans le CHECK
--   notifications.type.
--
-- NE TOUCHE PAS : migrations 047/049/051, Stripe, escrow, webhooks. Pur trigger DB.
-- Additif / non destructif. Réversible :
--   drop trigger trg_payment_released_notify_seller on public.payments;
--   drop function public.fn_notify_seller_on_release();
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.fn_notify_seller_on_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type      text;
  v_net_eur   numeric;
begin
  -- Idempotence : ne réagir qu'à la transition vers 'released'.
  if new.transfer_state is distinct from 'released'
     or old.transfer_state is not distinct from 'released' then
    return new;
  end if;

  -- Pas de vendeur résolu → rien à notifier (défensif, jamais le cas en prod).
  if new.seller_id is null then
    return new;
  end if;

  -- Type de notification par module (réutilise les types existants du CHECK).
  v_type := case new.type
    when 'course'    then 'course_request'
    when 'stage'     then 'stage_reservation'
    when 'box'       then 'box_reservation'
    when 'transport' then 'transport_reservation'
    else null
  end;

  -- type inconnu → on n'invente pas de valeur hors CHECK.
  if v_type is null then
    return new;
  end if;

  -- amount_seller_ht est en CENTS (integer) → euros.
  v_net_eur := coalesce(new.amount_seller_ht, 0) / 100.0;

  insert into public.notifications (destinataire_id, type, titre, message, donnees)
  values (
    new.seller_id,
    v_type,
    '💸 Versement effectué',
    'Votre paiement de ' || to_char(v_net_eur, 'FM999990.00')
      || '€ a été transféré sur votre compte.',
    jsonb_build_object(
      'event', 'released',
      'paymentId', new.id,
      'prix', v_net_eur
    )
  );

  return new;
end $$;

comment on function public.fn_notify_seller_on_release() is
  'Notifie le vendeur (payments.seller_id) à la libération escrow
   (transfer_state → released). 4 modules, 2 chemins de release. Parallèle à
   mig 049 (non modifiée). SECURITY DEFINER. Idempotent. C-NOTIF-RELEASE.';

drop trigger if exists trg_payment_released_notify_seller on public.payments;
create trigger trg_payment_released_notify_seller
  after update of transfer_state on public.payments
  for each row execute function public.fn_notify_seller_on_release();
