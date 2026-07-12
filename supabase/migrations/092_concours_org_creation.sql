-- ============================================================================
-- 092 — CONCOURS · CRÉATION ORGANISATEUR (PR2-A)
-- ============================================================================
-- Rend la création de concours par un organisateur PERSISTABLE en base (le front
-- écrira désormais dans public.concours au lieu du mock concoursStore, cf. PR2-B).
--
-- Périmètre (100% ADDITIF, non destructif, réversible) :
--   1. Colonnes statut + infos jsonb (champs riches du formulaire).
--   2. FK organisateur_id repointée profiles(id) → users(id) (identité canonique
--      auth.uid()). Sûr : organisateur_id peuplé sur 0/313 concours (rien à migrer).
--   3. Index partiel organisateur_id (liste « mes concours »).
--   4. RLS : insert/update own-row organisateur + SELECT durcie (brouillons masqués
--      au public, visibles owner+admin). default statut='publie' ⇒ 313 FFE visibles.
--   5. fn_org_owns_concours étendue : ownership DIRECT à la création (sans claim).
--
-- HORS PÉRIMÈTRE (non touché) : Stripe, escrow, payments, webhooks, emails, Resend,
--   marketplace. etat/numero_ffe/imports FFE intacts. Policies admin (079) inchangées.
--
-- Application (workflow Equishow) :
--   supabase db query -f supabase/migrations/092_concours_org_creation.sql --linked
--   supabase migration repair --status applied 092 --linked
--   JAMAIS db push.
-- ============================================================================

begin;

-- ── 1. Colonnes statut + infos ──────────────────────────────────────────────
-- statut : cycle de vie org (etat = champ libre FFE, inexploitable comme statut).
-- default 'publie' ⇒ les 313 FFE existantes + tout import futur (INSERT sans statut)
-- restent PUBLIÉS/visibles → 0 régression. L'org crée en 'brouillon' (PR2-B).
alter table public.concours
  add column if not exists statut text not null default 'publie',
  add column if not exists infos  jsonb not null default '{}'::jsonb;

alter table public.concours drop constraint if exists concours_statut_check;
alter table public.concours
  add constraint concours_statut_check check (statut in ('brouillon','publie','archive'));

-- ── 2. FK organisateur_id → users(id) ───────────────────────────────────────
-- Repointage profiles→users : users = identité canonique (auth.uid()). profiles
-- est semi-peuplé (piège FK). 0 ligne concours.organisateur_id peuplée → sûr.
alter table public.concours drop constraint if exists concours_organisateur_id_fkey;
alter table public.concours
  add constraint concours_organisateur_id_fkey
  foreign key (organisateur_id) references public.users(id) on delete set null;

-- ── 3. Index partiel ────────────────────────────────────────────────────────
create index if not exists idx_concours_organisateur_id
  on public.concours(organisateur_id) where organisateur_id is not null;

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
-- INSERT org (own-row). Coexiste avec concours_insert_admin (079) : policies
-- permissives OR'ées → admin ET org peuvent insérer (chacun selon sa règle).
drop policy if exists concours_insert_organisateur on public.concours;
create policy concours_insert_organisateur on public.concours
  for insert to authenticated
  with check (
    organisateur_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'organisateur')
  );

-- UPDATE org (own-row) : édition + publication (brouillon→publie) de SES concours.
drop policy if exists concours_update_organisateur on public.concours;
create policy concours_update_organisateur on public.concours
  for update to authenticated
  using (
    organisateur_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'organisateur')
  )
  with check (
    organisateur_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'organisateur')
  );

-- SELECT durcie : remplace concours_select_all (true). Brouillons masqués au public
-- (et à anon) AU NIVEAU DB ; visibles par le propriétaire + admin. default 'publie'
-- ⇒ les 313 FFE et concours publiés restent lisibles par tous (y compris anon).
drop policy if exists concours_select_all on public.concours;
drop policy if exists concours_select_visible on public.concours;
create policy concours_select_visible on public.concours
  for select using (
    statut = 'publie'
    or organisateur_id = auth.uid()
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- ── 5. Ownership sans claim : fn_org_owns_concours étendue ───────────────────
-- Un concours CRÉÉ par l'org lui appartient directement (sans passer par un claim).
-- PUREMENT ADDITIF (un OR de plus) : aucun droit retiré. Cette fn gouverne le
-- soft-delete des messages LOT2 (082) → couvert par le harness anti-régression.
create or replace function public.fn_org_owns_concours(p_concours_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.concours c
    where c.id = p_concours_id and c.organisateur_id = auth.uid()
  ) or exists (
    select 1 from public.concours_claims
    where concours_id = p_concours_id
      and organisateur_id = auth.uid()
      and status = 'approved'
  ) or exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
  );
$$;

commit;
