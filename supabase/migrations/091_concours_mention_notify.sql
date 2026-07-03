-- ============================================================================
-- 091 — CONCOURS · DISCUSSIONS LOT 2 (mentions @utilisateur + notif de mention)
-- ============================================================================
-- Périmètre L2-B :
--   • notifications.type : ÉLARGI à 'concours_mention' (additif, aucun retrait ;
--     reprend l'état autoritatif de 090 + 1 valeur). Symétrique de 'concours_reply'
--     (083). Le front (useNotifications) gère déjà le rendu par type + lien.
--   • trigger AFTER INSERT sur concours_messages : parse les jetons
--     @[pseudo](user:UUID) du contenu et notifie chaque utilisateur mentionné
--     (≠ auteur, existant, dédup), best-effort.
--
-- HORS PÉRIMÈTRE (non touché) : Stripe, Resend, payments, escrow, webhooks,
--   emails, push. 'concours_reply' (083) NON touché. Aucune écriture sur
--   payments/reservations/escrow. Aucune colonne/table existante modifiée.
--
-- 100% ADDITIF & IDEMPOTENT. Application (workflow Equishow) :
--   supabase db query -f supabase/migrations/091_concours_mention_notify.sql --linked
--   supabase migration repair --status applied 091 --linked
--   JAMAIS db push.
-- ============================================================================

begin;

-- ── 1. notifications.type : ÉLARGIR le CHECK (+ 'concours_mention') ──────────
-- État autoritatif = celui de 090, augmenté de 'concours_mention'. Additif strict.
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

-- ── 2. Idempotence : au plus 1 notif mention par (message, destinataire) ─────
-- Un message peut mentionner plusieurs users → 1 notif chacun ; un même user
-- mentionné 2× dans le même message → 1 seule notif. Patron 083 (adapté à la
-- multiplicité des destinataires).
create unique index if not exists uq_notifications_concours_mention
  on public.notifications ((donnees->>'message_id'), destinataire_id)
  where type = 'concours_mention';

-- ── 3. Trigger notif mention (AFTER INSERT) ─────────────────────────────────
-- Parse les jetons @[pseudo](user:UUID) du contenu, notifie chaque utilisateur
-- mentionné. Règles :
--   • pas d'auto-mention (destinataire = auteur ignoré) ;
--   • destinataire doit exister dans public.users (sinon ignoré) ;
--   • le snapshot identité de l'auteur (auteur_pseudo) est déjà rempli par le
--     trigger BEFORE INSERT tg_concours_message_fill_author (082) ;
--   • fill_notification_author_fields (015) complète auteur_nom/pseudo/... via auteur_id ;
--   • best-effort : un échec de notif ne bloque JAMAIS l'insert du message, et
--     un destinataire raté ne bloque pas les autres.
create or replace function public.fn_notify_concours_mention()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
begin
  if new.is_deleted then
    return new;
  end if;

  for v_uid in
    select distinct (m[1])::uuid
    from regexp_matches(
      coalesce(new.contenu, ''),
      '@\[[^\]]+\]\(user:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)',
      'g'
    ) as m
  loop
    -- Jamais s'auto-notifier.
    if v_uid = new.auteur_id then
      continue;
    end if;
    -- L'utilisateur mentionné doit exister.
    if not exists (select 1 from public.users where id = v_uid) then
      continue;
    end if;

    begin
      insert into public.notifications
        (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
      values
        (v_uid,
         new.auteur_id,
         'concours_mention',
         '💬 Vous avez été mentionné',
         format('%s vous a mentionné dans une discussion',
                coalesce(nullif(btrim(new.auteur_pseudo), ''), 'Quelqu''un')),
         '/concours/' || new.concours_id || '/discussion',
         '/concours/' || new.concours_id || '/discussion',
         jsonb_build_object(
           'concours_id', new.concours_id,
           'message_id', new.id,
           'mentioned_user_id', v_uid))
      on conflict ((donnees->>'message_id'), destinataire_id)
        where type = 'concours_mention' do nothing;
    exception
      when others then
        -- Un destinataire raté ne bloque pas les autres.
        null;
    end;
  end loop;

  return new;
exception
  when others then
    -- Notif best-effort : ne jamais faire échouer la publication du message.
    return new;
end;
$$;

drop trigger if exists trg_zz_notify_concours_mention on public.concours_messages;
create trigger trg_zz_notify_concours_mention
  after insert on public.concours_messages
  for each row execute function public.fn_notify_concours_mention();

commit;
