-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 067 — Observabilité & alerting du moteur escrow (Étape 1)
--
-- Contexte : le bug P0 du cron auto-release (mig 066) a pu rester silencieux
--   longtemps. Le cron renvoyait HTTP 200 tout en ne libérant rien → un check
--   "HTTP 200 ?" ne l'aurait PAS détecté. Seul un monitoring PAR EFFET (état réel
--   des fonds) attrape cette classe de panne.
--
-- Ce que fait cette migration (UNIQUEMENT de la surveillance, additif) :
--   • fn_escrow_health()      : photo lecture seule des 5 signaux.
--   • fn_escrow_alert_run()   : calcule, dédoublonne (anti-spam), journalise, et
--       notifie les ADMINS in-app (réutilise la table notifications existante).
--   • escrow_alert_state      : état anti-spam (signature + dernier envoi / signal).
--   • escrow_alert_log        : audit local de chaque alerte (testable sans canal).
--   • cron equishow_escrow_alert (*/30) : appelle fn_escrow_alert_run().
--   • +type notif 'escrow_alert' (additif au CHECK, comme mig 065).
--
-- NE TOUCHE PAS : montants, délais 48h, règles Stripe, logique escrow (held→
--   releasing→released), écrans utilisateur, notif acheteur, litiges. Canal =
--   notifications in-app admin (aucun système externe ; pas de secret Slack requis).
--   Aucune suppression. Réversible :
--     drop function if exists public.fn_escrow_alert_run();
--     drop function if exists public.fn_escrow_health();
--     drop table if exists public.escrow_alert_log;
--     drop table if exists public.escrow_alert_state;
--     perform cron.unschedule(jobid) from cron.job where jobname='equishow_escrow_alert';
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Type de notification (additif, non destructif) ──────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'stage_reservation','box_reservation','transport_reservation','course_request',
    'reservation_request','message','like','comment','mention','trajet_complet',
    'support_request','support_ack','support_resolved',
    'escrow_alert'
  ])
);

-- ── Tables d'état / audit ────────────────────────────────────────────────────
create table if not exists public.escrow_alert_state (
  signal          text primary key,
  signature       text not null,
  last_alerted_at timestamptz not null default now()
);
alter table public.escrow_alert_state enable row level security;
comment on table public.escrow_alert_state is
  'Anti-spam alerting escrow (mig 067) : dernière signature + horodatage par signal.';

create table if not exists public.escrow_alert_log (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level      text not null,
  signal     text not null,
  summary    text not null,
  payload    jsonb
);
alter table public.escrow_alert_log enable row level security;
create index if not exists idx_escrow_alert_log_created on public.escrow_alert_log (created_at desc);
comment on table public.escrow_alert_log is
  'Journal des alertes escrow réellement émises (mig 067). Audit/testable sans canal externe.';


-- ── fn_escrow_health : photo lecture seule des 5 signaux ────────────────────
create or replace function public.fn_escrow_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_stuck jsonb; v_seller jsonb; v_fail jsonb; v_anom jsonb; v_cron jsonb;
  v_hardcap int;
begin
  select coalesce(nullif(value::text,'')::int, 14) into v_hardcap
    from platform_settings where key = 'escrow_hard_cap_days';
  v_hardcap := coalesce(v_hardcap, 14);

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

  -- 4) Échecs Stripe : failed, ou erreur de versement, ou tentatives anormales.
  select jsonb_build_object(
    'count', count(*),
    'ids', coalesce(array_agg(id::text order by id), array[]::text[]),
    'signature', count(*)||':'||md5(coalesce(string_agg(id::text, ',' order by id), ''))
  ) into v_fail
  from public.payments
  where transfer_state = 'failed'
     or (transfer_state in ('held','releasing') and last_release_error is not null)
     or (transfer_state in ('held','releasing') and coalesce(release_attempts,0) >= 5);

  -- 5) Anomalies : held trop vieux (> hard_cap+2j) non bloqué, releasing coincé,
  --    released sans transfer_id (incohérence).
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

  -- 2) Échec cron (best-effort, cross-cron : net._http_response n'a pas d'url).
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

  return jsonb_build_object(
    'generated_at', now(),
    'stuck_funds', v_stuck,
    'cron_http_fail', v_cron,
    'seller_not_onboarded', v_seller,
    'stripe_fail', v_fail,
    'anomaly', v_anom
  );
end $$;

comment on function public.fn_escrow_health() is
  'Photo lecture seule des 5 signaux escrow (mig 067). Aucun effet de bord.';


-- ── fn_escrow_alert_run : décision + dédup + journal + notif admin ──────────
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
      ('cron_http_fail',       'warning',  3, '🟠 %s échec(s) HTTP cron (90 min)')
    ) as t(signal, level, threshold, tpl)
  loop
    v_count  := coalesce((h -> cfg.signal ->> 'count')::int, 0);
    v_sig    := coalesce(h -> cfg.signal ->> 'signature', v_count::text);
    v_amount := coalesce(h -> cfg.signal ->> 'amount_eur', '');

    if v_count >= cfg.threshold then
      select signature, last_alerted_at into v_prior_sig, v_prior_at
        from public.escrow_alert_state where signal = cfg.signal;

      -- Alerte si : nouveau / signature changée / cooldown 6h dépassé.
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
      -- Signal résolu → on efface l'état pour ré-alerter immédiatement au retour.
      delete from public.escrow_alert_state where signal = cfg.signal;
    end if;
  end loop;

  -- Livraison (in-app admin) uniquement si au moins un signal a déclenché.
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
  'Évalue les signaux escrow, dédoublonne (anti-spam 6h/signature), journalise
   (escrow_alert_log) et notifie les admins in-app (type escrow_alert). Mig 067.';


-- ── Cron */30 ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron absent — cron alerting NON planifié';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'equishow_escrow_alert';
  perform cron.schedule(
    'equishow_escrow_alert',
    '*/30 * * * *',
    $job$ select public.fn_escrow_alert_run(); $job$
  );
  raise notice 'cron equishow_escrow_alert planifié (*/30 * * * *).';
end $$;
