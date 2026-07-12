-- ============================================================================
-- 089 — CONCOURS PRESENCE · PR2a (présence déclarée + hero "X que je connais")
-- ============================================================================
-- Périmètre : table concours_presence (présence DÉCLARÉE) + RLS own-only write
--   + RPC fn_concours_known_attendees (intersection présence × fn_people_i_know).
--
-- DÉPEND DE 074 (public.concours) + 088 (public.fn_people_i_know). 100% ADDITIF.
-- Ne touche NI payments, NI escrow, NI Stripe, NI webhooks, NI reservations,
-- NI notifications (PR2b), NI analytics.
--
-- HORS PÉRIMÈTRE (lots ultérieurs) : notif de présence (PR2b), détection FFE
-- (source='ffe'), publication organisateur (source='organizer'), pont
-- marketplace. La colonne `source` est prévue dès maintenant pour basculer
-- sans refonte, mais seul 'declared' est écrit en PR2a.
--
-- Idempotent. Application : supabase db query -f <file> --linked
--   puis supabase migration repair --status applied 089. JAMAIS db push.
-- Rollback : 089_concours_presence_rollback.sql
-- ============================================================================

begin;

-- ── 0. Pré-conditions : 074 (concours) + 088 (fn_people_i_know) ──────────────
do $$
begin
  if to_regclass('public.concours') is null then
    raise exception '089 requiert 074 : table public.concours absente.';
  end if;
  if not exists (select 1 from pg_proc where proname = 'fn_people_i_know') then
    raise exception '089 requiert 088 : fonction public.fn_people_i_know absente.';
  end if;
end $$;

-- ── 1. Table concours_presence ──────────────────────────────────────────────
-- PK (concours_id, user_id) = un user déclare une fois sa présence par concours.
-- cheval_id NULLABLE (présence valide sans cheval). source futur-proof.
create table if not exists public.concours_presence (
  concours_id uuid not null references public.concours(id) on delete cascade,
  user_id     uuid not null references public.users(id)    on delete cascade,
  status      text not null default 'going'
              check (status in ('interested','going')),
  cheval_id   uuid references public.chevaux(id) on delete set null,
  source      text not null default 'declared'
              check (source in ('declared','ffe','organizer')),
  created_at  timestamptz not null default now(),
  primary key (concours_id, user_id)
);

comment on table public.concours_presence is
  '089 PR2a — présence à un concours. PR2a = source=declared uniquement. '
  'Hors chemin paiement. cheval_id nullable.';

-- ── 2. Index ────────────────────────────────────────────────────────────────
-- "Mes concours où je serai" (côté user). Le filtre par concours_id est couvert
-- par le préfixe gauche de la PK (pas d'index dédié nécessaire).
create index if not exists idx_concours_presence_user
  on public.concours_presence (user_id);

-- ── 3. RLS (écriture own-only, lecture authenticated) ───────────────────────
alter table public.concours_presence enable row level security;

drop policy if exists cp_select_auth on public.concours_presence;
create policy cp_select_auth
  on public.concours_presence for select
  to authenticated
  using (true);

drop policy if exists cp_insert_own on public.concours_presence;
create policy cp_insert_own
  on public.concours_presence for insert
  to authenticated
  with check (user_id = auth.uid());

-- UPDATE own : permet d'attacher/changer le cheval ou le status sur SA présence
-- (utilisé par l'upsert front). Jamais celle d'autrui.
drop policy if exists cp_update_own on public.concours_presence;
create policy cp_update_own
  on public.concours_presence for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists cp_delete_own on public.concours_presence;
create policy cp_delete_own
  on public.concours_presence for delete
  to authenticated
  using (user_id = auth.uid());

-- ── 4. RPC fn_concours_known_attendees(p_concours_id, viewer) ───────────────
-- Read-only. Personnes que le VIEWER connaît (via fn_people_i_know 088) ET
-- présentes sur ce concours, enrichies (avatar/nom/relation/cheval/status).
-- N'expose que des champs publics (ni email, ni donnée sensible).
--
-- SÉCURITÉ : SECURITY DEFINER (lecture de tables RLS pour reconstituer
-- l'intersection), MAIS anti-énumération : viewer = auth.uid() (sauf admin).
-- Inactif en service_role/harness (auth.uid() NULL). fn_people_i_know applique
-- la MÊME garde en interne. Ne lit JAMAIS payments.
create or replace function public.fn_concours_known_attendees(
  p_concours_id uuid,
  viewer uuid
)
returns table (
  user_id      uuid,
  prenom       text,
  pseudo       text,
  initiales    text,
  avatar_color text,
  role         text,
  relation     text,
  cheval_id    uuid,
  cheval_nom   text,
  status       text
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if viewer is null or p_concours_id is null then
    return;
  end if;

  if auth.uid() is not null
     and viewer <> auth.uid()
     and not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  then
    raise exception 'fn_concours_known_attendees: viewer doit être auth.uid()';
  end if;

  return query
  select
    cp.user_id,
    u.prenom,
    u.pseudo,
    u.initiales,
    u.avatar_color,
    u.role,
    k.relation,
    cp.cheval_id,
    ch.nom as cheval_nom,
    cp.status
  from public.concours_presence cp
  join public.fn_people_i_know(viewer) k on k.user_id = cp.user_id
  join public.users u                     on u.id      = cp.user_id
  left join public.chevaux ch             on ch.id     = cp.cheval_id
  where cp.concours_id = p_concours_id
    and cp.user_id <> viewer
  order by
    case k.relation
      when 'following' then 1
      when 'club'      then 2
      when 'messaged'  then 3
      when 'booked'    then 4
      else 5
    end,
    u.prenom nulls last;
end;
$fn$;

comment on function public.fn_concours_known_attendees(uuid, uuid) is
  '089 PR2a — intersection présence concours × fn_people_i_know(viewer). '
  'Champs publics only. Anti-énumération viewer=auth.uid() (sauf admin). '
  'Ne lit jamais payments.';

grant execute on function public.fn_concours_known_attendees(uuid, uuid) to authenticated;

commit;

-- ============================================================================
-- NOTE : compteur "X présents" se déduit côté front du nombre de lignes rendues
-- (pas de colonne dénormalisée). Le "total présents" public (tous, pas que mes
-- relations) n'est PAS exposé en PR2a (évite toute fuite ; hero = mes relations).
-- ============================================================================
