-- ============================================================================
-- 104 — DISPONIBILITÉ BOX : DATE-AWARE, basée sur le PIC DE CONCURRENCE (DB-1 v3)
-- ============================================================================
-- CONTEXTE
--   `box_annonces.nb_boxes_disponibles` n'était maintenu par RIEN.
--   Le contrôle `fn_availability_box` (et une v2 de cette migration) utilisait
--   `count(réservations qui CHEVAUCHENT la période demandée)` — INCORRECT pour
--   nb_boxes > 1 : deux réservations disjointes entre elles mais qui chevauchent
--   toutes deux la période demandée étaient comptées 2 fois.
--
--   Exemple (cap 3) : A[01-03], B[05-07] disjointes ; demande [01-07]
--     count(chevauchant [01-07]) = 2  → dispo = 1   ❌
--     réalité : jamais plus de 1 box occupée simultanément sur [01-07]
--               → dispo = 3 - 1 = 2                  ✅
--
-- FORMULE UNIQUE (prouvée) — cf. bas du fichier
--   available(box, start, end) = greatest(nb_boxes - peak(box, start, end), 0)
--   peut_accepter(nouvelle résa)  ⟺  peak(existantes ∖ self, [ns,ne]) + 1 <= nb_boxes
--   nb_boxes_disponibles          = available(box, greatest(today, date_debut), date_fin)
--
--   où peak(box, from, to) = max, sur t ∈ {from} ∪ {débuts de réservation S dans
--   [from,to]}, du nombre de réservations S dont la période '[]' contient t.
--
-- MODÈLE
--   box_annonces.date_debut/date_fin = timestamptz ; box_reservations = date.
--   box_reservations : 1 ligne = 1 box. Chevauchement inclusif '[]'.
--   S = {accepted, awaiting_payment, paid, completed}  ('completed' conservé).
--
-- CE QUE FAIT LA MIGRATION
--   1. fn_box_peak_concurrency(box, from, to, exclude?)  → PRIMITIVE commune
--   2. fn_box_available(box, start, end)                 = nb_boxes - peak (source de vérité)
--   3. fn_availability_box                               = peak(∖self) + 1 > nb_boxes → RAISE
--                                                          (BEFORE INSERT OR UPDATE OF status,
--                                                           verrou FOR UPDATE conservé)
--   4. nb_boxes_disponibles                              = available(fenêtre restante) ; 0 si passée
--                                                          → triggers box_reservations + box_annonces
--   5. Réduire nb_boxes sous le pic → REFUSÉ
--   6. RPC fiche concours DATE-AWARE (annonces + boxes ; le front utilise `annonces`)
--   7. Backfill
--
-- 100 % ADDITIF sauf CREATE OR REPLACE de fn_availability_box. Ne touche NI
-- payments, NI escrow, NI RLS, NI webhooks.
-- Application : db query -f supabase/migrations/104_box_availability_maintained.sql --linked
--               puis migration repair --status applied 104. JAMAIS db push.
-- ============================================================================

begin;

