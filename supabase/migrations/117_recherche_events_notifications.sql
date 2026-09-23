-- ============================================================================
-- 117 — NOTIFICATIONS DE CYCLE DE VIE « RECHERCHES OUVERTES » (Box + Transport)
--       + ANNULATION BOX (RPC miroir de 113, Box n'en avait aucune)
-- ============================================================================
-- Demande explicite de Dan (session 2026-09-22, suite validation PAY-RETURN-1) :
-- notifier à chaque étape du parcours recherche ouverte, pas seulement le
-- paiement. Aujourd'hui RIEN ne notifie sur ce parcours pour Box ni Transport
-- (vérifié : aucun trigger DB, `createNotification` n'existe que dans le flux
-- V1 classique `reserver-box.tsx`, jamais appelé par les RPC 111/114/116).
--
-- 4 événements × 2 modules = 8 nouveaux types `notifications.type` (additif,
-- rien retiré) :
--   box_reponse_recue        — le demandeur est notifié qu'un offreur a répondu
--   box_reponse_acceptee     — l'offreur est notifié que sa réponse est acceptée
--   box_paiement_recu        — le vendeur (offreur) est notifié du paiement confirmé
--   box_annulation           — l'autre partie est notifiée d'une annulation
--   transport_reponse_recue / _acceptee / _paiement_recu / _annulation (miroir)
--
-- Découverte pendant l'investigation : Box n'a JAMAIS eu de mécanisme
-- d'annulation (ni V1 ni V2) — impossible de notifier une annulation qui ne
-- peut jamais se produire. Décision de Dan : construire aussi
-- `cancel_box_recherche_reservation`, MIROIR STRICT de
-- `cancel_transport_recherche_reservation` (113) — même périmètre (statut
-- 'accepted' uniquement, buyer OU seller, traçabilité cancelled_by/at/reason),
-- même mécanisme de contournement du guard 047 (SECURITY DEFINER owned by
-- postgres, current_user ∉ {authenticated,anon,authenticator} →
-- fn_can_bypass_reservation_guard() = true). AUCUNE modification du guard.
--
-- Tous les triggers de notification sont BEST-EFFORT (exception handler
-- interne + externe) : un échec de notif ne bloque JAMAIS l'écriture
-- métier (réponse, acceptation, paiement, annulation). Dédup par index
-- unique partiel (donnees->>'...', destinataire_id) where type='...' —
-- même patron que 090/091, déjà en prod.
--
-- Bonus (découvert en cours de route, même famille de risque que 115) :
-- `cancel_transport_recherche_reservation` (113) n'avait JAMAIS été durcie
-- comme 115 l'a fait pour accept_transport_recherche_response/
-- accept_box_recherche_response — EXECUTE restait accordé à public/anon
-- (défaut Postgres, jamais révoqué). Corrigé ici (§6), même schéma que 115.
--
-- HORS PÉRIMÈTRE : Coach, Stage, Stripe, webhook-stripe, escrow, RLS
-- existantes, guards 047 (non modifiés). Aucune colonne/table existante
-- modifiée en profondeur — uniquement colonnes additives + nouveaux triggers.
--
-- Rollback : supabase/migrations/117_recherche_events_notifications_rollback.sql
-- Application prod : supabase db query -f <file> --linked
--   puis supabase migration repair --status applied 117 --linked. JAMAIS db push.
-- ============================================================================

begin;

-- ── 0. Préconditions ─────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.box_recherche_reponses') is null then
    raise exception '117 requiert 114 (box_recherche_reponses absente).';
  end if;
  if to_regclass('public.transport_recherche_reponses') is null then
    raise exception '117 requiert 111 (transport_recherche_reponses absente).';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'box_reservations' and column_name = 'recherche_id'
  ) then
    raise exception '117 requiert 114 : box_reservations.recherche_id absente.';
  end if;
end $$;

