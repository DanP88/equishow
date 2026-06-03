-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 050 — coach_stats compte aussi les réservations 'completed'
--
-- Contexte (LOT A · A3, 2026-06-03) :
--   La vue public.coach_stats (mig 030) comptait uniquement status='paid' pour
--   course_demands et stage_reservations. Depuis la mig 049, une réservation
--   payée bascule en status='completed' à la libération escrow. Conséquence :
--   ces réservations sortaient du décompte → sous-évaluation des bookings coach
--   et risque de perte de certification (fn_recalc_coach_certified : seuil >= 10).
--
-- Correctif :
--   Compter status IN ('paid','completed') dans les deux sous-requêtes.
--
-- Non destructif : create or replace view, colonnes inchangées (mêmes noms /
--   même ordre), aucune dépendance cassée. fn_recalc_coach_certified et la vue
--   conservent leurs signatures. Les noms de colonnes gardent le suffixe `_paid`
--   pour rester compatibles avec create-or-replace (renommer imposerait un DROP
--   qui casserait la fonction dépendante) — la sémantique inclut désormais
--   'completed'.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.coach_stats as
select
  cp.user_id,
  coalesce((
    select count(*) from public.course_demands cd
    where cd.coach_id = cp.user_id and cd.status in ('paid','completed')
  ), 0)::int as course_bookings_paid,
  coalesce((
    select count(*) from public.stage_reservations sr
    where sr.coach_id = cp.user_id and sr.status in ('paid','completed')
  ), 0)::int as stage_bookings_paid,
  coalesce((
    select avg(note)::numeric(3,2) from public.avis a
    where a.destinataire_id = cp.user_id and a.type in ('coach','stage')
  ), 0) as avg_rating,
  coalesce((
    select count(*) from public.avis a
    where a.destinataire_id = cp.user_id and a.type in ('coach','stage')
  ), 0)::int as reviews_count
from public.coach_profiles cp;

comment on view public.coach_stats is
  'Stats live par coach. course_bookings_paid / stage_bookings_paid comptent
   status IN (paid, completed) depuis mig 050 (compat completed post-escrow).';
