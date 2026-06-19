-- ============================================================================
-- 083 — CONCOURS · DISCUSSIONS LOT 2 P1 (tags métier + réponses + notif réponse)
-- ============================================================================
-- Périmètre LOT 2 P1 (transformer le fil en entonnoir de réservation) :
--   • topic : ÉLARGI à 'box' + 'stage' (colonne + CHECK déjà posés en 082, jamais
--     peuplés). Sert aux chips de tag (#transport/#box/#coach/#stage) + CTA front.
--   • parent_id : DÉJÀ présent (082), non touché côté schéma → activé côté front
--     (réponses 1 niveau). On ajoute seulement la NOTIFICATION de réponse.
--   • notifications.type : ÉLARGI à 'concours_reply' (additif, aucun retrait) +
--     trigger AFTER INSERT qui notifie l'auteur du message parent.
--
-- HORS PÉRIMÈTRE (non touché) : Stripe, Resend, fil participants, mentions
--   @utilisateur, push. Aucune écriture sur payments/reservations/escrow.
--
-- 100% ADDITIF & IDEMPOTENT. Application (workflow Equishow) :
--   supabase db query -f supabase/migrations/083_concours_discussions_lot2.sql
--   supabase migration repair --status applied 083 --linked
--   JAMAIS db push.
-- ============================================================================

begin;

-- ── 1. topic : ÉLARGIR le CHECK (+ 'box', + 'stage') ────────────────────────
-- 082 posait ('general','transport','coach','hebergement','question','photo').
-- On AJOUTE 'box' et 'stage' (aucun retrait → rétro-compatible). 'hebergement'
-- conservé pour ne casser aucune donnée éventuelle.
alter table public.concours_messages drop constraint if exists concours_messages_topic_ck;
alter table public.concours_messages add constraint concours_messages_topic_ck
  check (topic is null or topic in
    ('general','transport','coach','hebergement','question','photo','box','stage'));

-- ── 2. notifications.type : ÉLARGIR le CHECK (+ 'concours_reply') ────────────
-- État autoritatif = celui de 072, augmenté de 'concours_reply'. Additif strict.
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

-- ── 3. Idempotence : au plus 1 notif 'concours_reply' par message ───────────
-- Même patron que uq_notifications_message_msgid (058).
create unique index if not exists uq_notifications_concours_reply_msgid
  on public.notifications ((donnees->>'message_id'))
  where type = 'concours_reply';

-- ── 4. Trigger notif réponse (AFTER INSERT, parent_id non null) ─────────────
-- À l'insertion d'une réponse (parent_id renseigné), notifie l'AUTEUR du parent.
-- Règles :
--   • pas de notif si parent introuvable, parent supprimé, ou auto-réponse ;
--   • le snapshot identité du répondeur (auteur_pseudo) est déjà rempli par le
--     trigger BEFORE INSERT trg_concours_message_fill_author (082) → disponible ;
--   • auteur_id = répondeur → fill_notification_author_fields (015) complète
--     auteur_nom/pseudo/initiales/couleur dans la notif ;
--   • best-effort : un échec de notif ne bloque jamais l'insert du message.
create or replace function public.fn_notify_concours_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_parent_author  uuid;
  v_parent_deleted boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  select auteur_id, is_deleted
    into v_parent_author, v_parent_deleted
  from public.concours_messages
  where id = new.parent_id;

  -- Pas de notif : parent absent, supprimé, ou je me réponds à moi-même.
  if v_parent_author is null or v_parent_deleted or v_parent_author = new.auteur_id then
    return new;
  end if;

  insert into public.notifications
    (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
  values
    (v_parent_author,
     new.auteur_id,
     'concours_reply',
     '💬 Réponse à votre message',
     format('%s a répondu à votre message',
            coalesce(nullif(btrim(new.auteur_pseudo), ''), 'Quelqu''un')),
     '/concours/' || new.concours_id || '/discussion',
     '/concours/' || new.concours_id || '/discussion',
     jsonb_build_object('concours_id', new.concours_id, 'message_id', new.id, 'parent_id', new.parent_id))
  on conflict ((donnees->>'message_id')) where type = 'concours_reply' do nothing;

  return new;
exception
  when others then
    -- Notif best-effort : ne jamais faire échouer la publication du message.
    return new;
end;
$$;

drop trigger if exists trg_zz_notify_concours_reply on public.concours_messages;
create trigger trg_zz_notify_concours_reply
  after insert on public.concours_messages
  for each row execute function public.fn_notify_concours_reply();

commit;
