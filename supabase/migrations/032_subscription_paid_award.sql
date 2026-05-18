-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 032 — +50 pts à la souscription d'un plan payant
--
-- Non destructif : INSERT into points_config + nouveau trigger uniquement.
-- Idempotent : ref_id = plan_id → un même plan_id n'octroie le bonus qu'1x.
--             (renouvellement = pas de bonus supplémentaire, c'est l'intention)
--
-- Comportement :
--   - user passe d'un plan gratuit/null à un plan payant → +50
--   - user change pour un AUTRE plan payant non encore récompensé → +50
--   - user reste sur le même plan payant → 0
--   - user repasse au gratuit puis re-souscrit le même plan → 0
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Nouveau kind : subscription_paid ────────────────────────────────────────
insert into public.points_config (kind, points, description) values
  ('subscription_paid', 50, 'Souscription à un abonnement payant')
on conflict (kind) do nothing;

-- ── Helper : un plan_id est-il payant ? ─────────────────────────────────────
-- "gratuit" / null / "decouverte" / "cavalier-decouverte" → gratuit
-- tout le reste → payant
create or replace function public.fn_is_paid_plan(p text) returns boolean
language sql
immutable
as $$
  select case
    when p is null then false
    when lower(p) in ('gratuit', 'free', 'decouverte', 'découverte', 'cavalier-decouverte') then false
    else true
  end;
$$;

-- ── Trigger : award sur changement plan_id ──────────────────────────────────
create or replace function public.trg_subscription_paid() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.fn_is_paid_plan(new.plan_id)
     and (old.plan_id is null or new.plan_id is distinct from old.plan_id)
  then
    perform public.fn_award_points(
      new.id, 'subscription_paid', 'users', new.plan_id, null
    );
  end if;
  return null;
end $$;

drop trigger if exists trg_subscription_paid on public.users;
create trigger trg_subscription_paid
  after update of plan_id on public.users
  for each row when (new.plan_id is distinct from old.plan_id)
  execute function public.trg_subscription_paid();

-- Couvre aussi le cas INSERT : un user créé directement avec un plan payant
-- (peu probable, mais robuste).
create or replace function public.trg_subscription_paid_insert() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.fn_is_paid_plan(new.plan_id) then
    perform public.fn_award_points(
      new.id, 'subscription_paid', 'users', new.plan_id, null
    );
  end if;
  return null;
end $$;

drop trigger if exists trg_subscription_paid_insert on public.users;
create trigger trg_subscription_paid_insert
  after insert on public.users
  for each row execute function public.trg_subscription_paid_insert();
