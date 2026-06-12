-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 069 — Litiges P0 + P1 (notif ouverture + refund réel + aging + reason)
--
-- Périmètre (additif, réversible, patrons 056/067/068) :
--   1. Type notif `dispute_opened` (additif au CHECK).
--   2. Index UNIQUE partiel anti-doublon : 1 seul litige 'open' par paiement.
--   3. fn_notify_dispute_opened + trigger AFTER INSERT payment_disputes
--      → notif tous admins + vendeur (P0).
--   4. fn_notify_on_reversed + trigger AFTER UPDATE OF transfer_state (→'reversed')
--      → notif acheteur + vendeur quand le remboursement est RÉELLEMENT effectif (P1).
--   5. fn_escrow_health / fn_escrow_alert_run étendues : signal `open_dispute_aging`
--      (litige 'open' > SLA, défaut 48h, configurable) + anti-spam 067 réutilisé (P1).
--      Seed platform_settings.escrow_dispute_sla_hours.
--
-- NE TOUCHE PAS : montants/commissions, logique release (held→releasing→released),
--   délai 48h escrow, Stripe, cron existants (release_hourly / alert / buyer_notify),
--   migrations 049/056/067/068 (réutilisées, non modifiées). Les fonctions de notif
--   ne modifient JAMAIS transfer_state (elles le lisent / réagissent).
--
-- Réversible :
--   drop trigger if exists trg_dispute_opened_notify on public.payment_disputes;
--   drop function if exists public.fn_notify_dispute_opened();
--   drop trigger if exists trg_payment_reversed_notify on public.payments;
--   drop function if exists public.fn_notify_on_reversed();
--   drop index if exists public.uniq_payment_disputes_open;
--   -- (fn_escrow_health / fn_escrow_alert_run : restaurer la version 067)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Type notif (additif) ─────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'stage_reservation','box_reservation','transport_reservation','course_request',
    'reservation_request','message','like','comment','mention','trajet_complet',
    'support_request','support_ack','support_resolved',
    'escrow_alert',
    'escrow_prestation_done','escrow_release_soon','dispute_resolved',
    'dispute_opened'
  ])
);

-- ── 2. Index UNIQUE partiel : un seul litige ouvert par paiement ─────────────
-- Remplace l'index non-unique idx_payment_disputes_open (mig 041) par une garde
-- d'intégrité. Empêche tout doublon de litige 'open' (chemin interne ET chargeback).
drop index if exists public.idx_payment_disputes_open;
create unique index if not exists uniq_payment_disputes_open
  on public.payment_disputes (payment_id)
  where status = 'open';

-- ── 3. Notif ouverture litige → admins + vendeur (P0, patron 056/068) ────────
create or replace function public.fn_notify_dispute_opened()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p        record;
  v_resa   text;
  v_url    text;
  v_amt    numeric;
  v_mod    text;
  v_admin  record;
begin
  select buyer_id, seller_id, type, amount_buyer_ttc,
         course_demand_id, stage_reservation_id, box_reservation_id, transport_reservation_id
    into p
    from public.payments
   where id = new.payment_id;
  if not found then return new; end if;

  v_amt := coalesce(p.amount_buyer_ttc, 0) / 100.0;
  v_mod := case p.type
    when 'course' then 'Cours' when 'stage' then 'Stage'
    when 'box' then 'Box' when 'transport' then 'Transport' else coalesce(p.type,'—') end;
  v_resa := coalesce(
    p.course_demand_id::text, p.stage_reservation_id::text,
    p.box_reservation_id::text, p.transport_reservation_id::text
  );
  v_url := case when v_resa is not null
                then '/(tabs)/cavalier-agenda?pay=' || v_resa else null end;

  -- Admins (fan-out, patron 067).
  for v_admin in select id from public.users where role = 'admin' loop
    insert into public.notifications(destinataire_id, type, titre, message, donnees, action_url)
    values (
      v_admin.id, 'dispute_opened', '🚩 Nouveau litige',
      'Nouveau litige ouvert sur une réservation. Montant : '
        || to_char(v_amt, 'FM999990.00') || '€. Module : ' || v_mod || '.',
      jsonb_build_object('event','dispute_opened','paymentId',new.payment_id,
                         'disputeId',new.id,'source',new.source),
      '/admin-disputes'
    );
  end loop;

  -- Vendeur (deep-link sa vente).
  if p.seller_id is not null then
    insert into public.notifications(destinataire_id, type, titre, message, donnees, action_url)
    values (
      p.seller_id, 'dispute_opened', '⚠️ Litige ouvert',
      'Un litige a été ouvert sur une de vos ventes. Le versement est suspendu '
        || 'le temps de la vérification.',
      jsonb_build_object('event','dispute_opened','paymentId',new.payment_id,'disputeId',new.id),
      v_url
    );
  end if;

  return new;
