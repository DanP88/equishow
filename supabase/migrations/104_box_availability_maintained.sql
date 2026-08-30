-- ============================================================================
-- 104 — DISPONIBILITÉ BOX RÉELLEMENT MAINTENUE (DB-1)
-- ============================================================================
-- PROBLÈME : `box_annonces.nb_boxes_disponibles` n'était maintenu par RIEN.
--   - `fn_availability_box` ne faisait qu'un CONTRÔLE de capacité (raise si
--     dépassement), aucune écriture de la colonne.
--   - L'app ne décrémente pas non plus.
--   Résultat : une box réservée reste affichée « disponible » (fiche concours,
--   liste Services). Le Transport, lui, est correct (`fn_availability_transport`
--   décrémente / restitue).
--
-- SOLUTION : `nb_boxes_disponibles` devient une valeur DÉRIVÉE, recalculée par
--   une fonction unique à partir de `box_reservations` :
--       nb_boxes_disponibles = greatest(nb_boxes - count(réservations consommantes), 0)
--   - déclenchée sur tout changement de statut / insertion / suppression d'une
--     réservation (`trg_box_dispo_sync`, AFTER)
--   - et sur tout changement de capacité `nb_boxes` de l'annonce
--     (`trg_box_annonce_dispo`, BEFORE)
--   Le CONTRÔLE anti-dépassement reste dans `fn_availability_box` (BEFORE).
--
-- ⚠️ CHANGEMENT DE COMPORTEMENT : le contrôle passe d'un chevauchement de dates
--   (daterange) à un COMPTEUR PLAT (N box physiques = N réservations max, quelles
--   que soient les dates). C'est le modèle attendu (cf. formulaire proposer-box,
--   champ « nombre de box »). Une box ne peut donc plus être réservée deux fois
--   sur des périodes disjointes.
--
-- Ensemble consommant S = {accepted, awaiting_payment, paid, completed}
--   (identique à fn_availability_transport / fn_availability_stage).
--
-- 100 % ADDITIF sauf remplacement de fn_availability_box (CREATE OR REPLACE).
-- Ne touche NI payments, NI escrow, NI RLS, NI webhooks.
-- Application : supabase db query -f supabase/migrations/104_box_availability_maintained.sql --linked
--               puis supabase migration repair --status applied 104. JAMAIS db push.
-- ============================================================================

begin;

-- ── 1. Fonction unique de recalcul de la disponibilité d'une annonce ────────
create or replace function public.fn_box_sync_dispo(p_box_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.box_annonces a
     set nb_boxes_disponibles = greatest(
           a.nb_boxes - (
             select count(*)
               from public.box_reservations r
              where r.box_id = a.id
                and r.status = any (array['accepted','awaiting_payment','paid','completed'])
           ),
           0)
   where a.id = p_box_id;
$$;

comment on function public.fn_box_sync_dispo(uuid) is
  '104 DB-1 — recalcule box_annonces.nb_boxes_disponibles = nb_boxes - count(réservations consommantes).';

-- ── 2. Contrôle anti-dépassement (BEFORE) — plus d''écriture de colonne ─────
create or replace function public.fn_availability_box()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cap   int;
  v_count int;
  c_consuming constant text[] := array['accepted','awaiting_payment','paid','completed'];
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at := now();
  end if;

  -- Première entrée dans l'ensemble consommant → vérifier la capacité.
  -- (INSERT direct en statut consommant OU transition pending→accepted/…)
  if (old.status is null or not (old.status = any(c_consuming)))
     and (new.status = any(c_consuming)) then
    -- Verrou de l'annonce : sérialise les acceptations concurrentes.
    select nb_boxes into v_cap
      from public.box_annonces
     where id = new.box_id
     for update;

    select count(*) into v_count
      from public.box_reservations r
     where r.box_id = new.box_id
       and r.id <> new.id
       and r.status = any (c_consuming);

    if v_count + 1 > coalesce(v_cap, 0) then
      raise exception 'box_capacite_insuffisante (annonce=%, consommantes=%, capacite=%)',
        new.box_id, v_count + 1, v_cap
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_zz_availability_box on public.box_reservations;
create trigger trg_zz_availability_box
  before insert or update of status on public.box_reservations
  for each row execute function public.fn_availability_box();

-- ── 3. Sync AFTER sur box_reservations (insert / changement statut / delete) ─
create or replace function public.fn_box_reservation_sync_dispo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    perform public.fn_box_sync_dispo(old.box_id);
    return old;
  end if;
  perform public.fn_box_sync_dispo(new.box_id);
  if tg_op = 'UPDATE' and new.box_id is distinct from old.box_id then
    perform public.fn_box_sync_dispo(old.box_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_box_dispo_sync on public.box_reservations;
create trigger trg_box_dispo_sync
  after insert or update of status or delete on public.box_reservations
  for each row execute function public.fn_box_reservation_sync_dispo();

-- ── 4. Sync BEFORE sur box_annonces (création annonce / changement capacité) ─
create or replace function public.fn_box_annonce_sync_dispo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.nb_boxes_disponibles := greatest(
    coalesce(new.nb_boxes, 0) - (
      select count(*)
        from public.box_reservations r
       where r.box_id = new.id
         and r.status = any (array['accepted','awaiting_payment','paid','completed'])
    ),
    0);
  return new;
end;
$$;

drop trigger if exists trg_box_annonce_dispo on public.box_annonces;
create trigger trg_box_annonce_dispo
  before insert or update of nb_boxes on public.box_annonces
  for each row execute function public.fn_box_annonce_sync_dispo();

-- ── 5. Backfill : recalcule TOUTES les annonces existantes ─────────────────
update public.box_annonces a
   set nb_boxes_disponibles = greatest(
         a.nb_boxes - (
           select count(*)
             from public.box_reservations r
            where r.box_id = a.id
              and r.status = any (array['accepted','awaiting_payment','paid','completed'])
         ),
         0);

commit;

-- ============================================================================
-- Effet backfill attendu sur les données actuelles :
--   ce5a0000-…b1 (Fontainebleau, cap 1, 1 completed)  1 → 0
--   ce5a0000-…b2 (Saumur,        cap 1, 1 paid)        1 → 0
--   ce5a0000-…b3 (La Baule,      cap 1, 1 accepted)    1 → 0   ← fiche concours Box = 0
--   b0000000-…dea1 (Deauville,   cap 4, 1 completed)   4 → 3
--   autres : inchangées (0 réservation consommante)
-- ============================================================================
