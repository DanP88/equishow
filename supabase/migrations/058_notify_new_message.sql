-- ═══════════════════════════════════════════════════════════════════════════
-- 058_notify_new_message.sql
-- Lot 1 — Notification IN-APP « nouveau message » (validée 2026-06-08, Option A).
--
-- À l'insertion d'un message, crée UNE notification in-app pour le DESTINATAIRE
-- (l'autre participant), visible dans la cloche / centre de notifications, en
-- plus du badge messagerie existant (qui reste inchangé).
--
-- Règles :
--   - l'expéditeur ne reçoit jamais de notification (destinataire = l'autre) ;
--   - le CONTENU du message n'est pas exposé (texte générique) ;
--   - au plus 1 notification par message (index unique partiel d'idempotence) ;
--   - pointe vers la messagerie (action_url='/messagerie' + donnees.conversation_id).
--
-- Réutilise l'existant : trigger BEFORE INSERT `fill_notification_author_fields`
-- remplit auteur_nom/pseudo/initiales/couleur depuis public.users (auteur_id) ;
-- table `notifications` déjà en realtime → cloche + compteur s'allument seuls.
--
-- Périmètre strict (rien d'autre touché) :
--   - badge messagerie / conversation_reads / push_tokens : NON touchés ;
--   - aucun push, aucun email ;
--   - Stripe / F1 (052-054) / Coach (057) / Transport : NON touchés ;
--   - trg_touch_conversation : NON touché.
--
-- Rollback :
--   drop trigger if exists trg_zz_notify_new_message on public.messages;
--   drop function if exists public.fn_notify_new_message();
--   drop index if exists public.uq_notifications_message_msgid;
-- ═══════════════════════════════════════════════════════════════════════════

-- Idempotence : au plus 1 notification 'message' par message_id.
create unique index if not exists uq_notifications_message_msgid
  on public.notifications ((donnees->>'message_id'))
  where type = 'message';

create or replace function public.fn_notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dest       uuid;
  v_sender_nom text;
begin
  -- Destinataire = l'AUTRE participant ; nom de l'expéditeur via le snapshot
  -- de la conversation (pas de jointure users).
  select case when c.participant_a = new.sender_id then c.participant_b else c.participant_a end,
         case when c.participant_a = new.sender_id then c.a_nom        else c.b_nom        end
    into v_dest, v_sender_nom
  from public.conversations c
  where c.id = new.conversation_id;

  if v_dest is null then
    return new;  -- conversation introuvable (défensif) : pas de notification
  end if;

  insert into public.notifications
    (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
  values
    (v_dest,
     new.sender_id,
     'message',
     '💬 Nouveau message',
     format('%s vous a envoyé un message',
            coalesce(nullif(btrim(v_sender_nom), ''), 'Quelqu''un')),
     '/messagerie',
     '/messagerie',
     jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id))
  on conflict ((donnees->>'message_id')) where type = 'message' do nothing;

  return new;
end;
$$;

drop trigger if exists trg_zz_notify_new_message on public.messages;
create trigger trg_zz_notify_new_message
  after insert on public.messages
  for each row execute function public.fn_notify_new_message();