end $$;

comment on function public.fn_notify_dispute_opened() is
  'Notifie tous les admins + le vendeur à l''ouverture d''un litige
   (AFTER INSERT payment_disputes). Couvre interne + chargeback. Patron 056/068.
   SECURITY DEFINER. Ne modifie jamais transfer_state. Mig 069 (P0).';

drop trigger if exists trg_dispute_opened_notify on public.payment_disputes;
create trigger trg_dispute_opened_notify
  after insert on public.payment_disputes
  for each row execute function public.fn_notify_dispute_opened();

-- ── 4. Notif remboursement réel (transfer_state → reversed) (P1, patron 056) ─
create or replace function public.fn_notify_on_reversed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type   text;
  v_resa   text;
  v_url    text;
begin
  -- Idempotence : seulement à la transition vers 'reversed' (miroir 056).
  if new.transfer_state is distinct from 'reversed'
     or old.transfer_state is not distinct from 'reversed' then
    return new;
  end if;

  -- Type par module (réutilise les types du CHECK, comme 056). Pas de vendeur/
  -- acheteur résolu → rien (défensif).
  v_type := case new.type
    when 'course'    then 'course_request'
    when 'stage'     then 'stage_reservation'
    when 'box'       then 'box_reservation'
    when 'transport' then 'transport_reservation'
    else null end;
  if v_type is null then return new; end if;

  v_resa := coalesce(
    new.course_demand_id::text, new.stage_reservation_id::text,
    new.box_reservation_id::text, new.transport_reservation_id::text
  );
  v_url := case when v_resa is not null
                then '/(tabs)/cavalier-agenda?pay=' || v_resa else null end;

  -- Acheteur.
  if new.buyer_id is not null then
    insert into public.notifications(destinataire_id, type, titre, message, donnees, action_url)
    values (
      new.buyer_id, v_type, '↩️ Remboursement effectué',
      'Votre remboursement a été déclenché. Le retour sur carte peut prendre '
        || 'quelques jours selon votre banque.',
      jsonb_build_object('event','reversed','paymentId',new.id,'resaId',v_resa),
      v_url
    );
  end if;

  -- Vendeur.
  if new.seller_id is not null then
    insert into public.notifications(destinataire_id, type, titre, message, donnees)
    values (
      new.seller_id, v_type, '↩️ Vente remboursée',
      'La réservation a été remboursée à l''acheteur.',
      jsonb_build_object('event','reversed','paymentId',new.id)
    );
  end if;

  return new;
end $$;

comment on function public.fn_notify_on_reversed() is
  'Notifie acheteur + vendeur quand un paiement est réellement remboursé
   (transfer_state → reversed). Idempotent (transition). Patron 056. Mig 069 (P1).';

drop trigger if exists trg_payment_reversed_notify on public.payments;
create trigger trg_payment_reversed_notify
  after update of transfer_state on public.payments
  for each row execute function public.fn_notify_on_reversed();

-- ── 5. Alerting litiges vieillissants — extension 067 (P1) ───────────────────
-- Seed du seuil SLA (configurable sans redeploy, homogène avec escrow_hold_hours_*).
insert into public.platform_settings (key, value, description) values
  ('escrow_dispute_sla_hours', '48', 'Litige ouvert au-delà de N heures = alerte (SLA)')
on conflict (key) do nothing;

-- fn_escrow_health : version 067 + 6e signal open_dispute_aging (additif).
create or replace function public.fn_escrow_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_stuck jsonb; v_seller jsonb; v_fail jsonb; v_anom jsonb; v_cron jsonb;
  v_dispute jsonb;
  v_hardcap int; v_sla int;
