-- ============================================================================
-- ROLLBACK 117 — NOTIFICATIONS DE CYCLE DE VIE + ANNULATION BOX
-- ============================================================================
-- Retire les triggers/fonctions/colonnes/index créés par 117. Restaure le
-- CHECK notifications.type à l'état 091 (8 valeurs retirées).
--
-- INTENTIONNEL : le §6 de 117 (durcissement EXECUTE de
-- cancel_transport_recherche_reservation, revoke public/anon) N'EST PAS
-- annulé ici — un rollback ne doit jamais rouvrir une faille de sécurité
-- déjà corrigée. Si un rollback complet est un jour nécessaire, ce
-- durcissement reste en place volontairement.
--
-- Application manuelle si besoin :
--   supabase db query -f supabase/rollbacks/117_recherche_events_notifications_rollback.sql --linked
-- (jamais via `migration repair` — ce fichier n'est pas une migration).
-- ============================================================================

begin;

-- ── Transport ────────────────────────────────────────────────────────────
drop trigger if exists trg_zz_notify_transport_reservation_events on public.transport_reservations;
drop function if exists public.fn_notify_transport_reservation_events();

drop trigger if exists trg_zz_notify_transport_reponse_recue on public.transport_recherche_reponses;
drop function if exists public.fn_notify_transport_reponse_recue();

-- ── Box ──────────────────────────────────────────────────────────────────
drop trigger if exists trg_zz_notify_box_reservation_events on public.box_reservations;
drop function if exists public.fn_notify_box_reservation_events();

drop function if exists public.cancel_box_recherche_reservation(uuid, text);

drop trigger if exists trg_zz_notify_box_reponse_recue on public.box_recherche_reponses;
drop function if exists public.fn_notify_box_reponse_recue();

alter table public.box_reservations drop column if exists cancellation_reason;
alter table public.box_reservations drop column if exists cancelled_at;
alter table public.box_reservations drop column if exists cancelled_by;

-- ── Index de dédup ───────────────────────────────────────────────────────
drop index if exists public.uq_notif_box_reponse_recue;
drop index if exists public.uq_notif_box_reponse_acceptee;
drop index if exists public.uq_notif_box_paiement_recu;
drop index if exists public.uq_notif_box_annulation;
drop index if exists public.uq_notif_transport_reponse_recue;
drop index if exists public.uq_notif_transport_reponse_acceptee;
drop index if exists public.uq_notif_transport_paiement_recu;
drop index if exists public.uq_notif_transport_annulation;

-- Purge des notifs des 8 nouveaux types (sinon le CHECK restauré échouerait
-- s'il en existe déjà — même patron que le rollback 091).
delete from public.notifications where type in (
  'box_reponse_recue','box_reponse_acceptee','box_paiement_recu','box_annulation',
  'transport_reponse_recue','transport_reponse_acceptee','transport_paiement_recu','transport_annulation'
);

-- ── CHECK notifications.type : retour à l'état 091 ──────────────────────
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
    'concours_reply',
    'concours_presence',
    'concours_mention'
  ])
);

commit;
