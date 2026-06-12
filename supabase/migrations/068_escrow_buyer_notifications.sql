-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 068 — Transparence acheteur autour du délai de 48h (Étape 2 escrow)
--
-- Décision produit CONSERVÉE : « silence = paiement libéré après 48h ». Aucune
-- confirmation obligatoire ajoutée. On informe seulement l'acheteur :
--   • fin de prestation (J0) → « ⏳ Vérifiez votre prestation » (48h pour signaler) ;
--   • rappel H+24 avant release → « ⏰ Plus que 24 heures » (ouvrez un litige) ;
--   • clôture de litige → notif acheteur ET vendeur (« Litige traité »).
--
-- ARCHITECTURE : 100% DB additif. Réutilise payments (prestation_end_at /
--   release_due_at déjà calculés au paiement par webhook-stripe, 4 modules),
--   le patron trigger SECURITY DEFINER (mig 056) et le patron cron (mig 067).
--   AUCUN nouvel Edge, AUCUN secret, AUCUN front (les notifs portent titre+emoji
--   et action_url → router.push existant vers cavalier-agenda?pay=<resaId> où le
--   bouton « Signaler » vit déjà).
--
-- NE TOUCHE PAS : logique escrow (held→releasing→released), délais de release,
--   Stripe, montants/commissions, alerting 067, workflow admin, écrans.
--
-- Idempotence « une seule fois » : 2 colonnes marqueurs sur payments
--   (buyer_prestation_notified_at / buyer_release_reminder_at). Le litige résolu
--   est idempotent par transition open→resolved_* (miroir mig 056).
--
-- Réversible :
--   drop trigger if exists trg_dispute_resolved_notify on public.payment_disputes;
--   drop function if exists public.fn_notify_dispute_resolved();
--   drop function if exists public.fn_escrow_buyer_notify_run();
--   perform cron.unschedule(jobid) from cron.job where jobname='equishow_escrow_buyer_notify';
--   alter table public.payments
--     drop column if exists buyer_prestation_notified_at,
--     drop column if exists buyer_release_reminder_at;
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Marqueurs d'idempotence (additifs, inertes pour le reste) ────────────
alter table public.payments
  add column if not exists buyer_prestation_notified_at timestamptz,
  add column if not exists buyer_release_reminder_at    timestamptz;

-- ── 2. Types de notification (additif, non destructif — comme 065/067) ──────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'stage_reservation','box_reservation','transport_reservation','course_request',
    'reservation_request','message','like','comment','mention','trajet_complet',
    'support_request','support_ack','support_resolved',
    'escrow_alert',
    'escrow_prestation_done','escrow_release_soon','dispute_resolved'
  ])
);

-- ── 3. fn_escrow_buyer_notify_run : 2 passes idempotentes (cron worker) ──────
-- Tout est lu depuis payments (jamais des 4 tables modules). Garde-fous :
--   transfer_state='held' (exclut legacy/not_applicable/released d'office),
--   dispute_status IS NULL (zéro spam pendant litige),
--   release_blocked_reason IS NULL (message véridique : si vendeur non onboardé,
--     les fonds ne seront PAS libérés → on ne promet pas une libération).
create or replace function public.fn_escrow_buyer_notify_run()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  v_resa     text;
  v_url      text;
  v_done     int := 0;
  v_reminder int := 0;
begin
  -- ── Passe A : fin de prestation (J0) ──────────────────────────────────────
  for r in
    select * from public.payments p
    where p.transfer_state = 'held'
      and p.prestation_end_at is not null
      and p.prestation_end_at <= now()
      and p.buyer_prestation_notified_at is null
      and p.dispute_status is null
      and p.release_blocked_reason is null
      and p.buyer_id is not null
  loop
    v_resa := coalesce(
      r.course_demand_id::text, r.stage_reservation_id::text,
      r.box_reservation_id::text, r.transport_reservation_id::text
    );
    v_url := case when v_resa is not null
                  then '/(tabs)/cavalier-agenda?pay=' || v_resa else null end;

    insert into public.notifications(destinataire_id, type, titre, message, donnees, action_url)
    values (
      r.buyer_id,
      'escrow_prestation_done',
      '⏳ Vérifiez votre prestation',
      'Votre prestation est terminée. Vous disposez de 48 heures pour signaler un '
        || 'problème avant la libération automatique du paiement au vendeur. '
        || 'Si tout s''est bien passé, aucune action n''est nécessaire.',
      jsonb_build_object('event','escrow_prestation_done','paymentId',r.id,'resaId',v_resa),
      v_url
    );
    update public.payments set buyer_prestation_notified_at = now() where id = r.id;
    v_done := v_done + 1;
  end loop;

  -- ── Passe B : rappel H+24 (24h avant le release auto) ─────────────────────
  -- Fenêtre [now ; now+24h] et release_due_at encore futur → un seul rappel,
  -- jamais après échéance (sinon message « 24h » faux).
  for r in
    select * from public.payments p
    where p.transfer_state = 'held'
      and p.release_due_at is not null
      and p.release_due_at <= now() + interval '24 hours'
      and p.release_due_at > now()
      and p.buyer_release_reminder_at is null
      and p.dispute_status is null
      and p.release_blocked_reason is null
      and p.buyer_id is not null
  loop
    v_resa := coalesce(
      r.course_demand_id::text, r.stage_reservation_id::text,
      r.box_reservation_id::text, r.transport_reservation_id::text
    );
    v_url := case when v_resa is not null
                  then '/(tabs)/cavalier-agenda?pay=' || v_resa else null end;

    insert into public.notifications(destinataire_id, type, titre, message, donnees, action_url)
    values (
      r.buyer_id,
      'escrow_release_soon',
      '⏰ Plus que 24 heures',
      'Le paiement sera automatiquement libéré dans 24 heures. '
        || 'Si vous avez rencontré un problème, ouvrez un litige maintenant.',
      jsonb_build_object('event','escrow_release_soon','paymentId',r.id,'resaId',v_resa),
      v_url
    );
    update public.payments set buyer_release_reminder_at = now() where id = r.id;
    v_reminder := v_reminder + 1;
  end loop;

  return jsonb_build_object(
    'prestation_done', v_done,
    'reminder_h24',    v_reminder,
    'ran_at',          now()
  );
end $$;

comment on function public.fn_escrow_buyer_notify_run() is
  'Notifie l''acheteur autour du délai de 48h escrow (fin de prestation J0 +
   rappel H+24). Idempotent par marqueur sur payments. Lecture 100% payments,
   4 modules. SECURITY DEFINER. Aucun effet sur transfer_state/montants/release.
   Mig 068 (Étape 2).';