begin
  select coalesce(nullif(value::text,'')::int, 14) into v_hardcap
    from platform_settings where key = 'escrow_hard_cap_days';
  v_hardcap := coalesce(v_hardcap, 14);
  select coalesce(nullif(value::text,'')::int, 48) into v_sla
    from platform_settings where key = 'escrow_dispute_sla_hours';
  v_sla := coalesce(v_sla, 48);

  -- 1) Fonds coincés : held, échu > 2h, sans litige/blocage, vendeur prêt.
  select jsonb_build_object(
    'count', count(*),
    'amount_eur', round(coalesce(sum(p.amount_seller_ht),0)/100.0, 2),
    'ids', coalesce(array_agg(p.id::text order by p.id), array[]::text[]),
    'signature', count(*)||':'||md5(coalesce(string_agg(p.id::text, ',' order by p.id), ''))
  ) into v_stuck
  from public.payments p
  join public.users s on s.id = p.seller_id
  where p.transfer_state = 'held'
    and p.release_due_at < now() - interval '2 hours'
    and p.dispute_status is null
    and p.release_blocked_reason is null
    and s.stripe_account_id is not null
    and s.stripe_charges_enabled is distinct from false
    and s.stripe_payouts_enabled is distinct from false;

  -- 3) Vendeur non onboardé (held bloqué).
  select jsonb_build_object(
    'count', count(*),
    'amount_eur', round(coalesce(sum(amount_seller_ht),0)/100.0, 2),
    'oldest_hours', coalesce(round(extract(epoch from now()-min(paid_at))/3600.0)::int, 0),
    'signature', count(*)||':'||md5(coalesce(string_agg(id::text, ',' order by id), ''))
  ) into v_seller
  from public.payments
  where transfer_state = 'held' and release_blocked_reason = 'seller_not_onboarded';

  -- 4) Échecs Stripe.
  select jsonb_build_object(
    'count', count(*),
    'ids', coalesce(array_agg(id::text order by id), array[]::text[]),
    'signature', count(*)||':'||md5(coalesce(string_agg(id::text, ',' order by id), ''))
  ) into v_fail
  from public.payments
  where transfer_state = 'failed'
     or (transfer_state in ('held','releasing') and last_release_error is not null)
     or (transfer_state in ('held','releasing') and coalesce(release_attempts,0) >= 5);

  -- 5) Anomalies.
  select jsonb_build_object(
    'count', count(*),
    'ids', coalesce(array_agg(id::text order by id), array[]::text[]),
    'signature', count(*)||':'||md5(coalesce(string_agg(id::text, ',' order by id), ''))
  ) into v_anom
  from public.payments
  where (transfer_state = 'held'
         and coalesce(paid_at, created_at) < now() - ((v_hardcap + 2)||' days')::interval
         and release_blocked_reason is null and dispute_status is null)
     or (transfer_state = 'releasing' and updated_at < now() - interval '1 hour')
     or (transfer_state = 'released' and stripe_transfer_id is null);

  -- 2) Échec cron (best-effort, cross-cron).
  begin
    select jsonb_build_object(
      'count', count(*),
      'signature', count(*)::text
    ) into v_cron
    from net._http_response
    where created > now() - interval '90 minutes'
      and (timed_out is true or status_code is null or status_code >= 400);
  exception when others then
    v_cron := jsonb_build_object('count', 0, 'signature', '0', 'note', 'net unreadable');
  end;

  -- 6) Litiges ouverts en souffrance (> SLA heures). NOUVEAU (mig 069).
  select jsonb_build_object(
    'count', count(*),
    'sla_hours', v_sla,
    'oldest_hours', coalesce(round(extract(epoch from now()-min(created_at))/3600.0)::int, 0),
    'ids', coalesce(array_agg(id::text order by id), array[]::text[]),
    'signature', count(*)||':'||md5(coalesce(string_agg(id::text, ',' order by id), ''))
  ) into v_dispute
  from public.payment_disputes
  where status = 'open'
    and created_at < now() - (v_sla||' hours')::interval;

  return jsonb_build_object(
    'generated_at', now(),
    'stuck_funds', v_stuck,
    'cron_http_fail', v_cron,
    'seller_not_onboarded', v_seller,
    'stripe_fail', v_fail,
    'anomaly', v_anom,
    'open_dispute_aging', v_dispute
  );
end $$;

comment on function public.fn_escrow_health() is
  'Photo lecture seule des 6 signaux escrow (mig 067 + open_dispute_aging mig 069).
   Aucun effet de bord.';

-- fn_escrow_alert_run : version 067 + ligne open_dispute_aging dans le loop.
create or replace function public.fn_escrow_alert_run()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  h          jsonb;
  cfg        record;
  v_count    int;
  v_sig      text;
  v_amount   text;
  v_prior_sig text;
  v_prior_at  timestamptz;
  v_should   boolean;
  fired      text[] := array[]::text[];
  suppressed text[] := array[]::text[];
  msg_parts  text[] := array[]::text[];
  v_admin    record;
  v_deliver  int := 0;
