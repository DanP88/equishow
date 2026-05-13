-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 016 — Aligner `transport_annonces` + `transport_reservations`
-- avec le contrat front-end (TransportAnnonce + TransportReservation).
--
-- Avant cette migration :
--  - transport_annonces n'avait pas de snapshot auteur (incohérent avec
--    avis/notifications/box) → impossible d'afficher l'annonce hors-ligne sans
--    relancer un join `users`.
--  - transport_annonces.dates_disponibles (location de van) inexistant.
--  - transport_reservations n'avait pas de policy DELETE → suppression
--    impossible côté client (RLS bloque), même pour les parties.
--
-- Cette migration :
--  - ADD auteur_nom/pseudo/initiales/couleur + trigger auto-fill (gabarit P20/P25).
--  - ADD dates_disponibles date[].
--  - ADD DELETE policy sur transport_reservations (seller OR buyer).
--  - Aligne le FK transport_annonces.auteur_id sur public.users (était profiles).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. transport_annonces : colonnes snapshot auteur + dates_disponibles ────
alter table public.transport_annonces
  add column if not exists auteur_nom         text,
  add column if not exists auteur_pseudo      text,
  add column if not exists auteur_initiales   text,
  add column if not exists auteur_couleur     text,
  add column if not exists adresse_arrivee    text,
  add column if not exists dates_disponibles  date[] not null default '{}'::date[];

-- ── 2. FK auteur_id → public.users (était profiles, legacy) ────────────────
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'transport_annonces_auteur_id_fkey'
      and table_name = 'transport_annonces'
  ) then
    alter table public.transport_annonces
      drop constraint transport_annonces_auteur_id_fkey;
  end if;
end$$;

-- Nettoyer les éventuelles lignes orphelines (auteur_id sans correspondance
-- dans public.users) AVANT de poser la FK stricte.
delete from public.transport_annonces
  where auteur_id is not null
    and auteur_id not in (select id from public.users);

alter table public.transport_annonces
  add constraint transport_annonces_auteur_id_fkey
  foreign key (auteur_id) references public.users(id) on delete cascade;

-- ── 3. Trigger auto-fill snapshot auteur (gabarit avis / notifications) ────
create or replace function public.fill_transport_annonce_author_fields()
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

drop trigger if exists trg_transport_annonces_fill_author on public.transport_annonces;
create trigger trg_transport_annonces_fill_author
  before insert on public.transport_annonces
  for each row execute function public.fill_transport_annonce_author_fields();

-- ── 4. transport_reservations : policy DELETE (seller OU buyer) ────────────
drop policy if exists "transport_reservations_delete_parties" on public.transport_reservations;
create policy "transport_reservations_delete_parties"
  on public.transport_reservations
  for delete to authenticated
  using (seller_id = auth.uid() or buyer_id = auth.uid());

-- ── 5. Index supplémentaires (perf marketplace) ────────────────────────────
create index if not exists idx_transport_annonces_date_trajet
  on public.transport_annonces(date_trajet desc);

create index if not exists idx_transport_reservations_buyer
  on public.transport_reservations(buyer_id);

create index if not exists idx_transport_reservations_seller
  on public.transport_reservations(seller_id);

create index if not exists idx_transport_reservations_transport
  on public.transport_reservations(transport_id);
