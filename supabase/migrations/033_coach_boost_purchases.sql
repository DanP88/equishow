-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 033 — Table coach_boost_purchases + pg_cron (boost expire + certif)
--
-- Non destructif : CREATE TABLE + CREATE POLICY + cron.schedule uniquement.
-- Logique 100% séparée des paiements coach/transport (table dédiée).
--
-- Le Boost = service plateforme (commission 100%, sans Stripe Connect).
-- Idempotence : stripe_checkout_session_id UNIQUE + status='paid' sentinel.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── coach_boost_purchases ───────────────────────────────────────────────────
create table if not exists public.coach_boost_purchases (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.users(id) on delete cascade,
  amount_cents                int  not null check (amount_cents > 0),
  duration_days               int  not null default 30 check (duration_days > 0),
  status                      text not null default 'pending'
                                check (status in ('pending','paid','failed','refunded','cancelled')),
  stripe_checkout_session_id  text unique,
  stripe_payment_intent_id    text,
  stripe_charge_id            text,
  stripe_refund_id            text,
  started_at                  timestamptz,
  expires_at                  timestamptz,
  paid_at                     timestamptz,
  refunded_at                 timestamptz,
  error_message               text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists idx_coach_boost_user
  on public.coach_boost_purchases(user_id);
create index if not exists idx_coach_boost_status
  on public.coach_boost_purchases(status) where status = 'pending';
create index if not exists idx_coach_boost_session
  on public.coach_boost_purchases(stripe_checkout_session_id);

create trigger trg_coach_boost_purchases_updated_at
  before update on public.coach_boost_purchases
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.coach_boost_purchases enable row level security;

-- Lecture : le coach voit ses propres achats
drop policy if exists "coach_boost_select_own" on public.coach_boost_purchases;
create policy "coach_boost_select_own" on public.coach_boost_purchases
  for select to authenticated using (user_id = auth.uid());

-- Admin : tout (lecture + écriture)
drop policy if exists "coach_boost_admin_all" on public.coach_boost_purchases;
create policy "coach_boost_admin_all" on public.coach_boost_purchases
  for all using (public.is_app_admin()) with check (public.is_app_admin());

-- Pas de policy INSERT/UPDATE/DELETE pour authenticated → service_role only.
-- (Edge Functions agissent en service_role et bypass RLS.)

-- ─────────────────────────────────────────────────────────────────────────────
-- fn_apply_boost — appelée par webhook après paiement réussi
--
-- Cumul : nouvelle expiration = GREATEST(now(), expires_at_courant) + duration.
-- Idempotent : si la purchase est déjà 'paid', no-op.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_apply_boost(
  p_purchase_id        uuid,
  p_stripe_charge_id   text,
  p_stripe_pi_id       text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid;
  v_duration     int;
  v_already_paid boolean;
  v_now          timestamptz := now();
  v_current_exp  timestamptz;
  v_new_exp      timestamptz;
begin
  -- Idempotence : si déjà paid → noop
  select user_id, duration_days, (status = 'paid')
    into v_user_id, v_duration, v_already_paid
    from public.coach_boost_purchases
    where id = p_purchase_id
    for update;

  if v_user_id is null then
    raise warning 'fn_apply_boost: purchase % introuvable', p_purchase_id;
    return;
  end if;

  if v_already_paid then
    return;
  end if;

  -- Calculer nouvelle expiration (cumul)
  select boost_expires_at into v_current_exp
    from public.coach_profiles
    where user_id = v_user_id;

  v_new_exp := greatest(coalesce(v_current_exp, v_now), v_now)
             + (v_duration || ' days')::interval;

  -- Update purchase
  update public.coach_boost_purchases
    set status = 'paid',
        stripe_charge_id = coalesce(stripe_charge_id, p_stripe_charge_id),
        stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_stripe_pi_id),
        paid_at = v_now,
        started_at = coalesce(started_at, v_now),
        expires_at = v_new_exp,
        updated_at = v_now
    where id = p_purchase_id;

  -- Update coach_profiles (upsert au cas où le row n'existerait pas — rare)
  update public.coach_profiles
    set is_boosted = true,
        boost_started_at = coalesce(boost_started_at, v_now),
        boost_expires_at = v_new_exp,
        updated_at = v_now
    where user_id = v_user_id;
end $$;

grant execute on function public.fn_apply_boost(uuid, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- pg_cron — boost expire + recalc certified (quotidien 3h UTC)
--
-- L'extension pg_cron est déjà disponible sur Supabase. Si la commande échoue,
-- l'activer via Dashboard → Database → Extensions → pg_cron.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Supprime un job existant éventuel (idempotent)
    perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'equishow_boost_certified_daily';

    perform cron.schedule(
      'equishow_boost_certified_daily',
      '0 3 * * *',  -- 03:00 UTC quotidien
      $cron$
        select public.fn_expire_boosts();
        select public.fn_recalc_coach_certified();
      $cron$
    );
  else
    raise notice 'pg_cron non installé — schedule manuel requis';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Notes :
-- - Aucune modification de `payments` ni de `create-checkout-session` Edge fn.
-- - Le webhook-stripe sera étendu (patch séparé) pour détecter kind='boost'
--   et appeler fn_apply_boost.
-- - Prix : actuellement 490 cents (4,90€), 30 jours. Modifiable dans la Edge fn.
-- ─────────────────────────────────────────────────────────────────────────────
