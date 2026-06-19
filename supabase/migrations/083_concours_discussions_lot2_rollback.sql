-- ============================================================================
-- 083 ROLLBACK — Concours discussions LOT 2 P1
-- Annule strictement 083 (revient à l'état 082 + 072). Aucune autre table touchée.
--   supabase db query -f supabase/migrations/083_concours_discussions_lot2_rollback.sql
-- ============================================================================

begin;

-- Trigger + fonction + index notif réponse.
drop trigger if exists trg_zz_notify_concours_reply on public.concours_messages;
drop function if exists public.fn_notify_concours_reply();
drop index if exists public.uq_notifications_concours_reply_msgid;

-- Restaurer le CHECK topic SANS 'box'/'stage' (état 082).
-- Défensif : neutraliser les éventuels tags LOT 2 avant de restreindre le CHECK,
-- sinon l'ADD CONSTRAINT échouerait sur des lignes existantes.
update public.concours_messages set topic = null where topic in ('box','stage');
alter table public.concours_messages drop constraint if exists concours_messages_topic_ck;
alter table public.concours_messages add constraint concours_messages_topic_ck
  check (topic is null or topic in
    ('general','transport','coach','hebergement','question','photo'));

-- Restaurer le CHECK notifications.type SANS 'concours_reply' (état 072).
-- Défensif : purger les notifs LOT 2 avant de restreindre le CHECK.
delete from public.notifications where type = 'concours_reply';
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type = any (array[
    'stage_reservation','box_reservation','transport_reservation','course_request',
    'reservation_request','message','like','comment','mention','trajet_complet',
    'support_request','support_ack','support_resolved',
    'escrow_alert',
    'escrow_prestation_done','escrow_release_soon','dispute_resolved',
    'dispute_opened',
    'seller_onboarded'
  ])
);

commit;
