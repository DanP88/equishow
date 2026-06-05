-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 054 — F1 disponibilités : expirations automatiques (pg_cron)
--
-- Job A (72h vendeur)  : pending → expired           (clôture, aucune dispo consommée)
-- Job B (24h paiement) : accepted → payment_expired  (libère la dispo via trigger 053)
--
-- Cadence : toutes les 15 minutes. Les fonctions sont SECURITY DEFINER (owner) →
--   exécutées hors rôle PostgREST → fn_can_bypass_reservation_guard() = true →
--   transitions sensibles (expired/payment_expired) autorisées (guard 053).
--   Les UPDATE déclenchent les triggers 053 (libération + notifications ci-dessous).
--
-- Notifications : INSERT direct dans public.notifications (realtime in-app existant).
--   type contraint par CHECK → on réutilise le type par module
--   (course_request / stage_reservation / box_reservation / transport_reservation).
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ Job A : 72h vendeur — pending → expired ════════════════════════════════
create or replace function public.fn_expire_pending() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- course
  with upd as (
    update public.course_demands set status='expired', updated_at=now()
     where status='pending' and now() - created_at > interval '72 hours'
     returning cavalier_id, coach_id)
  insert into public.notifications (destinataire_id, type, titre, message, donnees)
  select cavalier_id, 'course_request', 'Demande expirée',
         'Votre demande de cours a expiré : le coach n''a pas répondu sous 72h.', '{"event":"expired"}'::jsonb from upd
  union all
  select coach_id, 'course_request', 'Demande expirée',
         'Une demande de cours a expiré (absence de réponse sous 72h).', '{"event":"expired"}'::jsonb from upd;

  -- stage
  with upd as (
    update public.stage_reservations set status='expired', updated_at=now()
     where status='pending' and now() - created_at > interval '72 hours'
     returning cavalier_id, coach_id)
  insert into public.notifications (destinataire_id, type, titre, message, donnees)
  select cavalier_id, 'stage_reservation', 'Demande expirée',
         'Votre demande de stage a expiré (absence de réponse sous 72h).', '{"event":"expired"}'::jsonb from upd
  union all
  select coach_id, 'stage_reservation', 'Demande expirée',
         'Une demande de stage a expiré (absence de réponse sous 72h).', '{"event":"expired"}'::jsonb from upd;

  -- box
  with upd as (
    update public.box_reservations set status='expired', updated_at=now()
     where status='pending' and now() - created_at > interval '72 hours'
     returning buyer_id, seller_id)
  insert into public.notifications (destinataire_id, type, titre, message, donnees)
  select buyer_id, 'box_reservation', 'Demande expirée',
         'Votre demande de box a expiré (absence de réponse sous 72h).', '{"event":"expired"}'::jsonb from upd
  union all
  select seller_id, 'box_reservation', 'Demande expirée',
         'Une demande de box a expiré (absence de réponse sous 72h).', '{"event":"expired"}'::jsonb from upd;

  -- transport (statut / date_creation)
  with upd as (
    update public.transport_reservations set statut='expired'
     where statut='pending' and now() - date_creation > interval '72 hours'
     returning buyer_id, seller_id)
  insert into public.notifications (destinataire_id, type, titre, message, donnees)
  select buyer_id, 'transport_reservation', 'Demande expirée',
         'Votre demande de transport a expiré (absence de réponse sous 72h).', '{"event":"expired"}'::jsonb from upd
  union all
  select seller_id, 'transport_reservation', 'Demande expirée',
         'Une demande de transport a expiré (absence de réponse sous 72h).', '{"event":"expired"}'::jsonb from upd;
end $$;


-- ═══ Job B : 24h paiement — accepted → payment_expired ══════════════════════
create or replace function public.fn_expire_unpaid_accepted() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- course
  with upd as (
    update public.course_demands set status='payment_expired', updated_at=now()
     where status='accepted' and accepted_at is not null and now() - accepted_at > interval '24 hours'
     returning cavalier_id, coach_id)
  insert into public.notifications (destinataire_id, type, titre, message, donnees)
  select cavalier_id, 'course_request', 'Paiement expiré',
         'Votre réservation de cours a expiré : paiement non effectué sous 24h. Le créneau est de nouveau disponible.', '{"event":"payment_expired"}'::jsonb from upd
  union all
  select coach_id, 'course_request', 'Paiement expiré',
         'Une réservation de cours a expiré (paiement non reçu sous 24h).', '{"event":"payment_expired"}'::jsonb from upd;

  -- stage
  with upd as (
    update public.stage_reservations set status='payment_expired', updated_at=now()
     where status='accepted' and accepted_at is not null and now() - accepted_at > interval '24 hours'
     returning cavalier_id, coach_id)
  insert into public.notifications (destinataire_id, type, titre, message, donnees)
  select cavalier_id, 'stage_reservation', 'Paiement expiré',
         'Votre réservation de stage a expiré (paiement non reçu sous 24h). Les places sont de nouveau disponibles.', '{"event":"payment_expired"}'::jsonb from upd
  union all
  select coach_id, 'stage_reservation', 'Paiement expiré',
         'Une réservation de stage a expiré (paiement non reçu sous 24h).', '{"event":"payment_expired"}'::jsonb from upd;

  -- box
  with upd as (
    update public.box_reservations set status='payment_expired', updated_at=now()
     where status='accepted' and accepted_at is not null and now() - accepted_at > interval '24 hours'
     returning buyer_id, seller_id)
  insert into public.notifications (destinataire_id, type, titre, message, donnees)
  select buyer_id, 'box_reservation', 'Paiement expiré',
         'Votre réservation de box a expiré (paiement non reçu sous 24h). La période est de nouveau disponible.', '{"event":"payment_expired"}'::jsonb from upd
  union all
  select seller_id, 'box_reservation', 'Paiement expiré',
         'Une réservation de box a expiré (paiement non reçu sous 24h).', '{"event":"payment_expired"}'::jsonb from upd;

  -- transport
  with upd as (
    update public.transport_reservations set statut='payment_expired'
     where statut='accepted' and accepted_at is not null and now() - accepted_at > interval '24 hours'
     returning buyer_id, seller_id)
  insert into public.notifications (destinataire_id, type, titre, message, donnees)
  select buyer_id, 'transport_reservation', 'Paiement expiré',
         'Votre réservation de transport a expiré (paiement non reçu sous 24h). Les places sont de nouveau disponibles.', '{"event":"payment_expired"}'::jsonb from upd
  union all
  select seller_id, 'transport_reservation', 'Paiement expiré',
         'Une réservation de transport a expiré (paiement non reçu sous 24h).', '{"event":"payment_expired"}'::jsonb from upd;
end $$;


-- ═══ Planification pg_cron (toutes les 15 min) ══════════════════════════════
do $$ begin
  if exists (select 1 from cron.job where jobname='equishow_expire_pending') then
    perform cron.unschedule('equishow_expire_pending');
  end if;
  if exists (select 1 from cron.job where jobname='equishow_expire_unpaid') then
    perform cron.unschedule('equishow_expire_unpaid');
  end if;
end $$;

select cron.schedule('equishow_expire_pending', '*/15 * * * *', $$select public.fn_expire_pending()$$);
select cron.schedule('equishow_expire_unpaid',  '*/15 * * * *', $$select public.fn_expire_unpaid_accepted()$$);
