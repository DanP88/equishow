-- ═══════════════════════════════════════════════════════════════════════════
-- 060b_backfill_transport_availability.sql
-- Backfill des places jamais consommées (réservations déjà 'paid'/etc. créées
-- AVANT le fix 060). Recalcule nb_places_disponibles depuis la capacité totale.
--
-- À jouer APRÈS 060. IDEMPOTENT : ne modifie une annonce que si sa valeur
-- diffère du recalcul (clause WHERE <>). Rejouable sans effet de bord.
--
-- Règle : nb_places_disponibles = nb_places_total
--                                - Σ(nb_places des réservations en statut consommant)
--   États consommants = {accepted, awaiting_payment, paid, completed}
--   Borné à >= 0 (greatest) par sécurité.
--   Périmètre : type_transport='trajet' uniquement (location non régulé).
--
-- État connu au 2026-06-08 : 1 annonce concernée → 927ba22f (2/2 → doit devenir 1/2).
-- ═══════════════════════════════════════════════════════════════════════════

update public.transport_annonces a
set nb_places_disponibles = greatest(0, a.nb_places_total - coalesce(sub.qty, 0))
from (
  select transport_id, sum(nb_places) as qty
  from public.transport_reservations
  where statut = any (array['accepted','awaiting_payment','paid','completed'])
  group by transport_id
) sub
where a.id = sub.transport_id
  and a.type_transport = 'trajet'
  and a.nb_places_disponibles <> greatest(0, a.nb_places_total - coalesce(sub.qty, 0));
