-- ════════════════════════════════════════════════════════════════════════
-- NON-RÉGRESSION 064 — Cohérence du N° de réservation EQ-XXX
--
-- Règle : tout paiement `succeeded` (box/course/stage/transport) créé APRÈS la
-- mise en place de la garde 064 DOIT porter la FK de sa réservation. Sinon le
-- N° EQ affiché sur checkout-success divergerait de celui de l'agenda.
--
-- À exécuter régulièrement (CI / monitoring) :
--   supabase db query --linked -f supabase/tests/064_payment_resa_fk/non_regression_check.sql
--
-- RÉSULTAT ATTENDU : 0 ligne. Toute ligne renvoyée = régression (un paiement
-- récent sans FK réservation).
--
-- Les lignes legacy (avant la date de garde) sont volontairement exclues :
-- irrécupérables, grandfathered par le trigger INSERT-only. Adapter la date du
-- WHERE à la date réelle d'application de la migration 064 en prod.
-- ════════════════════════════════════════════════════════════════════════

select
  p.id          as payment_id,
  p.type,
  p.created_at,
  'FK réservation manquante (N° EQ incohérent agenda↔confirmation)' as violation
from public.payments p
where p.payment_status = 'succeeded'
  and p.type in ('box', 'course', 'stage', 'transport')
  and p.created_at >= date '2026-06-10'   -- ⚠️ = date d'application de la garde 064 en prod
  and (
    case p.type
      when 'course'    then p.course_demand_id::text
      when 'stage'     then p.stage_reservation_id::text
      when 'transport' then p.transport_reservation_id::text
      when 'box'       then p.box_reservation_id::text
    end
  ) is null
order by p.created_at desc;
