-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 053 — F1 disponibilités : triggers consume/release + guard étendu
--
-- Consommation au passage pending→accepted ; libération quand on quitte un état
--   consommant (accepted/paid/completed) vers rejected/cancelled/expired/payment_expired.
--   accepted_at posé à l'acceptation. Triggers SECURITY DEFINER (mettent à jour
--   l'annonce indépendamment de qui déclenche la transition, ex. annulation
--   acheteur qui n'est pas auteur de l'annonce). Nommés trg_zz_* pour s'exécuter
--   APRÈS le guard 047 (trg_guard_*).
--
-- Stage / Transport : compteur atomique (UPDATE conditionnel = pas de race).
-- Box               : capacité + chevauchement de dates (SELECT FOR UPDATE).
-- Coach             : placeholder (accepted_at uniquement) ; l'exclusion GiST
--                     est différée (cf. 052). Architecture conservée.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ STAGE (compteur sur stages.places_disponibles ; qté = nb_participants) ══
create or replace function public.fn_availability_stage() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_qty int;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at := now();
  end if;

  if new.status = 'accepted' and old.status = 'pending' then
    v_qty := coalesce(new.nb_participants, 0);
    update public.stages set places_disponibles = places_disponibles - v_qty
     where id = new.stage_id and places_disponibles >= v_qty;
    if not found then
      raise exception 'stage_capacite_insuffisante (stage=%, qty=%)', new.stage_id, v_qty
        using errcode = 'check_violation';
    end if;
  elsif old.status in ('accepted','paid','completed')
        and new.status in ('rejected','cancelled','expired','payment_expired') then
    update public.stages set places_disponibles = places_disponibles + coalesce(new.nb_participants,0)
     where id = new.stage_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_zz_availability_stage on public.stage_reservations;
create trigger trg_zz_availability_stage
  before update of status on public.stage_reservations
  for each row execute function public.fn_availability_stage();


-- ═══ TRANSPORT (compteur sur transport_annonces.nb_places_disponibles ; qté = nb_places) ══
--    D4 : la logique de compteur ne s'applique QU'au transport PARTAGÉ (type 'trajet').
--    Une annonce 'location' (van loué par dates) sort immédiatement → aucune logique
--    de places, jamais de transport_capacite_insuffisante. La dispo location (par
--    dates : location_date_debut/fin, anti-chevauchement, dates_disponibles) est un
--    LOT FUTUR séparé (R4/CR6) ; ce point de sortie en réserve la place sans dette.
create or replace function public.fn_availability_transport() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_qty int; v_type text;
begin
  if new.statut = 'accepted' and old.statut is distinct from 'accepted' then
    new.accepted_at := now();
  end if;

  -- Discriminant métier : seul 'trajet' est régulé par compteur de places.
  -- 'location' (et tout type non-'trajet', défensif) → on n'effleure pas
  -- nb_places_disponibles. accepted_at ci-dessus reste posé pour les deux.
  select type_transport into v_type
    from public.transport_annonces where id = new.transport_id;
  if v_type is distinct from 'trajet' then
    return new;
  end if;

  if new.statut = 'accepted' and old.statut = 'pending' then
    v_qty := coalesce(new.nb_places, 0);
    update public.transport_annonces set nb_places_disponibles = nb_places_disponibles - v_qty
     where id = new.transport_id and nb_places_disponibles >= v_qty;
    if not found then
      raise exception 'transport_capacite_insuffisante (annonce=%, qty=%)', new.transport_id, v_qty
        using errcode = 'check_violation';
    end if;
  elsif old.statut in ('accepted','awaiting_payment','paid','completed')
        and new.statut in ('rejected','cancelled','expired','payment_expired') then
    -- M1 : 'awaiting_payment' inclus comme état consommant → l'annulation par le
    -- cron 055 (awaiting_payment → cancelled) restitue bien la place décrémentée
    -- à l'acceptation. Sans lui, chaque abandon de checkout fuit une place.
    update public.transport_annonces set nb_places_disponibles = nb_places_disponibles + coalesce(new.nb_places,0)
     where id = new.transport_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_zz_availability_transport on public.transport_reservations;
create trigger trg_zz_availability_transport
  before update of statut on public.transport_reservations
  for each row execute function public.fn_availability_transport();


-- ═══ BOX (capacité nb_boxes + chevauchement de dates ; 1 box / réservation) ══
create or replace function public.fn_availability_box() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cap int; v_count int;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at := now();
  end if;

  if new.status = 'accepted' and old.status = 'pending' then
    -- Verrou de l'annonce → sérialise les acceptations concurrentes sur cette box.
    select nb_boxes into v_cap from public.box_annonces where id = new.box_id for update;
    select count(*) into v_count
      from public.box_reservations r
     where r.box_id = new.box_id and r.id <> new.id
       -- M2 : 'awaiting_payment' compte dans l'occupation → une box en attente de
       -- paiement reste réservée pendant la fenêtre Stripe (pas de surbooking).
       and r.status in ('accepted','awaiting_payment','paid','completed')
       and daterange(r.date_debut, r.date_fin, '[]') && daterange(new.date_debut, new.date_fin, '[]');
    if v_count + 1 > coalesce(v_cap, 0) then
      raise exception 'box_conflit_periode (box=%, concurrentes=%, capacite=%)', new.box_id, v_count + 1, v_cap
        using errcode = 'check_violation';
    end if;
  end if;
  -- Libération : implicite (la réservation quitte l'ensemble actif ; pas de compteur).
  return new;
end $$;

drop trigger if exists trg_zz_availability_box on public.box_reservations;
create trigger trg_zz_availability_box
  before update of status on public.box_reservations
  for each row execute function public.fn_availability_box();


-- ═══ COACH (placeholder : accepted_at uniquement ; exclusion GiST différée) ══
create or replace function public.fn_availability_coach() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at := now();
  end if;
  -- Pas de compteur. La protection anti-chevauchement (exclusion GiST) est
  -- différée (cf. 052) ; aucune logique de consommation ici. Architecture prête.
  return new;
end $$;

drop trigger if exists trg_zz_availability_coach on public.course_demands;
create trigger trg_zz_availability_coach
  before update of status on public.course_demands
  for each row execute function public.fn_availability_coach();


-- ═══ Extension guard 047 : expired/payment_expired = transitions sensibles ═══
--    (uniquement cron/service_role/admin peuvent les poser). +completed pour transport.
create or replace function public.trg_guard_status_transition() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status not in ('paid','completed','cancelled','expired','payment_expired') then return new; end if;
  if public.fn_can_bypass_reservation_guard() then return new; end if;
  raise exception 'forbidden_status_transition: % -> % on %.% by %',
    coalesce(old.status,'<null>'), new.status, tg_table_schema, tg_table_name,
    coalesce(auth.role(), current_user) using errcode = '42501';
end $$;

create or replace function public.trg_guard_statut_transition() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.statut is not distinct from old.statut then return new; end if;
  if new.statut not in ('paid','cancelled','completed','expired','payment_expired') then return new; end if;
  if public.fn_can_bypass_reservation_guard() then return new; end if;
  raise exception 'forbidden_statut_transition: % -> % on %.% by %',
    coalesce(old.statut,'<null>'), new.statut, tg_table_schema, tg_table_name,
    coalesce(auth.role(), current_user) using errcode = '42501';
end $$;