begin
  h := public.fn_escrow_health();

  for cfg in
    select * from (values
      ('stuck_funds',          'critical', 1, '🔴 %s paiement(s) coincé(s) (%s€)'),
      ('stripe_fail',          'critical', 1, '🔴 %s échec(s) Stripe versement'),
      ('anomaly',              'critical', 1, '🔴 %s anomalie(s) escrow'),
      ('seller_not_onboarded', 'info',     1, '🟡 %s vendeur(s) non onboardé(s) (%s€)'),
      ('cron_http_fail',       'warning',  3, '🟠 %s échec(s) HTTP cron (90 min)'),
      ('open_dispute_aging',   'warning',  1, '🟠 %s litige(s) ouvert(s) en souffrance')
    ) as t(signal, level, threshold, tpl)
  loop
    v_count  := coalesce((h -> cfg.signal ->> 'count')::int, 0);
    v_sig    := coalesce(h -> cfg.signal ->> 'signature', v_count::text);
    v_amount := coalesce(h -> cfg.signal ->> 'amount_eur', '');

    if v_count >= cfg.threshold then
      select signature, last_alerted_at into v_prior_sig, v_prior_at
        from public.escrow_alert_state where signal = cfg.signal;

      v_should := (v_prior_sig is null)
               or (v_prior_sig is distinct from v_sig)
               or (v_prior_at < now() - interval '6 hours');

      if v_should then
        fired     := fired || cfg.signal;
        msg_parts := msg_parts || format(cfg.tpl, v_count::text, v_amount);
        insert into public.escrow_alert_state(signal, signature, last_alerted_at)
          values (cfg.signal, v_sig, now())
          on conflict (signal) do update
            set signature = excluded.signature, last_alerted_at = excluded.last_alerted_at;
      else
        suppressed := suppressed || cfg.signal;
      end if;
    else
      delete from public.escrow_alert_state where signal = cfg.signal;
    end if;
  end loop;

  if coalesce(array_length(fired, 1), 0) > 0 then
    insert into public.escrow_alert_log(level, signal, summary, payload)
      values ('alert', array_to_string(fired, ','), array_to_string(msg_parts, ' | '), h);

    for v_admin in select id from public.users where role = 'admin' loop
      insert into public.notifications(destinataire_id, type, titre, message, donnees)
      values (
        v_admin.id, 'escrow_alert', '⚠️ Alerte escrow',
        array_to_string(msg_parts, ' | '),
        jsonb_build_object('event','escrow_alert','signals',to_jsonb(fired),'health',h)
      );
      v_deliver := v_deliver + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'fired', to_jsonb(fired),
    'suppressed', to_jsonb(suppressed),
    'delivered', v_deliver,
    'health', h
  );
end $$;

comment on function public.fn_escrow_alert_run() is
  'Évalue les 6 signaux escrow (067 + open_dispute_aging 069), dédoublonne
   (anti-spam 6h/signature), journalise et notifie les admins in-app. Mig 069.';

-- ── 6. Dédup notif litige résolu (anti-doublon refund) ──────────────────────
-- Le remboursement admin produit DEUX transitions : payments.transfer_state →
-- 'reversed' (→ fn_notify_on_reversed « ↩️ Remboursement effectué ») ET
-- payment_disputes.status → 'resolved_refund' (→ fn_notify_dispute_resolved 068
-- « ✅ Litige traité »). Pour l'acheteur cela ferait deux messages redondants.
-- Décision : le message de remboursement (069 reversed) est le message UNIQUE et
-- clair pour le cas refund → on neutralise fn_notify_dispute_resolved sur
-- 'resolved_refund'. Elle reste active sur 'resolved_release' (où il n'y a pas de
-- reversed ; l'acheteur doit être informé que son litige est clos en faveur du
-- versement). Pur redéfinition de la fonction 068 (additif, réversible : restaurer
-- la version 068 qui couvrait resolved_release ET resolved_refund).
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
  -- Réagir UNIQUEMENT à open → resolved_release. Le cas resolved_refund est
  -- couvert par fn_notify_on_reversed (mig 069) pour éviter le doublon acheteur.
  if new.status <> 'resolved_release'
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
  'Notifie acheteur + vendeur à la clôture d''un litige par LIBÉRATION
   (open→resolved_release). Le cas resolved_refund est volontairement neutralisé
   ici : couvert par fn_notify_on_reversed (« Remboursement effectué », mig 069)
   pour un message acheteur unique. Trigger trg_dispute_resolved_notify (mig 068)
   inchangé. Mig 069.';
