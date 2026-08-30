-- ============================================================================
-- NETTOYAGE — notifications « fantômes » (course_request / stage_reservation
-- status='pending' sans demande pending correspondante).
--
-- ⚠️ À exécuter APRÈS la migration 105 (dont le backfill traite déjà tous les
--    cas où une demande EXISTE mais n'est plus pending). Ce script ne cible que
--    les ORPHELINES : aucune demande/réservation ne correspond.
--
-- Contexte (état constaté le 2026-08-30) : 9 notifs pending au total —
--   1  course_request  f8b635ee  (Sarah)    → demande completed  → traité par 105
--   2  course_request  289b…/32691…(emilie) → demandes expired   → traité par 105
--   6  stage_reservation (emilie)           → ORPHELINES (stage_id sans réservation)
--                                            → traité par CE script
-- ============================================================================

begin;

-- Aperçu (à lancer d'abord, hors transaction si besoin) :
--   select n.id, n.type, n.destinataire_id, n.donnees->>'stageId' sid, n.donnees->>'annonceId' aid
--   from public.notifications n
--   where n.status='pending' and n.type in ('course_request','stage_reservation')
--     and not exists (
--       select 1 from public.course_demands d
--       where d.coach_id=n.destinataire_id
--         and (d.id::text = n.donnees->>'demandId' or d.annonce_id::text = n.donnees->>'annonceId'))
--     and not exists (
--       select 1 from public.stage_reservations r
--       where r.coach_id=n.destinataire_id
--         and (r.id::text = n.donnees->>'reservationId' or r.stage_id::text = n.donnees->>'stageId'));

-- OPTION A (recommandée) — marquer résolu + lu (garde une trace)
update public.notifications n
   set status = 'rejected', lu = true
 where n.status = 'pending'
   and n.type in ('course_request','stage_reservation')
   and not exists (
     select 1 from public.course_demands d
      where d.coach_id = n.destinataire_id
        and (d.id::text = (n.donnees->>'demandId') or d.annonce_id::text = (n.donnees->>'annonceId')))
   and not exists (
     select 1 from public.stage_reservations r
      where r.coach_id = n.destinataire_id
        and (r.id::text = (n.donnees->>'reservationId') or r.stage_id::text = (n.donnees->>'stageId')));

-- OPTION B (alternative) — supprimer les orphelines
-- delete from public.notifications n
--  where n.status = 'pending'
--    and n.type in ('course_request','stage_reservation')
--    and not exists (... idem ...);

commit;