-- ── 4. Cron */30 (patron mig 067) ───────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron absent — cron buyer-notify NON planifié';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'equishow_escrow_buyer_notify';
  perform cron.schedule(
    'equishow_escrow_buyer_notify',
    '*/30 * * * *',
    $job$ select public.fn_escrow_buyer_notify_run(); $job$
  );
  raise notice 'cron equishow_escrow_buyer_notify planifié (*/30 * * * *).';
end $$;

-- ── 5. Notif clôture de litige → acheteur + vendeur (patron mig 056) ─────────
-- Point unique = payment_disputes.status (écrit par manage-dispute, 2 issues
-- resolved_release / resolved_refund). Indépendant du chemin Edge. Idempotent
-- par transition open→resolved_*.
create or replace function public.fn_notify_dispute_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p      record;
  v_resa text;
  v_url  text;
begin
  -- Réagir uniquement à la transition open → resolved_*.
  if new.status not in ('resolved_release','resolved_refund')
     or old.status is not distinct from new.status
     or old.status <> 'open' then
    return new;
  end if;

  select buyer_id, seller_id,
         course_demand_id, stage_reservation_id, box_reservation_id, transport_reservation_id
    into p
    from public.payments
   where id = new.payment_id;
  if not found then return new; end if;

  v_resa := coalesce(
    p.course_demand_id::text, p.stage_reservation_id::text,
    p.box_reservation_id::text, p.transport_reservation_id::text
  );
  v_url := case when v_resa is not null
                then '/(tabs)/cavalier-agenda?pay=' || v_resa else null end;

  -- Acheteur (deep-link vers sa réservation).
  if p.buyer_id is not null then
    insert into public.notifications(destinataire_id, type, titre, message, donnees, action_url)
    values (
      p.buyer_id, 'dispute_resolved', '✅ Litige traité',
      'Votre litige a été traité.',
      jsonb_build_object('event','dispute_resolved','paymentId',new.payment_id,
                         'resaId',v_resa,'outcome',new.status),
      v_url
    );
  end if;

  -- Vendeur (information, pas de deep-link acheteur).
  if p.seller_id is not null then
    insert into public.notifications(destinataire_id, type, titre, message, donnees)
    values (
      p.seller_id, 'dispute_resolved', '✅ Litige traité',
      'Le litige concernant votre réservation a été traité.',
      jsonb_build_object('event','dispute_resolved','paymentId',new.payment_id,'outcome',new.status)
    );
  end if;

  return new;
end $$;

comment on function public.fn_notify_dispute_resolved() is
  'Notifie acheteur + vendeur à la clôture d''un litige (payment_disputes.status
   open→resolved_*). Patron mig 056, idempotent. SECURITY DEFINER. Mig 068.';

drop trigger if exists trg_dispute_resolved_notify on public.payment_disputes;
create trigger trg_dispute_resolved_notify
  after update of status on public.payment_disputes
  for each row execute function public.fn_notify_dispute_resolved();
