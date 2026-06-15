-- ============================================================================
-- 074 — CONCOURS HUB · LOT 1 (fondation découverte)
-- ============================================================================
-- Périmètre : table concours canonique + persistance import CSV (upsert numero_ffe)
--             + concours_id nullable sur les 5 tables d'annonces.
--
-- 100% ADDITIF. Ne touche NI payments, NI reservations, NI escrow, NI triggers
-- Stripe, NI webhooks. concours_id vit sur l'ANNONCE (listing), en amont de la
-- réservation → hors du chemin de paiement → zéro régression escrow.
--
-- Idempotent (IF NOT EXISTS partout). Application : supabase db query -f <file>
-- puis supabase migration repair --status applied 074. JAMAIS db push.
-- ============================================================================

begin;

-- ── 1. Table concours canonique ────────────────────────────────────────────
create table if not exists public.concours (
  id                      uuid primary key default gen_random_uuid(),
  numero_ffe              text,                       -- ← CSV numero_concours (clé d'upsert)
  nom                     text not null,              -- ← CSV nom_concours
  date_debut              date,
  date_fin                date,
  date_cloture            date,
  lieu                    text,
  adresse                 text,
  departement             text,
  type_concours           text,                       -- discipline (CSO/Dressage/…)
  cre                     text,
  organisateur_terrain    text,
  organisateur_financier  text,
  liste_epreuves          text[] default '{}',
  etat                    text,                       -- lifecycle FFE (ré-import réconcilie)
  organisateur_id         uuid references public.profiles(id) on delete set null, -- revendication (lot futur)
  source_import           text default 'csv',
  import_batch_id         text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.concours is
  'LOT1 074 — concours canonique (hub découverte). Source = import CSV admin (upsert numero_ffe). Hors chemin paiement.';

-- ── 2. Index concours ───────────────────────────────────────────────────────
-- Unique partiel : permet ON CONFLICT (numero_ffe) pour l'upsert, tout en
-- tolérant des lignes sans numéro (chaque NULL reste distinct, mais on filtre).
create unique index if not exists ux_concours_numero_ffe
  on public.concours (numero_ffe) where numero_ffe is not null;

create index if not exists idx_concours_date_debut  on public.concours (date_debut);
create index if not exists idx_concours_departement  on public.concours (departement);
create index if not exists idx_concours_etat         on public.concours (etat);
create index if not exists idx_concours_type         on public.concours (type_concours);

-- updated_at auto
create or replace function public.tg_concours_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_concours_touch on public.concours;
create trigger trg_concours_touch
  before update on public.concours
  for each row execute function public.tg_concours_touch_updated_at();

-- ── 3. RLS concours (lecture publique, écriture admin) ──────────────────────
alter table public.concours enable row level security;

drop policy if exists concours_select_all on public.concours;
create policy concours_select_all
  on public.concours for select
  using (true);                                   -- découverte publique (anon + auth)

drop policy if exists concours_insert_admin on public.concours;
create policy concours_insert_admin
  on public.concours for insert
  with check (public.is_admin());                 -- import = admin (service_role bypass RLS)

drop policy if exists concours_update_admin on public.concours;
create policy concours_update_admin
  on public.concours for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists concours_delete_admin on public.concours;
create policy concours_delete_admin
  on public.concours for delete
  using (public.is_admin());

-- ── 4. concours_id nullable sur les 5 tables d'annonces ─────────────────────
-- Colonne nullable + FK ON DELETE SET NULL. Coexiste avec les champs TEXT
-- existants (concours / concours_nom), conservés (aucun backfill obligatoire).
alter table public.box_annonces        add column if not exists concours_id uuid references public.concours(id) on delete set null;
alter table public.transport_annonces  add column if not exists concours_id uuid references public.concours(id) on delete set null;
alter table public.coach_annonces       add column if not exists concours_id uuid references public.concours(id) on delete set null;
alter table public.stages               add column if not exists concours_id uuid references public.concours(id) on delete set null;
alter table public.course_demands       add column if not exists concours_id uuid references public.concours(id) on delete set null;

-- ── 5. Index concours_id (agrégation rapide « N offres par concours ») ──────
create index if not exists idx_box_annonces_concours_id        on public.box_annonces (concours_id);
create index if not exists idx_transport_annonces_concours_id  on public.transport_annonces (concours_id);
create index if not exists idx_coach_annonces_concours_id      on public.coach_annonces (concours_id);
create index if not exists idx_stages_concours_id              on public.stages (concours_id);
create index if not exists idx_course_demands_concours_id      on public.course_demands (concours_id);

commit;

-- ============================================================================
-- NOTE : ce lot N'ENABLE PAS de RLS et NE MODIFIE PAS les politiques des tables
-- d'annonces (elles gardent leurs RLS actuelles). Ajout d'une colonne nullable
-- = aucun changement de comportement de lecture/écriture existant.
-- ============================================================================