-- ── 1. PRIMITIVE : pic de concurrence sur une fenêtre ─────────────────────
-- Le pic de réservations S simultanées sur [from,to] est atteint à un DÉBUT de
-- réservation (ou au début de la fenêtre). p_exclude_id : réservation à ignorer
-- (la ligne en cours d'acceptation).
create or replace function public.fn_box_peak_concurrency(
  p_box_id uuid, p_from date, p_to date, p_exclude_id uuid default null)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when p_from is null or p_to is null or p_from > p_to then 0
    else coalesce((
      select max(cnt) from (
        select (
          select count(*)
            from public.box_reservations r2
           where r2.box_id = p_box_id
             and (p_exclude_id is null or r2.id <> p_exclude_id)
             and r2.status = any (array['accepted','awaiting_payment','paid','completed'])
             and daterange(r2.date_debut, r2.date_fin, '[]') @> pts.d
        ) as cnt
        from (
          select p_from as d
          union
          select r1.date_debut
            from public.box_reservations r1
           where r1.box_id = p_box_id
             and (p_exclude_id is null or r1.id <> p_exclude_id)
             and r1.status = any (array['accepted','awaiting_payment','paid','completed'])
             and r1.date_debut between p_from and p_to
        ) pts
      ) s
    ), 0)
  end;
$$;

comment on function public.fn_box_peak_concurrency(uuid, date, date, uuid) is
  '104 — max de réservations consommantes simultanées sur [from,to] (primitive commune).';

-- ── 2. Disponibilité pour une PÉRIODE PRÉCISE (source de vérité) ──────────
-- = nb de réservations [start,end] supplémentaires acceptables (chacune ajoute
--   +1 à la concurrence sur toute la période) = nb_boxes - peak(start,end).
create or replace function public.fn_box_available(p_box_id uuid, p_start date, p_end date)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select greatest(
    coalesce((select nb_boxes from public.box_annonces where id = p_box_id), 0)
    - public.fn_box_peak_concurrency(
        p_box_id,
        coalesce(p_start, '-infinity'::date),
        coalesce(p_end,   'infinity'::date)),
    0);
$$;

comment on function public.fn_box_available(uuid, date, date) is
  '104 — nb de box libres pour une réservation couvrant TOUTE la période [start,end] = nb_boxes - pic.';

-- ── 3. Indicateur général nb_boxes_disponibles ──────────────────────────
create or replace function public.fn_box_dispo_value(p_box_id uuid)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when a.date_fin::date < current_date then 0            -- annonce passée
    else public.fn_box_available(a.id,
           greatest(current_date, a.date_debut::date),
           a.date_fin::date)
  end
  from public.box_annonces a
  where a.id = p_box_id;
$$;

create or replace function public.fn_box_sync_dispo(p_box_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.box_annonces
     set nb_boxes_disponibles = public.fn_box_dispo_value(p_box_id)
   where id = p_box_id;
$$;

-- ── 4. Contrôle anti-dépassement (BEFORE INSERT OR UPDATE OF status) ─────
-- peut_accepter ⟺ peak(existantes ∖ self, [ns,ne]) + 1 <= nb_boxes
create or replace function public.fn_availability_box()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cap  int;
  v_peak int;
  c_consuming constant text[] := array['accepted','awaiting_payment','paid','completed'];
  v_old_status text := (case when tg_op = 'INSERT' then null else old.status end);
begin
  if new.status = 'accepted' and v_old_status is distinct from 'accepted' then
    new.accepted_at := now();
  end if;

  -- Première entrée dans l'ensemble consommant (INSERT direct en S, ou
  -- pending→accepted/awaiting_payment/paid).
  if (v_old_status is null or not (v_old_status = any(c_consuming)))
     and (new.status = any(c_consuming)) then
    -- Verrou de l'annonce : sérialise les acceptations concurrentes sur cette box.
    -- En READ COMMITTED, l'instruction suivante (calcul du pic) prend un nouveau
    -- snapshot APRÈS la libération du verrou → voit la réservation concurrente
    -- déjà committée. Impossible de dépasser la capacité à deux.
    select nb_boxes into v_cap
      from public.box_annonces
     where id = new.box_id
     for update;

    v_peak := public.fn_box_peak_concurrency(
      new.box_id, new.date_debut, new.date_fin, new.id);

    if v_peak + 1 > coalesce(v_cap, 0) then
      raise exception 'box_conflit_periode (box=%, pic_existant=%, capacite=%)',
        new.box_id, v_peak, v_cap
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

-- ── 5. Sync AFTER sur box_reservations ─────────────────────────────────
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

-- ── 6. box_annonces : garde anti-réduction + maj compteur ──────────────
create or replace function public.fn_box_annonce_guard_dispo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_peak int;
begin
  v_peak := public.fn_box_peak_concurrency(
    new.id,
    greatest(current_date, new.date_debut::date),
    new.date_fin::date);

  -- Réduire la capacité sous le pic de réservations concurrentes = impossible.
  if tg_op = 'UPDATE'
     and coalesce(new.nb_boxes, 0) < coalesce(old.nb_boxes, 0)
     and coalesce(new.nb_boxes, 0) < v_peak then
    raise exception 'box_capacite_reduction_impossible (annonce=%, nouvelle_capacite=%, reservations_simultanees=%)',
      new.id, new.nb_boxes, v_peak
      using errcode = 'check_violation';
  end if;

  new.nb_boxes_disponibles := case
    when new.date_fin::date < current_date then 0
    else greatest(coalesce(new.nb_boxes, 0) - v_peak, 0)
  end;
  return new;
end;
$$;

drop trigger if exists trg_box_annonce_dispo on public.box_annonces;
create trigger trg_box_annonce_dispo
  before insert or update of nb_boxes on public.box_annonces
  for each row execute function public.fn_box_annonce_guard_dispo();

-- ── 7. RPC fiche concours (DATE-AWARE) ────────────────────────────────
-- `annonces` = nb d'annonces avec dispo > 0 (UTILISÉ par le front, cohérent
--   avec transport/coach). `boxes` = capacité physique totale libre (info).
create or replace function public.fn_concours_box_available_count(p_concours_id uuid)
returns table (annonces int, boxes int)
language sql
stable
security definer
set search_path to 'public'
as $$
  with c as (select date_debut, date_fin from public.concours where id = p_concours_id),
  a as (
    select ba.id,
           public.fn_box_available(
             ba.id,
             coalesce((select date_debut from c), ba.date_debut::date),
             coalesce((select date_fin   from c), ba.date_fin::date)) as dispo
      from public.box_annonces ba
     where ba.concours_id = p_concours_id
  )
  select coalesce(count(*) filter (where dispo > 0), 0)::int as annonces,
         coalesce(sum(dispo), 0)::int                        as boxes
    from a;
