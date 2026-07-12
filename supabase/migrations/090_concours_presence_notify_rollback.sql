-- ============================================================================
-- ROLLBACK 090 — CONCOURS PRESENCE NOTIFY · PR2b
-- ============================================================================
-- Réversible à 100%. Retire le trigger + la fonction + l'index de dédup,
-- purge les notifs de ce type, puis restaure le CHECK type SANS 'concours_presence'
-- (état 083). Ne touche NI 015 (notifications) NI 075/088/089. Aucune donnée
-- annonce/réservation/paiement impactée.
-- ============================================================================

begin;

-- 3. trigger + fonction
drop trigger if exists trg_zz_notify_concours_presence on public.concours_presence;
drop function if exists public.fn_notify_concours_presence();

-- 2. index de dédup
drop index if exists public.uq_notifications_concours_presence;

-- Purge des notifs de ce type (sinon le CHECK restauré échouerait s'il en existe).
delete from public.notifications where type = 'concours_presence';

-- 1. restaurer le CHECK type à l'état 083 (sans 'concours_presence')
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'stage_reservation','box_reservation','transport_reservation','course_request',
    'reservation_request','message','like','comment','mention','trajet_complet',
    'support_request','support_ack','support_resolved',
    'escrow_alert',
    'escrow_prestation_done','escrow_release_soon','dispute_resolved',
    'dispute_opened',
    'seller_onboarded',
    'concours_reply'
  ])
);

commit;
