-- ============================================================================
-- 104 — DISPONIBILITÉ BOX : DATE-AWARE + nb_boxes_disponibles MAINTENU (DB-1 v2)
-- ============================================================================
-- CONTEXTE
--   `box_annonces.nb_boxes_disponibles` n'était maintenu par RIEN (ni trigger,
--   ni app). `fn_availability_box` faisait déjà — et fait toujours — un contrôle
--   CORRECT par chevauchement de dates (daterange && daterange), vérifié :
--     cap 1, fenêtre large → A[01-03] OK, B[05-07] OK (disjointes),
--     C[02-04] REFUSÉE (chevauche A).
--   La seule anomalie : le compteur d'affichage n'était jamais recalculé.
--
-- MODÈLE DE DONNÉES
--   box_annonces.date_debut/date_fin  = timestamptz (fenêtre de l'offre)
--   box_reservations.date_debut/date_fin = date      (période demandée ⊆ fenêtre)
--   box_reservations : PAS de colonne quantité → 1 réservation = 1 box.
--   Chevauchement inclusif '[]' (checkout jour J = checkin jour J → conflit),
--   cohérent avec le fn_availability_box existant.
--
-- ENSEMBLE CONSOMMANT  S = {accepted, awaiting_payment, paid, completed}
--   (identique à fn_availability_transport / fn_availability_stage ;
--    'completed' conservé : occupation historique réelle, sans impact sur une
--    période future qui ne la chevauche pas, puisque tout est DATE-AWARE).
--
-- CE QUE FAIT CETTE MIGRATION
--   1. fn_box_available(box, start, end)      → source de vérité pour une période
--                                               précise = nb_boxes - count(S ∩ [start,end])
--   2. fn_box_peak_concurrency(box, from, to) → pic de réservations S simultanées
--   3. nb_boxes_disponibles = greatest(nb_boxes - pic(fenêtre restante), 0)
--      → indicateur GÉNÉRAL, recalculé par trigger (box_reservations + box_annonces).
--      N'est PLUS une source de vérité pour une période précise.
--   4. fn_availability_box : contrôle chevauchement INCHANGÉ, étendu à BEFORE INSERT
--      (un INSERT direct en statut S ne peut plus contourner la capacité).
--   5. Réduire nb_boxes sous le pic de réservations concurrentes → REFUSÉ.
--   6. RPC fiche concours (date-aware) : fn_concours_box_available_count()
--      + fn_concours_available_box_annonce_ids().
--   7. Backfill.
--
-- 100 % ADDITIF sauf CREATE OR REPLACE de fn_availability_box. Ne touche NI
-- payments, NI escrow, NI RLS, NI webhooks.
-- Application : supabase db query -f supabase/migrations/104_box_availability_maintained.sql --linked
--               puis supabase migration repair --status applied 104. JAMAIS db push.
-- ============================================================================

begin;

-- ── 1. Disponibilité pour une PÉRIODE PRÉCISE (source de vérité) ────────────
create or replace function public.fn_box_available(p_box_id uuid, p_start date, p_end date)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select greatest(
    coalesce((select nb_boxes from public.box_annonces where id = p_box_id), 0)
    - (
      select count(*)
        from public.box_reservations r
       where r.box_id = p_box_id
         and r.status = any (array['accepted','awaiting_payment','paid','completed'])
         and daterange(r.date_debut, r.date_fin, '[]')
          && daterange(coalesce(p_start, '-infinity'::date), coalesce(p_end, 'infinity'::date), '[]')
    ),
    0);
$$;

comment on function public.fn_box_available(uuid, date, date) is
  '104 — nb de box libres pour une réservation couvrant TOUTE la période [start,end] (chevauchement inclusif).';

-- ── 2. Pic de concurrence sur une fenêtre ─────────────────────────────────
-- Le pic de réservations S simultanées est atteint à une date de DÉBUT de
-- réservation (ou au début de la fenêtre). On teste ces points.
create or replace function public.fn_box_peak_concurrency(p_box_id uuid, p_from date, p_to date)
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
             and r2.status = any (array['accepted','awaiting_payment','paid','completed'])
             and daterange(r2.date_debut, r2.date_fin, '[]') @> pts.d
        ) as cnt
        from (
          select p_from as d
          union
          select r1.date_debut
            from public.box_reservations r1
           where r1.box_id = p_box_id
             and r1.status = any (array['accepted','awaiting_payment','paid','completed'])
             and r1.date_debut between p_from and p_to
        ) pts
      ) s
    ), 0)
  end;
