-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 086 — Anti-abus de l'essai gratuit Coach (multi-comptes)
--
-- ⚠️ NON APPLIQUÉE EN PROD à ce stade (cohérent avec 085). Le front fail-open
--    tant que ces RPC n'existent pas (aucun faux blocage).
--
-- Risque adressé : un coach crée plusieurs comptes pour re-bénéficier des 3
-- séances gratuites. L'essai est lié à une IDENTITÉ, pas seulement au user_id.
--
-- Hiérarchie de preuve (volontairement PEU agressive au départ) :
--   • Stripe Connect (stripe_account_id) = PREUVE FORTE → auto-blocage du doublon
--   • email = faible (déjà UNIQUE sur users → pas de doublon exact possible)
--   • nom+prénom+région = jamais bloquant seul → AUDIT admin uniquement
--   • téléphone / SIRET / ville = colonnes ABSENTES aujourd'hui → extension future
--
-- Dépendance : fn_coach_paid_sessions (085). « Pro » = plan_id LIKE 'coach-%'
-- (volontairement PAS fn_is_paid_plan, qui verrait un plan cavalier legacy comme payant).
-- 100% additif : 1 table + RLS + 3 fonctions. Aucun impact escrow/réservation.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Table de suivi par identité ──────────────────────────────────────────
create table if not exists public.coach_trial_identity (
  user_id                 uuid primary key references public.users(id) on delete cascade,
  coach_identity_id       uuid not null default gen_random_uuid(),  -- groupe d'identité (fusion manuelle admin possible)
  trial_used              boolean not null default false,
  paid_sessions_count     integer not null default 0,
  first_trial_started_at  timestamptz,
  trial_completed_at      timestamptz,
  admin_status            text not null default 'trial_allowed'
                            check (admin_status in ('trial_allowed','trial_blocked_duplicate','manual_review')),
  reviewed_by             uuid references public.users(id) on delete set null,
  reviewed_at             timestamptz,   -- si renseigné : décision humaine, l'auto-détection ne réécrit plus
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_coach_trial_identity_group  on public.coach_trial_identity(coach_identity_id);
create index if not exists idx_coach_trial_identity_status on public.coach_trial_identity(admin_status);

alter table public.coach_trial_identity enable row level security;

-- Lecture : le coach voit sa ligne ; l'admin voit tout.
drop policy if exists "coach_trial_identity_select_own" on public.coach_trial_identity;
create policy "coach_trial_identity_select_own" on public.coach_trial_identity
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- Écriture admin (override de statut). Le reste passe par les fonctions SECURITY DEFINER.
drop policy if exists "coach_trial_identity_update_admin" on public.coach_trial_identity;
create policy "coach_trial_identity_update_admin" on public.coach_trial_identity
  for update using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- ── 2. Statut complet du coach (sync + éligibilité anti-abus) ───────────────
-- Volatile : fait l'upsert de la ligne identité puis renvoie l'état d'accès.
create or replace function public.fn_coach_trial_status(p_uid uuid)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_stripe   text;
  v_plan     text;
  v_plan_id  text;
  v_count    integer;
  v_has_pro  boolean;
  v_dup      boolean;
  v_status   text;
  v_reviewed timestamptz;
begin
  select stripe_account_id, plan, plan_id
    into v_stripe, v_plan, v_plan_id
  from public.users where id = p_uid;

  v_count   := public.fn_coach_paid_sessions(p_uid);
  -- Pro coach = plan COACH payant uniquement (coach-mensuel / coach-annuel).
  -- (Ne PAS utiliser fn_is_paid_plan : un plan cavalier legacy serait vu comme « Pro ».)
  v_has_pro := lower(coalesce(v_plan_id, '')) like 'coach-%';

  -- PREUVE FORTE : même compte Stripe Connect sur un AUTRE user.
  v_dup := v_stripe is not null and exists (
    select 1 from public.users u2
    where u2.id <> p_uid and u2.stripe_account_id = v_stripe
  );

  -- Upsert de la ligne de suivi (sync compteur + jalons).
  insert into public.coach_trial_identity as t
    (user_id, paid_sessions_count, trial_used, first_trial_started_at, trial_completed_at)
  values
    (p_uid, v_count, v_count > 0,
     case when v_count > 0 then now() end,
     case when v_count >= 3 then now() end)
  on conflict (user_id) do update set
    paid_sessions_count    = excluded.paid_sessions_count,
    trial_used             = t.trial_used or excluded.trial_used,
    first_trial_started_at = coalesce(t.first_trial_started_at, excluded.first_trial_started_at),
    trial_completed_at     = coalesce(t.trial_completed_at, excluded.trial_completed_at),
    updated_at             = now();

  select admin_status, reviewed_at into v_status, v_reviewed
  from public.coach_trial_identity where user_id = p_uid;

  -- Auto-détection (seulement si pas de décision humaine).
  if v_reviewed is null then
    if v_dup and v_status = 'trial_allowed' then
      update public.coach_trial_identity
        set admin_status = 'trial_blocked_duplicate', updated_at = now()
      where user_id = p_uid;
      v_status := 'trial_blocked_duplicate';
    elsif not v_dup and v_status = 'trial_blocked_duplicate' then
      -- self-heal : le doublon a disparu (compte supprimé / Stripe changé).
      update public.coach_trial_identity
        set admin_status = 'trial_allowed', updated_at = now()
      where user_id = p_uid;
      v_status := 'trial_allowed';
    end if;
  end if;

  return json_build_object(
    'paid_sessions',  v_count,
    'limit',          3,
    'has_pro',        v_has_pro,
    'trial_eligible', v_status <> 'trial_blocked_duplicate',
    'trial_active',   (v_count < 3) and (v_status <> 'trial_blocked_duplicate'),
    'admin_status',   v_status,
    'can_accept_new', ((v_count < 3) and (v_status <> 'trial_blocked_duplicate')) or v_has_pro
  );
end;
$$;

-- Wrapper pour le coach courant (auth.uid()).
create or replace function public.fn_my_coach_trial_status()
returns json
language sql
volatile
security definer
set search_path = public
as $$
  select public.fn_coach_trial_status(auth.uid());
$$;

-- ── 3. Audit admin des doublons (point 8) ───────────────────────────────────
-- Admin-only. Renvoie les groupes suspects par preuve forte (Stripe) et faible
-- (nom+prénom+région). Téléphone / SIRET / ville : à ajouter quand les colonnes
-- existeront (placeholders documentés).
create or replace function public.fn_admin_coach_duplicates()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_strong json; v_weak json;
begin
  if not exists (select 1 from public.users where id = auth.uid() and role = 'admin') then
    raise exception 'forbidden: admin only';
  end if;

  -- PREUVE FORTE : même stripe_account_id sur plusieurs comptes.
  select coalesce(json_agg(row_to_json(g)), '[]'::json) into v_strong from (
    select stripe_account_id, count(*) as nb,
           array_agg(id) as user_ids, array_agg(email) as emails
    from public.users
    where stripe_account_id is not null and role = 'coach'
    group by stripe_account_id
    having count(*) > 1
  ) g;

  -- PREUVE FAIBLE (review only) : même nom+prénom+région.
  select coalesce(json_agg(row_to_json(g)), '[]'::json) into v_weak from (
    select lower(prenom) as prenom, lower(nom) as nom, region, count(*) as nb,
           array_agg(id) as user_ids
    from public.users
    where role = 'coach'
    group by lower(prenom), lower(nom), region
    having count(*) > 1
  ) g;

  return json_build_object(
    'duplicates_stripe_strong', v_strong,
    'duplicates_name_region_weak', v_weak,
    'note', 'Téléphone / SIRET / ville : non disponibles (colonnes absentes) — à brancher ultérieurement.'
  );
end;
$$;

grant execute on function public.fn_coach_trial_status(uuid)  to authenticated;
grant execute on function public.fn_my_coach_trial_status()   to authenticated;
grant execute on function public.fn_admin_coach_duplicates()  to authenticated;
