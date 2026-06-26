-- ============================================================================
-- 084 — CONCOURS CATÉGORIES (enrichissement découverte)
-- ============================================================================
-- Périmètre : table enfant concours_categories (1 ligne = 1 catégorie d'un
--             concours) + vue de comptage read-only. Alimentée par l'import CSV
--             FFE (colonne « categories », découpée/dédupliquée côté client).
--
-- 100% ADDITIF. Table ENFANT isolée : ne touche NI concours (colonnes), NI
-- payments, NI reservations, NI escrow, NI followers, NI discussions, NI RLS
-- existantes. Le Hub Concours continue de fonctionner à l'identique.
--
-- Clé de jointure = concours.id (uuid). On NE référence PAS numero_ffe : son
-- index unique est PARTIEL (where numero_ffe is not null) → inéligible comme
-- cible de FK en Postgres. concours.id donne en prime ON DELETE CASCADE.
--
-- Idempotent (IF NOT EXISTS). Application : supabase db query -f <file>
-- puis supabase migration repair --status applied 084. JAMAIS db push.
-- ============================================================================

begin;

-- ── 1. Table concours_categories ───────────────────────────────────────────
create table if not exists public.concours_categories (
  id           uuid primary key default gen_random_uuid(),
  concours_id  uuid not null references public.concours(id) on delete cascade,
  categorie    text not null,
  created_at   timestamptz not null default now(),
  -- ré-import idempotent + dédoublonnage au niveau base (en plus du client).
  constraint uq_concours_categorie unique (concours_id, categorie)
);

comment on table public.concours_categories is
  '084 — catégories FFE d''un concours (1 ligne = 1 catégorie). Source = import CSV. Hors chemin paiement. FK concours(id) ON DELETE CASCADE.';

-- ── 2. Index ────────────────────────────────────────────────────────────────
-- categorie : filtre / recherche / comptage « N concours proposant X ».
-- (concours_id est déjà couvert par le leftmost de uq_concours_categorie.)
create index if not exists idx_cc_categorie
  on public.concours_categories (categorie);

-- ── 3. RLS (miroir de concours : lecture publique, écriture admin) ──────────
alter table public.concours_categories enable row level security;

drop policy if exists cc_select_all on public.concours_categories;
create policy cc_select_all
  on public.concours_categories for select
  using (true);                                   -- découverte publique

drop policy if exists cc_insert_admin on public.concours_categories;
create policy cc_insert_admin
  on public.concours_categories for insert
  with check (public.is_admin());                 -- import = admin (service_role bypass)

drop policy if exists cc_update_admin on public.concours_categories;
create policy cc_update_admin
  on public.concours_categories for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists cc_delete_admin on public.concours_categories;
create policy cc_delete_admin
  on public.concours_categories for delete
  using (public.is_admin());

-- ── 4. Vue de comptage read-only (« combien de concours par catégorie ») ────
-- security_invoker : la vue s'exécute avec les droits de l'appelant → la RLS
-- de concours_categories (select public) s'applique. Pattern analytics maison.
create or replace view public.v_concours_categories_counts
  with (security_invoker = true) as
  select categorie, count(distinct concours_id)::int as nb_concours
  from public.concours_categories
  group by categorie
  order by nb_concours desc, categorie asc;

comment on view public.v_concours_categories_counts is
  '084 — nb de concours distincts proposant chaque catégorie (read-only, security_invoker).';

commit;

-- ============================================================================
-- NOTE : aucune RLS d'une table existante n'est modifiée. Ajout d'une table
-- enfant + d'une vue = aucun changement de comportement des écrans actuels.
-- ============================================================================
