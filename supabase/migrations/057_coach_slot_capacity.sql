-- ═══════════════════════════════════════════════════════════════════════════
-- 057_coach_slot_capacity.sql
-- Capacité de créneau Coach (anti-dépassement) — Voie A (validée 2026-06-07).
--
-- Règle métier :
--   Un créneau est identifié par (annonce_id, date_debut, date_fin).
--   Le nombre de demandes en ('accepted','paid','completed') sur ce créneau
--   ne peut dépasser la capacité de l'annonce (coach_annonces.places_disponibles).
--     capacité 1 → 1 cavalier max (anti-double-booking strict)
--     capacité N → N cavaliers max ; la (N+1)e est refusée « créneau complet »
--   Chaque (annonce_id, date_debut, date_fin) a son PROPRE compteur :
--   deux créneaux différents de la même annonce ne se bloquent pas entre eux.
--
-- Périmètre strict (rien d'autre n'est touché) :
--   - F1 052/053/054 : inchangés (trigger/fonction dédiés, isolés).
--   - Stripe / escrow : non touchés.
--   - statut 'completed' : LU seulement (jamais écrit/modifié ici).
--   - données historiques : aucune validation rétroactive, aucun nettoyage
--     (un trigger n'examine pas les lignes existantes à sa création).
--
-- Rollback :
--   drop trigger if exists trg_zz_coach_slot_capacity on public.course_demands;
--   drop function if exists public.fn_coach_slot_capacity();
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.fn_coach_slot_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap   integer;
  v_count integer;
begin
  -- On ne régule qu'à l'ENTRÉE (ou au déplacement) dans un statut consommant
  -- une place. Une simple édition d'une demande déjà acceptée (statut et
  -- créneau inchangés) ne re-déclenche pas le contrôle → pas de faux blocage,
  -- pas de re-validation des lignes historiques.
  if new.status in ('accepted','paid','completed')
     and (
       tg_op = 'INSERT'
       or old.status     is distinct from new.status
       or old.annonce_id is distinct from new.annonce_id
       or old.date_debut is distinct from new.date_debut
       or old.date_fin   is distinct from new.date_fin
     )
  then
    -- Sérialise les acceptations concurrentes du MÊME créneau (ferme la race
    -- où la Ne et la (N+1)e verraient simultanément le même compteur).
    perform pg_advisory_xact_lock(
      hashtext(new.annonce_id::text || ':' ||
               new.date_debut::text || ':' ||
               new.date_fin::text));

    -- Capacité de l'annonce ; NULL ou < 1 ⇒ 1 (anti-double-booking par défaut).
    select greatest(coalesce(places_disponibles, 1), 1)
      into v_cap
      from coach_annonces
     where id = new.annonce_id;
    v_cap := coalesce(v_cap, 1);  -- annonce introuvable (défensif)

    -- Places déjà consommées sur ce créneau exact (hors la ligne courante).
    select count(*)
      into v_count
      from course_demands d
     where d.annonce_id = new.annonce_id
       and d.date_debut = new.date_debut
       and d.date_fin   = new.date_fin
       and d.status in ('accepted','paid','completed')
       and d.id <> new.id;

    if v_count >= v_cap then
      raise exception
        'coach_slot_full: créneau complet (capacité %, déjà %)', v_cap, v_count
        using errcode = '23P01';
    end if;
  end if;

  return new;
end;
$$;

-- Nommé trg_zz_* pour passer APRÈS les triggers métier existants (recalc
-- montants, accepted_at). Couvre INSERT (création directe en statut consommant)
-- et UPDATE (acceptation pending→accepted, déplacement de créneau).
drop trigger if exists trg_zz_coach_slot_capacity on public.course_demands;
create trigger trg_zz_coach_slot_capacity
  before insert or update on public.course_demands
  for each row execute function public.fn_coach_slot_capacity();