-- ── 1. notifications.type : ÉLARGIR le CHECK (+8 valeurs) ───────────────────
-- État autoritatif = celui de 091, augmenté de 8 valeurs. Additif strict.
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
    'concours_mention',
    'box_reponse_recue','box_reponse_acceptee','box_paiement_recu','box_annulation',
    'transport_reponse_recue','transport_reponse_acceptee','transport_paiement_recu','transport_annulation'
  ])
);

-- ── 2. Idempotence : 1 index unique partiel par type ─────────────────────────
create unique index if not exists uq_notif_box_reponse_recue
  on public.notifications ((donnees->>'reponse_id'), destinataire_id)
  where type = 'box_reponse_recue';
create unique index if not exists uq_notif_box_reponse_acceptee
  on public.notifications ((donnees->>'reservation_id'), destinataire_id)
  where type = 'box_reponse_acceptee';
create unique index if not exists uq_notif_box_paiement_recu
  on public.notifications ((donnees->>'reservation_id'), destinataire_id)
  where type = 'box_paiement_recu';
create unique index if not exists uq_notif_box_annulation
  on public.notifications ((donnees->>'reservation_id'), destinataire_id)
  where type = 'box_annulation';

create unique index if not exists uq_notif_transport_reponse_recue
  on public.notifications ((donnees->>'reponse_id'), destinataire_id)
  where type = 'transport_reponse_recue';
create unique index if not exists uq_notif_transport_reponse_acceptee
  on public.notifications ((donnees->>'reservation_id'), destinataire_id)
  where type = 'transport_reponse_acceptee';
create unique index if not exists uq_notif_transport_paiement_recu
  on public.notifications ((donnees->>'reservation_id'), destinataire_id)
  where type = 'transport_paiement_recu';
create unique index if not exists uq_notif_transport_annulation
  on public.notifications ((donnees->>'reservation_id'), destinataire_id)
  where type = 'transport_annulation';

-- ── 3. BOX — trigger « réponse reçue » (AFTER INSERT box_recherche_reponses) ─
create or replace function public.fn_notify_box_reponse_recue()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_demandeur_id uuid;
  v_lieu text;
