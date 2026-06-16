-- ============================================================================
-- 075 — CONCOURS FOLLOWERS · LOT 2A + 2B (capteur de demande, compteur)
-- ============================================================================
-- Périmètre : table concours_followers + compteur dénormalisé concours.followers_count
--             + trigger de maintien + RLS (own only) + index.
--
-- DÉPEND DE 074 (référence public.concours). 100% ADDITIF. Ne touche NI payments,
-- NI reservations, NI escrow, NI Stripe, NI webhooks, NI notifications.
--
-- HORS PÉRIMÈTRE (lots ultérieurs) : type notif concours_offer, cron fan-out,
-- anti-spam, push. Aucune de ces briques n'est créée ici.
--
-- Idempotent. Application : supabase db query -f <file> puis
-- supabase migration repair --status applied 075. JAMAIS db push.
-- ============================================================================

begin;

-- ── 0. Pré-condition : 074 doit être appliquée ──────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'concours'
  ) then
    raise exception '075 requiert 074 : table public.concours absente. Appliquer 074 d''abord.';
  end if;
end $$;

-- ── 1. Table concours_followers (2A) ────────────────────────────────────────
-- PK composite (concours_id, user_id) = contrainte d'unicité native (un user ne
-- suit qu'une fois un concours). user_id → public.users(id) (décision F2).
create table if not exists public.concours_followers (
  concours_id uuid not null references public.concours(id) on delete cascade,
  user_id     uuid not null references public.users(id)    on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (concours_id, user_id)
);

comment on table public.concours_followers is
  'LOT2A 075 — abonnements concours (capteur de demande). user_id → users(id). Hors chemin paiement.';

-- ── 2. Index ────────────────────────────────────────────────────────────────
-- "Mes concours suivis" (côté cavalier). concours_id couvert par préfixe gauche de la PK.
create index if not exists idx_concours_followers_user on public.concours_followers (user_id);

-- ── 3. Compteur dénormalisé (2B) ────────────────────────────────────────────
-- followers_count exposé publiquement via le SELECT public de `concours` (074),
-- SANS exposer l'identité des followers (table en RLS own-only ci-dessous).
alter table public.concours add column if not exists followers_count integer not null default 0;

create or replace function public.tg_concours_followers_count()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.concours set followers_count = followers_count + 1 where id = new.concours_id;
  elsif tg_op = 'DELETE' then
    update public.concours set followers_count = greatest(0, followers_count - 1) where id = old.concours_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_concours_followers_count on public.concours_followers;
create trigger trg_concours_followers_count
  after insert or delete on public.concours_followers
  for each row execute function public.tg_concours_followers_count();

-- ── 4. Resynchro idempotente (sûr même si re-exécuté) ───────────────────────
-- Recalcule le compteur depuis l'état réel des abonnements.
update public.concours c
set followers_count = coalesce((
  select count(*) from public.concours_followers f where f.concours_id = c.id
), 0);

-- ── 5. RLS concours_followers (own only) ────────────────────────────────────
alter table public.concours_followers enable row level security;

drop policy if exists cf_select_own on public.concours_followers;
create policy cf_select_own
  on public.concours_followers for select
  using (user_id = auth.uid());

drop policy if exists cf_insert_own on public.concours_followers;
create policy cf_insert_own
  on public.concours_followers for insert
  with check (user_id = auth.uid());

drop policy if exists cf_delete_own on public.concours_followers;
create policy cf_delete_own
  on public.concours_followers for delete
  using (user_id = auth.uid());
-- Pas d'UPDATE : suivre = INSERT, désuivre = DELETE.

commit;

-- ============================================================================
-- NOTE : le compteur public se lit via concours.followers_count (RLS concours =
-- select public, 074). On ne fait JAMAIS COUNT(*) sur concours_followers en
-- lecture publique (bloqué par la RLS own-only, et fuite d'identité évitée).
-- ============================================================================
