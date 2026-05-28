-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 043 — transport_reservations.statut accepte 'cancelled'
--
-- process-refund annule désormais la réservation transport (comme box/course/
-- stage) lors d'un remboursement, pour éviter l'incohérence « Réservé » +
-- « Remboursé ». La colonne FR `statut` avait un CHECK sans 'cancelled'.
-- Non destructif : remplace une contrainte CHECK par une version élargie.
-- (box_reservations autorise déjà 'cancelled' — rien à faire de ce côté.)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  cn text;
begin
  -- Retrouve la contrainte CHECK qui contraint exactement la colonne statut.
  select conname into cn
    from pg_constraint
   where conrelid = 'transport_reservations'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%(statut = ANY%';
  if cn is not null then
    execute format('alter table transport_reservations drop constraint %I', cn);
  end if;

  alter table transport_reservations
    add constraint transport_reservations_statut_check
    check (statut = any (array['pending','accepted','rejected','awaiting_payment','paid','cancelled']));
end $$;