$$;

create or replace function public.fn_concours_available_box_annonce_ids(p_concours_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  with c as (select date_debut, date_fin from public.concours where id = p_concours_id)
  select ba.id
    from public.box_annonces ba
   where ba.concours_id = p_concours_id
     and public.fn_box_available(
           ba.id,
           coalesce((select date_debut from c), ba.date_debut::date),
           coalesce((select date_fin   from c), ba.date_fin::date)) > 0;
$$;

grant execute on function public.fn_box_available(uuid, date, date)                 to anon, authenticated;
grant execute on function public.fn_concours_box_available_count(uuid)              to anon, authenticated;
grant execute on function public.fn_concours_available_box_annonce_ids(uuid)        to anon, authenticated;

-- ── 8. Backfill ──────────────────────────────────────────────────────
update public.box_annonces a
   set nb_boxes_disponibles = public.fn_box_dispo_value(a.id);

commit;

-- ============================================================================
-- PREUVE — pic de concurrence = bonne formule
--
-- c(t) = nb de réservations S actives à l'instant t (t entier/date).
-- c ne PEUT augmenter qu'à un début de réservation (t = s_i) et ne peut
-- diminuer qu'à une fin+1 (t = e_i + 1). Entre deux évènements, c est constant.
-- Donc max_{t ∈ [Q_s,Q_e]} c(t) est atteint au bord gauche d'un de ces paliers :
--   soit Q_s lui-même, soit un s_i ∈ (Q_s, Q_e].  → jeu de points testés.
--
-- Nouvelle réservation R = [ns,ne] : R est active à CHAQUE t ∈ [ns,ne], donc
-- ajouter R fait  c'(t) = c(t) + 1  sur tout [ns,ne].  Donc :
--   pic_après_R = pic_avant(sur [ns,ne]) + 1
-- Acceptable ⟺ pic_avant([ns,ne]) + 1 <= nb_boxes.
--
-- available(start,end) = nb de réservations [start,end] supplémentaires
--   acceptables = nb_boxes - pic([start,end]).
--
-- Effet backfill attendu (données 2026-08-30) :
--   ce5a…b3 (La Baule, cap 1, 1 accepted couvrant 09-12→14)  → 0
--   ce5a…b2 / b1 (cap 1, 1 résa S couvrant la fenêtre)       → 0
--   b0000000…dea1 (Deauville, annonce PASSÉE)                → 0
--   Lyon ×2, dea2 (0 réservation S)                          → nb_boxes
-- ============================================================================
