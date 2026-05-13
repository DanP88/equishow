-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 017 — Aligner `box_annonces` + `box_reservations` avec le contrat
-- front (BoxAnnonce + BoxReservation).
--
-- Avant :
--  - box_annonces n'avait que `auteur_nom` (snapshot partiel). Le front affiche
--    aussi pseudo/initiales/couleur — il fallait join sur users à chaque rendu.
--  - box_reservations.status CHECK ne permettait pas `awaiting_payment` (statut
--    intermédiaire entre acceptance et paiement). pending-box-payments.tsx
--    écrivait ce statut, qui aurait été rejeté par la contrainte.
--  - box_reservations sans policy DELETE → annulations bloquées côté client.
--
-- Cette migration : ADD colonnes snapshot, ADD trigger auto-fill, élargit CHECK,
-- ADD policy DELETE (gabarit P22 transport).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. box_annonces : colonnes snapshot auteur ─────────────────────────────
alter table public.box_annonces
  add column if not exists auteur_pseudo      text,
  add column if not exists auteur_initiales   text,
  add column if not exists auteur_couleur     text;

-- ── 2. Trigger auto-fill snapshot auteur (gabarit avis/notif/transport) ────
create or replace function public.fill_box_annonce_author_fields()
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
  if new.auteur_id is null then
    return new;
  end if;

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

drop trigger if exists trg_box_annonces_fill_author on public.box_annonces;
create trigger trg_box_annonces_fill_author
  before insert on public.box_annonces
  for each row execute function public.fill_box_annonce_author_fields();

-- ── 3. box_reservations.status : ajouter 'awaiting_payment' ────────────────
alter table public.box_reservations
  drop constraint if exists box_reservations_status_check;

alter table public.box_reservations
  add constraint box_reservations_status_check
  check (status in ('pending','accepted','rejected','awaiting_payment','paid','completed','cancelled'));

-- ── 4. Policy DELETE manquante (gabarit transport) ──────────────────────────
drop policy if exists "box_reservations_delete_parties" on public.box_reservations;
create policy "box_reservations_delete_parties"
  on public.box_reservations
  for delete to authenticated
  using (seller_id = auth.uid() or buyer_id = auth.uid());

-- ── 5. Index supplémentaire (perf marketplace) ─────────────────────────────
create index if not exists idx_box_annonces_date_debut
  on public.box_annonces(date_debut desc);