$$;

comment on function public.fn_box_peak_concurrency(uuid, date, date) is
  '104 — nombre max de réservations consommantes simultanées sur [from,to].';

-- ── 3. Valeur "indicateur général" nb_boxes_disponibles ───────────────────
-- = greatest(nb_boxes - pic(fenêtre RESTANTE de l''annonce), 0).
create or replace function public.fn_box_dispo_value(p_box_id uuid)
returns int
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when a.date_fin::date < current_date then 0            -- annonce passée : plus rien à réserver
    else greatest(
      a.nb_boxes - public.fn_box_peak_concurrency(
        a.id,
        greatest(current_date, a.date_debut::date),
        a.date_fin::date),
      0)
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

-- ── 4. Contrôle chevauchement (BEFORE INSERT OR UPDATE OF status) ──────────
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
  v_old_status text := (case when tg_op = 'INSERT' then null else old.status end);
begin
  if new.status = 'accepted' and v_old_status is distinct from 'accepted' then
    new.accepted_at := now();
  end if;

  -- Première entrée dans l'ensemble consommant → contrôle capacité sur les
  -- réservations qui CHEVAUCHENT la période demandée.
  -- Couvre : INSERT direct en statut S, et pending→accepted/awaiting_payment/paid.
  if (v_old_status is null or not (v_old_status = any(c_consuming)))
     and (new.status = any(c_consuming)) then
    select nb_boxes into v_cap
      from public.box_annonces
     where id = new.box_id
     for update;   -- verrou : sérialise les acceptations concurrentes

    select count(*) into v_count
      from public.box_reservations r
     where r.box_id = new.box_id
       and r.id <> new.id
       and r.status = any (c_consuming)
       and daterange(r.date_debut, r.date_fin, '[]')
        && daterange(new.date_debut, new.date_fin, '[]');

    if v_count + 1 > coalesce(v_cap, 0) then
      raise exception 'box_conflit_periode (box=%, chevauchantes=%, capacite=%)',
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

-- ── 5. Sync AFTER sur box_reservations (insert / statut / delete) ─────────
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

-- ── 6. box_annonces : garde anti-réduction + maj nb_boxes_disponibles ─────
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

  -- Réduire la capacité sous le pic de réservations concurrentes = situation
  -- impossible → refus (plutôt que d'écraser silencieusement à 0).
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

-- ── 7. RPC fiche concours (DATE-AWARE) ────────────────────────────────────
-- Retourne les 2 sémantiques : nb d'annonces avec dispo, et nb de BOX physiques
-- libres pour les dates du concours.
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

-- ── 8. Backfill : recalcule nb_boxes_disponibles de toutes les annonces ──
update public.box_annonces a
   set nb_boxes_disponibles = public.fn_box_dispo_value(a.id);

commit;

-- ============================================================================
-- Effet backfill attendu (données du 2026-08-30) :
--   ce5a0000-…b3 (La Baule, cap 1, 1 accepted couvrant 09-12→14)  → dispo 0
--   ce5a0000-…b2 (Saumur, cap 1, 1 paid)                          → dispo 0
--   ce5a0000-…b1 (Fontainebleau, cap 1, 1 completed)              → dispo 0
--   b0000000-…dea1 (Deauville, cap 4, 1 completed)                → dispo 3
--   autres (0 réservation S)                                       → dispo = nb_boxes
-- fn_concours_box_available_count('<La Baule>')  → (annonces 0, boxes 0)
-- ============================================================================
