-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 013 — Table `avis` (système d'avis 1-5 étoiles)
--
-- Avant cette migration, useAvis.ts écrivait dans un store mock in-memory.
-- → 0 persistance, multi-vote possible, self-review possible, IDOR sur delete.
--
-- Cette migration crée la table + RLS + contraintes anti-abus + trigger
-- auto-fill des champs auteur (snapshot, cohérent avec box_reservations).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.avis (
  id                  uuid primary key default gen_random_uuid(),
  auteur_id           uuid not null references public.users(id) on delete cascade,
  auteur_nom          text,
  auteur_pseudo       text,
  auteur_initiales    text,
  auteur_couleur      text,
  destinataire_id     uuid not null references public.users(id) on delete cascade,
  note                integer not null check (note between 1 and 5),
  commentaire         text,
  type                text check (type in ('coach','transport','box','stage')),
  ref_id              uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint avis_no_self_review check (auteur_id <> destinataire_id),
  unique (auteur_id, destinataire_id, ref_id)
);

-- Empêche multi-vote général (sans ref_id) entre les mêmes utilisateurs.
-- (UNIQUE plus haut autorise plusieurs NULL : il faut un index partiel.)
create unique index if not exists avis_unique_general
  on public.avis (auteur_id, destinataire_id)
  where ref_id is null;

create index if not exists idx_avis_destinataire on public.avis(destinataire_id);
create index if not exists idx_avis_auteur       on public.avis(auteur_id);
create index if not exists idx_avis_created      on public.avis(created_at desc);

alter table public.avis enable row level security;

-- Lecture publique (marketplace transparency : tout authentifié voit avis)
create policy "avis_select_authenticated" on public.avis
  for select to authenticated using (true);

-- Insert : seul l'auteur peut écrire son avis
create policy "avis_insert_own" on public.avis
  for insert to authenticated with check (auteur_id = auth.uid());

-- Update : seul l'auteur peut éditer son avis
create policy "avis_update_own" on public.avis
  for update to authenticated using (auteur_id = auth.uid());

-- Delete : seul l'auteur peut supprimer son avis
create policy "avis_delete_own" on public.avis
  for delete to authenticated using (auteur_id = auth.uid());

create trigger trg_avis_updated_at
  before update on public.avis
  for each row execute function public.set_updated_at();

-- ── Auto-fill des champs auteur depuis public.users (snapshot) ──────────────
create or replace function public.fill_avis_author_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prenom    text;
  v_nom       text;
  v_pseudo    text;
  v_initiales text;
  v_couleur   text;
begin
  select prenom, nom, pseudo, initiales, avatar_color
    into v_prenom, v_nom, v_pseudo, v_initiales, v_couleur
  from public.users
  where id = new.auteur_id;

  if v_prenom is null and v_nom is null then
    raise exception 'auteur_id % introuvable dans public.users', new.auteur_id;
  end if;

  new.auteur_nom       := coalesce(new.auteur_nom,
                                   trim(coalesce(v_prenom, '') || ' ' || coalesce(v_nom, '')));
  new.auteur_pseudo    := coalesce(new.auteur_pseudo, v_pseudo);
  new.auteur_initiales := coalesce(new.auteur_initiales, v_initiales);
  new.auteur_couleur   := coalesce(new.auteur_couleur, v_couleur);
  return new;
end;
$$;

drop trigger if exists trg_avis_fill_author on public.avis;
create trigger trg_avis_fill_author
  before insert on public.avis
  for each row execute function public.fill_avis_author_fields();
