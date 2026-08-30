-- ============================================================================
-- ROLLBACK 104 — restaure fn_availability_box dans sa version « contrôle par
-- chevauchement de dates, sans maintien de nb_boxes_disponibles » (état pré-104).
-- Retire les triggers/fonctions de synchronisation.
-- NB : ne « dé-backfill » pas nb_boxes_disponibles (valeur laissée telle quelle).
-- ============================================================================

begin;

drop trigger if exists trg_box_dispo_sync   on public.box_reservations;
drop trigger if exists trg_box_annonce_dispo on public.box_annonces;
drop function if exists public.fn_box_reservation_sync_dispo();
drop function if exists public.fn_box_annonce_sync_dispo();
drop function if exists public.fn_box_sync_dispo(uuid);

-- fn_availability_box : version d'origine (contrôle daterange, pas d'écriture)
create or replace function public.fn_availability_box()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cap int;
  v_count int;
  c_consuming constant text[] := array['accepted','awaiting_payment','paid','completed'];
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at := now();
  end if;

  if (old.status is null or not (old.status = any(c_consuming)))
     and (new.status = any(c_consuming)) then
    select nb_boxes into v_cap from public.box_annonces where id = new.box_id for update;
    select count(*) into v_count
      from public.box_reservations r
     where r.box_id = new.box_id and r.id <> new.id
       and r.status = any(c_consuming)
       and daterange(r.date_debut, r.date_fin, '[]') && daterange(new.date_debut, new.date_fin, '[]');
    if v_count + 1 > coalesce(v_cap, 0) then
      raise exception 'box_conflit_periode (box=%, concurrentes=%, capacite=%)', new.box_id, v_count + 1, v_cap
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_zz_availability_box on public.box_reservations;
create trigger trg_zz_availability_box
  before update of status on public.box_reservations
  for each row execute function public.fn_availability_box();

commit;
