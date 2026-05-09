-- Migration 010 : transport_annonces.id et transport_reservations.id : TEXT -> UUID
-- Audit P12. Aligne ces tables avec le reste du schéma (toutes les autres
-- tables du marketplace utilisent uuid). Aucun caller JS/Edge Function
-- actuel ne dépend du type, donc 0 régression côté code.

-- ────────────────────────────────────────────────────────────────────────────
-- Étape 0 : garde-fou. Refuse la migration si des rows existantes contiennent
-- une valeur qui n'est pas un UUID (impossible à caster). Le user devra
-- nettoyer manuellement avant de réessayer.
-- ────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_bad integer;
  v_uuid_re constant text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  select count(*) into v_bad from public.transport_annonces
   where id !~* v_uuid_re;
  if v_bad > 0 then
    raise exception 'transport_annonces contains % rows with non-UUID id', v_bad;
  end if;

  select count(*) into v_bad from public.transport_reservations
   where id !~* v_uuid_re;
  if v_bad > 0 then
    raise exception 'transport_reservations contains % rows with non-UUID id', v_bad;
  end if;

  select count(*) into v_bad from public.transport_reservations
   where transport_id is not null and transport_id !~* v_uuid_re;
  if v_bad > 0 then
    raise exception 'transport_reservations contains % rows with non-UUID transport_id', v_bad;
  end if;

  select count(*) into v_bad from public.payments
   where transport_reservation_id is not null and transport_reservation_id !~* v_uuid_re;
  if v_bad > 0 then
    raise exception 'payments contains % rows with non-UUID transport_reservation_id', v_bad;
  end if;
end $$;

-- Transaction explicite : la CLI Supabase n'enveloppe pas automatiquement.
-- Toute erreur dans les ALTER ci-dessous => rollback de l'ensemble.
begin;

-- ────────────────────────────────────────────────────────────────────────────
-- Étape 1 : drop des FKs qui pointent vers les colonnes à convertir
-- ────────────────────────────────────────────────────────────────────────────
alter table public.payments
  drop constraint if exists payments_transport_reservation_id_fkey;

alter table public.transport_reservations
  drop constraint if exists transport_reservations_transport_id_fkey;

-- ────────────────────────────────────────────────────────────────────────────
-- Étape 2 : transport_annonces.id : TEXT -> UUID + default gen_random_uuid()
-- ────────────────────────────────────────────────────────────────────────────
alter table public.transport_annonces
  alter column id drop default,
  alter column id type uuid using id::uuid,
  alter column id set default gen_random_uuid();

-- ────────────────────────────────────────────────────────────────────────────
-- Étape 3 : transport_reservations.id (PK) et transport_id (FK) : TEXT -> UUID
-- ────────────────────────────────────────────────────────────────────────────
alter table public.transport_reservations
  alter column id drop default,
  alter column id type uuid using id::uuid,
  alter column id set default gen_random_uuid(),
  alter column transport_id type uuid using transport_id::uuid;

-- ────────────────────────────────────────────────────────────────────────────
-- Étape 4 : payments.transport_reservation_id : TEXT -> UUID
-- ────────────────────────────────────────────────────────────────────────────
alter table public.payments
  alter column transport_reservation_id type uuid using transport_reservation_id::uuid;

-- ────────────────────────────────────────────────────────────────────────────
-- Étape 5 : recréer les FKs (mêmes règles ON DELETE qu'avant)
-- ────────────────────────────────────────────────────────────────────────────
alter table public.transport_reservations
  add constraint transport_reservations_transport_id_fkey
  foreign key (transport_id)
  references public.transport_annonces(id)
  on delete set null;

alter table public.payments
  add constraint payments_transport_reservation_id_fkey
  foreign key (transport_reservation_id)
  references public.transport_reservations(id)
  on delete set null;

commit;
