-- ═══════════════════════════════════════════════════════════════════════════
-- 060_fix_availability_transport_symmetric.sql
-- Fix surbooking F1 Transport : trigger symétrique sur les états consommants.
--
-- BUG (révélé par E2E réel 2026-06-08) : le parcours transport va
--   pending → paiement-transport → webhook → paid   (saute 'accepted').
-- Or fn_availability_transport ne consommait qu'au pending→accepted →
--   une réservation 'paid' ne décrémentait JAMAIS nb_places_disponibles
--   (surbooking) ; et un remboursement (paid→cancelled) restituait une place
--   jamais retirée (place fantôme, compteur > capacité).
--
-- CORRECTIF : consommation/libération symétriques sur l'ensemble consommant S.
--   S = {accepted, awaiting_payment, paid, completed}
--   Consomme  : old.statut ∉ S  ET  new.statut ∈ S   (couvre pending→paid)
--   Libère    : old.statut ∈ S   ET  new.statut ∈ {rejected,cancelled,expired,payment_expired}
--   → pas de double-consommation (transitions internes à S : old∈S et new∈S → rien)
--   → restitution 1:1 exacte ; plus de place fantôme.
--
-- Périmètre STRICT : transport uniquement. NE touche PAS le trigger existant
-- (BEFORE UPDATE OF statut) — remplace seulement le CORPS de la fonction.
-- 'location' : early-return conservé (non régulé au compteur, logique D4).
--
-- ⚠️ NOTE : Stage (fn_availability_stage) et Box (fn_availability_box) ont le
--   MÊME défaut (consume @accepted, 0 accepted_at en prod) → à corriger dans
--   un LOT SÉPARÉ. Coach est protégé par la garde mig 057. (Hors périmètre 060.)
--
-- Rollback : restaurer le corps d'origine (consume pending→accepted). Voir doc.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.fn_availability_transport()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty  int;
  v_type text;
  c_consuming constant text[] := array['accepted','awaiting_payment','paid','completed'];
  c_release   constant text[] := array['rejected','cancelled','expired','payment_expired'];
begin
  -- accepted_at informatif (inchangé)
  if new.statut = 'accepted' and old.statut is distinct from 'accepted' then
    new.accepted_at := now();
  end if;

  -- Seul 'trajet' est régulé au compteur de places. 'location' (et tout type
  -- non-'trajet', défensif) → on n'effleure pas nb_places_disponibles (logique D4).
  select type_transport into v_type
    from public.transport_annonces where id = new.transport_id;
  if v_type is distinct from 'trajet' then
    return new;
  end if;

  v_qty := coalesce(new.nb_places, 0);

  -- CONSOMMATION : première entrée dans l'ensemble consommant S.
  -- Couvre pending→accepted, pending→awaiting_payment ET pending→paid.
  if (old.statut is null or not (old.statut = any(c_consuming)))
     and (new.statut = any(c_consuming)) then
    update public.transport_annonces
       set nb_places_disponibles = nb_places_disponibles - v_qty
     where id = new.transport_id and nb_places_disponibles >= v_qty;
    if not found then
      raise exception 'transport_capacite_insuffisante (annonce=%, qty=%)', new.transport_id, v_qty
        using errcode = 'check_violation';
    end if;

  -- LIBÉRATION : sortie de l'ensemble S vers un état terminal non-consommant.
  -- Restitue exactement la quantité consommée (1:1). Si la réservation n'avait
  -- jamais consommé (old ∉ S, ex. pending→cancelled), aucune des deux branches
  -- ne s'exécute → pas de place fantôme.
  elsif (old.statut = any(c_consuming)) and (new.statut = any(c_release)) then
    update public.transport_annonces
       set nb_places_disponibles = nb_places_disponibles + v_qty
     where id = new.transport_id;
  end if;

  return new;
end;
$$;
