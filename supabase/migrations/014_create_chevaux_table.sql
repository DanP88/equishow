-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 014 — Table `chevaux`
--
-- Avant cette migration, `chevauxStore` (mock in-memory) gérait les chevaux :
-- - aucun check ownership sur edit/delete (any user could edit any horse via route id)
-- - aucune persistance, perdu au reload
-- - ids `Date.now()` (collision + prédictible)
--
-- Cette migration crée la table + RLS strict + ownership defense-in-depth.
-- Champs imbriqués (sante, gestion, concours) stockés en JSONB pour souplesse
-- côté front sans schéma DB rigide.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.chevaux (
  id                          uuid primary key default gen_random_uuid(),
  proprietaire_id             uuid not null references public.users(id) on delete cascade,
  nom                         text not null,
  type                        text not null default 'cheval'
                                check (type in ('cheval','poney')),
  race                        text,
  robe                        text,
  annee_naissance             integer,
  photo_url                   text,
  photo_color                 text,
  sexe                        text,
  taille                      text,
  numero_sire                 text,
  temperament                 text[] not null default '{}'::text[],
  comportement_transport      text,
  habitudes                   text,
  sociabilite                 text,
  particularites_physiques    text,
  disciplines                 text[] not null default '{}'::text[],
  niveau_pratique             text,
  niveau_travail              text,
  frequence_travail           text,
  objectifs                   text,
  sante                       jsonb not null default '{}'::jsonb,
  gestion                     jsonb not null default '{}'::jsonb,
  concours                    jsonb not null default '[]'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists idx_chevaux_proprietaire on public.chevaux(proprietaire_id);

alter table public.chevaux enable row level security;

-- SELECT : tout authentifié peut voir (marketplace transparency — coach voit
-- le cheval qu'il va monter, organisateur voit cheval inscrit à un concours).
create policy "chevaux_select_authenticated" on public.chevaux
  for select to authenticated using (true);

-- INSERT/UPDATE/DELETE : seul le propriétaire (defense-in-depth IDOR).
create policy "chevaux_insert_own" on public.chevaux
  for insert to authenticated with check (proprietaire_id = auth.uid());

create policy "chevaux_update_own" on public.chevaux
  for update to authenticated
  using (proprietaire_id = auth.uid())
  with check (proprietaire_id = auth.uid());

create policy "chevaux_delete_own" on public.chevaux
  for delete to authenticated using (proprietaire_id = auth.uid());

create trigger trg_chevaux_updated_at
  before update on public.chevaux
  for each row execute function public.set_updated_at();