begin
  select demandeur_id into v_demandeur_id from public.box_recherches where id = new.recherche_id;
  if v_demandeur_id is null or v_demandeur_id = new.offreur_id then
    return new;
  end if;
  select lieu into v_lieu from public.box_annonces where id = new.annonce_id;

  begin
    insert into public.notifications
      (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
    values
      (v_demandeur_id, new.offreur_id, 'box_reponse_recue',
       '🏠 Nouvelle réponse à ta recherche de box',
       format('Une réponse est arrivée pour ta recherche de box%s',
              case when v_lieu is not null then ' — ' || v_lieu else '' end),
       '/box/mes-box', '/box/mes-box',
       jsonb_build_object('recherche_id', new.recherche_id, 'reponse_id', new.id))
    on conflict ((donnees->>'reponse_id'), destinataire_id)
      where type = 'box_reponse_recue' do nothing;
  exception when others then null;
  end;

  return new;
exception when others then return new;
end;
$$;

drop trigger if exists trg_zz_notify_box_reponse_recue on public.box_recherche_reponses;
create trigger trg_zz_notify_box_reponse_recue
  after insert on public.box_recherche_reponses
  for each row execute function public.fn_notify_box_reponse_recue();

-- ── 4. BOX — annulation : colonnes de traçabilité + RPC (miroir de 113) ─────
alter table public.box_reservations
  add column if not exists cancelled_by uuid references public.users(id) on delete set null;
alter table public.box_reservations
  add column if not exists cancelled_at timestamptz;
alter table public.box_reservations
  add column if not exists cancellation_reason text;

comment on column public.box_reservations.cancelled_by is
  '117 — buyer ou seller ayant annulé via cancel_box_recherche_reservation. NULL hors annulation.';
comment on column public.box_reservations.cancelled_at is
  '117 — horodatage de l''annulation. NULL hors annulation.';
comment on column public.box_reservations.cancellation_reason is
  '117 — raison libre optionnelle saisie par l''annulant. NULL si non renseignée.';

create or replace function public.cancel_box_recherche_reservation(
  p_reservation_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_resa public.box_reservations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'cancel_box_recherche_reservation: authentification requise';
  end if;

  select * into v_resa from public.box_reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'réservation introuvable (%)', p_reservation_id;
  end if;

  -- Périmètre strict : uniquement les réservations issues d'une recherche
  -- ouverte (114). Une réservation V1 directe (recherche_id null) est HORS
  -- PÉRIMÈTRE — garantie structurelle de non-impact V1 (même garde que 113).
  if v_resa.recherche_id is null then
    raise exception 'réservation hors périmètre : ne provient pas d''une recherche ouverte (recherche_id null)';
  end if;

  if auth.uid() <> v_resa.buyer_id and auth.uid() <> v_resa.seller_id then
    raise exception 'seul le cavalier (buyer) ou l''hébergeur (seller) de cette réservation peut l''annuler';
  end if;

  -- Périmètre strict : uniquement 'accepted' (pré-paiement), même choix produit
  -- que 113 pour Transport. awaiting_payment/paid/completed hors périmètre.
  if v_resa.status is distinct from 'accepted' then
    raise exception 'annulation non permise depuis le statut "%" via cette fonction — seul "accepted" est couvert',
      coalesce(v_resa.status, '<null>');
  end if;

  update public.box_reservations
    set status = 'cancelled',
        cancelled_by = auth.uid(),
        cancelled_at = now(),
        cancellation_reason = p_reason
  where id = p_reservation_id;
end;
$fn$;

comment on function public.cancel_box_recherche_reservation(uuid, text) is
  '117 — annulation d''une réservation box issue d''une recherche ouverte (114), '
  'limitée au statut ''accepted''. Buyer ou seller uniquement. Miroir strict de '
  'cancel_transport_recherche_reservation (113). Contourne trg_guard_status_'
  'transition (047) via le mécanisme standard SECURITY DEFINER — AUCUNE '
  'modification du guard. Capacité/couverture/statut recherche recalculés '
  'automatiquement par trg_zz_sync_box_recherche_on_reservation (114, déjà en '
  'place, after update of status) — aucune logique dupliquée ici.';

revoke execute on function public.cancel_box_recherche_reservation(uuid, text) from public;
revoke execute on function public.cancel_box_recherche_reservation(uuid, text) from anon;
grant execute on function public.cancel_box_recherche_reservation(uuid, text) to authenticated;

-- ── 5. BOX — trigger combiné « acceptée / payée / annulée » ────────────────
-- Un seul AFTER UPDATE OF status sur box_reservations, 3 branches internes —
-- évite 3 triggers distincts sur le même événement.
create or replace function public.fn_notify_box_reservation_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_offreur_id uuid;
  v_other uuid;
begin
  if new.recherche_id is null then
    return new;
  end if;

  -- Réponse acceptée : pending -> accepted → notifie l'offreur.
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    if new.recherche_reponse_id is not null then
      select offreur_id into v_offreur_id
        from public.box_recherche_reponses where id = new.recherche_reponse_id;
      if v_offreur_id is not null and v_offreur_id <> new.buyer_id then
        begin
          insert into public.notifications
            (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
          values
            (v_offreur_id, new.buyer_id, 'box_reponse_acceptee',
             '✅ Ta réponse a été acceptée',
             format('Ta proposition de box a été acceptée%s',
                    case when new.lieu is not null then ' — ' || new.lieu else '' end),
             '/box/mes-box', '/box/mes-box',
             jsonb_build_object('reservation_id', new.id, 'recherche_id', new.recherche_id))
          on conflict ((donnees->>'reservation_id'), destinataire_id)
            where type = 'box_reponse_acceptee' do nothing;
        exception when others then null;
        end;
      end if;
    end if;
  end if;

  -- Paiement reçu : * -> paid → notifie le vendeur (seller = offreur).
  if new.status = 'paid' and old.status is distinct from 'paid' then
    if new.seller_id is not null and new.seller_id <> new.buyer_id then
      begin
        insert into public.notifications
          (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
        values
          (new.seller_id, new.buyer_id, 'box_paiement_recu',
           '💶 Paiement reçu',
           format('Le paiement de ta réservation box%s a été confirmé',
                  case when new.lieu is not null then ' — ' || new.lieu else '' end),
           '/box/mes-box', '/box/mes-box',
           jsonb_build_object('reservation_id', new.id, 'recherche_id', new.recherche_id))
        on conflict ((donnees->>'reservation_id'), destinataire_id)
          where type = 'box_paiement_recu' do nothing;
      exception when others then null;
      end;
    end if;
  end if;

  -- Annulation : accepted -> cancelled → notifie l'AUTRE partie (via cancelled_by).
  if new.status = 'cancelled' and old.status = 'accepted' then
    v_other := case when new.cancelled_by = new.buyer_id then new.seller_id else new.buyer_id end;
    if v_other is not null and new.cancelled_by is not null and v_other <> new.cancelled_by then
      begin
        insert into public.notifications
          (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
        values
          (v_other, new.cancelled_by, 'box_annulation',
           '❌ Réservation annulée',
           format('Une réservation box%s a été annulée%s',
                  case when new.lieu is not null then ' — ' || new.lieu else '' end,
                  case when new.cancellation_reason is not null
                       then ' (' || new.cancellation_reason || ')' else '' end),
           '/box/mes-box', '/box/mes-box',
           jsonb_build_object('reservation_id', new.id, 'recherche_id', new.recherche_id))
        on conflict ((donnees->>'reservation_id'), destinataire_id)
          where type = 'box_annulation' do nothing;
      exception when others then null;
      end;
    end if;
  end if;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_zz_notify_box_reservation_events on public.box_reservations;
create trigger trg_zz_notify_box_reservation_events
  after update of status on public.box_reservations
  for each row execute function public.fn_notify_box_reservation_events();

-- ── 6. TRANSPORT — durcissement oublié de 113 (bonus, même famille que 115) ──
-- cancel_transport_recherche_reservation (113) n'avait jamais révoqué public/
-- anon (défaut Postgres). Corrigé ici, même schéma que 115.
revoke execute on function public.cancel_transport_recherche_reservation(uuid, text) from public;
revoke execute on function public.cancel_transport_recherche_reservation(uuid, text) from anon;
grant execute on function public.cancel_transport_recherche_reservation(uuid, text) to authenticated;

-- ── 7. TRANSPORT — trigger « réponse reçue » (AFTER INSERT) ────────────────
create or replace function public.fn_notify_transport_reponse_recue()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_demandeur_id uuid;
  v_dest text;
begin
  select demandeur_id into v_demandeur_id from public.transport_recherches where id = new.recherche_id;
  if v_demandeur_id is null or v_demandeur_id = new.offreur_id then
    return new;
  end if;
  select ville_arrivee into v_dest from public.transport_annonces where id = new.annonce_id;

  begin
    insert into public.notifications
      (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
    values
      (v_demandeur_id, new.offreur_id, 'transport_reponse_recue',
       '🚚 Nouvelle réponse à ta recherche de transport',
       format('Une réponse est arrivée pour ta recherche de transport%s',
              case when v_dest is not null then ' — vers ' || v_dest else '' end),
       '/transport/mes-transports', '/transport/mes-transports',
       jsonb_build_object('recherche_id', new.recherche_id, 'reponse_id', new.id))
    on conflict ((donnees->>'reponse_id'), destinataire_id)
      where type = 'transport_reponse_recue' do nothing;
  exception when others then null;
  end;

  return new;
exception when others then return new;
end;
$$;

drop trigger if exists trg_zz_notify_transport_reponse_recue on public.transport_recherche_reponses;
create trigger trg_zz_notify_transport_reponse_recue
  after insert on public.transport_recherche_reponses
  for each row execute function public.fn_notify_transport_reponse_recue();

-- ── 8. TRANSPORT — trigger combiné « acceptée / payée / annulée » ──────────
-- Colonne `statut` (FR) — piège historique documenté (incident Radar 077).
create or replace function public.fn_notify_transport_reservation_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_offreur_id uuid;
  v_other uuid;
begin
  if new.recherche_id is null then
    return new;
  end if;

  if new.statut = 'accepted' and old.statut is distinct from 'accepted' then
    if new.recherche_reponse_id is not null then
      select offreur_id into v_offreur_id
        from public.transport_recherche_reponses where id = new.recherche_reponse_id;
      if v_offreur_id is not null and v_offreur_id <> new.buyer_id then
        begin
          insert into public.notifications
            (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
          values
            (v_offreur_id, new.buyer_id, 'transport_reponse_acceptee',
             '✅ Ta réponse a été acceptée',
             format('Ta proposition de transport a été acceptée%s',
                    case when new.ville_arrivee is not null then ' — vers ' || new.ville_arrivee else '' end),
             '/transport/mes-transports', '/transport/mes-transports',
             jsonb_build_object('reservation_id', new.id, 'recherche_id', new.recherche_id))
          on conflict ((donnees->>'reservation_id'), destinataire_id)
            where type = 'transport_reponse_acceptee' do nothing;
        exception when others then null;
        end;
      end if;
    end if;
  end if;

  if new.statut = 'paid' and old.statut is distinct from 'paid' then
    if new.seller_id is not null and new.seller_id <> new.buyer_id then
      begin
        insert into public.notifications
          (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
        values
          (new.seller_id, new.buyer_id, 'transport_paiement_recu',
           '💶 Paiement reçu',
           format('Le paiement de ta réservation transport%s a été confirmé',
                  case when new.ville_arrivee is not null then ' — vers ' || new.ville_arrivee else '' end),
           '/transport/mes-transports', '/transport/mes-transports',
           jsonb_build_object('reservation_id', new.id, 'recherche_id', new.recherche_id))
        on conflict ((donnees->>'reservation_id'), destinataire_id)
          where type = 'transport_paiement_recu' do nothing;
      exception when others then null;
      end;
    end if;
  end if;

  if new.statut = 'cancelled' and old.statut = 'accepted' then
    v_other := case when new.cancelled_by = new.buyer_id then new.seller_id else new.buyer_id end;
    if v_other is not null and new.cancelled_by is not null and v_other <> new.cancelled_by then
      begin
        insert into public.notifications
          (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
        values
          (v_other, new.cancelled_by, 'transport_annulation',
           '❌ Réservation annulée',
           format('Une réservation transport%s a été annulée%s',
                  case when new.ville_arrivee is not null then ' — vers ' || new.ville_arrivee else '' end,
                  case when new.cancellation_reason is not null
                       then ' (' || new.cancellation_reason || ')' else '' end),
           '/transport/mes-transports', '/transport/mes-transports',
           jsonb_build_object('reservation_id', new.id, 'recherche_id', new.recherche_id))
        on conflict ((donnees->>'reservation_id'), destinataire_id)
          where type = 'transport_annulation' do nothing;
      exception when others then null;
      end;
    end if;
  end if;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_zz_notify_transport_reservation_events on public.transport_reservations;
create trigger trg_zz_notify_transport_reservation_events
  after update of statut on public.transport_reservations
  for each row execute function public.fn_notify_transport_reservation_events();

commit;
