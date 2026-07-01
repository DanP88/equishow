-- ============================================================================
-- 090 — CONCOURS PRESENCE NOTIFY · PR2b (notif in-app « une connaissance sera là »)
-- ============================================================================
-- Règle produit : quand une personne QUE JE CONNAIS déclare une présence FERME
--   (status='going') sur un concours QUE JE SUIS, je reçois une notif in-app.
--
-- Événement  : AFTER INSERT OR UPDATE OF status ON concours_presence, à l'entrée
--   dans 'going' uniquement (les 'interested' ne notifient pas).
-- Audience   : followers(concours) ∩ knowers(déclarant) − déclarant.
--   knowers = INVERSE de fn_people_i_know : « qui SUIT D » (asym.) ∪ messagerie
--   ∪ réservations (box/stage/course/transport) [symétriques]. JOIN users =
--   destinataire toujours valide (défensif : transport→profiles.id hors users).
-- Anti-spam  : index UNIQUE partiel (destinataire, concours, déclarant) +
--   ON CONFLICT DO NOTHING → au plus 1 notif par triplet.
-- Best-effort: un échec du chemin notif ne bloque JAMAIS la déclaration.
--
-- DÉPEND DE 015 (notifications) + 075 (concours_followers) + 088 (user_follows)
--   + 089 (concours_presence). 100% ADDITIF. Ne touche NI payments, NI escrow,
--   NI Stripe, NI webhooks, NI reservations, NI analytics. Réutilise le snapshot
--   auteur (015) et le patron trigger de 083 (concours_reply).
--
-- Idempotent. Application : supabase db query -f <file> --linked
--   puis supabase migration repair --status applied 090. JAMAIS db push.
-- Rollback : 090_concours_presence_notify_rollback.sql
-- ============================================================================

begin;

-- ── 0. Pré-conditions ───────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.notifications')       is null then raise exception '090 requiert 015 (notifications).'; end if;
  if to_regclass('public.concours_followers')  is null then raise exception '090 requiert 075 (concours_followers).'; end if;
  if to_regclass('public.user_follows')        is null then raise exception '090 requiert 088 (user_follows).'; end if;
  if to_regclass('public.concours_presence')   is null then raise exception '090 requiert 089 (concours_presence).'; end if;
end $$;

-- ── 1. notifications.type : ÉLARGIR le CHECK (+ 'concours_presence') ─────────
-- État autoritatif = celui de 083, augmenté de 'concours_presence'. Additif strict.
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
    'concours_presence'
  ])
);

-- ── 2. Idempotence : au plus 1 notif 'concours_presence' par triplet ────────
-- (destinataire, concours, déclarant). Même patron que 083.
create unique index if not exists uq_notifications_concours_presence
  on public.notifications (
    destinataire_id, (donnees->>'concours_id'), (donnees->>'presence_user_id'))
  where type = 'concours_presence';

-- ── 3. Trigger : notif à l'entrée dans 'going' (AFTER INSERT/UPDATE) ─────────
-- SECURITY DEFINER (lecture user_follows/conversations/réservations sous RLS +
-- insert de notifs pour AUTRUI). Best-effort : exception → return new.
create or replace function public.fn_notify_concours_presence()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Ne notifier qu'à l'ENTRÉE dans une présence ferme 'going'.
  -- 'interested' (ou tout autre statut) ne notifie pas.
  if new.status is distinct from 'going' then
    return new;
  end if;
  -- UPDATE : ne notifier que si on ARRIVE dans 'going' (évite re-notif sur une
  -- simple édition de cheval alors que status était déjà 'going').
  if tg_op = 'UPDATE' and old.status is not distinct from 'going' then
    return new;
  end if;

  insert into public.notifications
    (destinataire_id, auteur_id, type, titre, message, action_url, lien, donnees)
  select distinct
    u.id,
    new.user_id,
    'concours_presence',
    '👋 Une connaissance sera à ce concours',
    format('%s sera présent(e) à un concours que vous suivez',
           coalesce(nullif(btrim(du.pseudo), ''), nullif(btrim(du.prenom), ''), 'Une connaissance')),
    '/concours/' || new.concours_id,
    '/concours/' || new.concours_id,
    jsonb_build_object(
      'concours_id',      new.concours_id,
      'presence_user_id', new.user_id,
      'status',           new.status)
  from public.concours_followers f
  join public.users u  on u.id  = f.user_id       -- destinataire = follower valide
  join public.users du on du.id = new.user_id      -- déclarant (pour le pseudo)
  where f.concours_id = new.concours_id
    and u.id <> new.user_id                        -- jamais à soi-même
    and exists (                                    -- u CONNAÎT le déclarant (inverse-know)
      -- following : qui SUIT le déclarant (sens asymétrique inversé)
      select 1 from public.user_follows uf
        where uf.follower_id = u.id and uf.followee_id = new.user_id
      union all
      -- messagerie (symétrique)
      select 1 from public.conversations c
        where (c.participant_a = u.id and c.participant_b = new.user_id)
           or (c.participant_b = u.id and c.participant_a = new.user_id)
      union all
      -- réservations marketplace (symétriques)
      select 1 from public.box_reservations r
        where (r.buyer_id = u.id and r.seller_id = new.user_id)
           or (r.seller_id = u.id and r.buyer_id = new.user_id)
      union all
      select 1 from public.stage_reservations r
        where (r.cavalier_id = u.id and r.coach_id = new.user_id)
           or (r.coach_id = u.id and r.cavalier_id = new.user_id)
      union all
      select 1 from public.course_demands r
        where (r.cavalier_id = u.id and r.coach_id = new.user_id)
           or (r.coach_id = u.id and r.cavalier_id = new.user_id)
      union all
      select 1 from public.transport_reservations r
        where (r.buyer_id = u.id and r.seller_id = new.user_id)
           or (r.seller_id = u.id and r.buyer_id = new.user_id)
    )
  on conflict (destinataire_id, (donnees->>'concours_id'), (donnees->>'presence_user_id'))
    where type = 'concours_presence'
    do nothing;

  return new;
exception
  when others then
    -- Best-effort : ne jamais faire échouer la déclaration de présence.
    return new;
end $$;

comment on function public.fn_notify_concours_presence() is
  '090 PR2b — notif in-app aux followers du concours qui CONNAISSENT le déclarant '
  '(inverse fn_people_i_know), à l''entrée dans status=going. Best-effort, dédup, '
  'ne lit jamais payments.';

drop trigger if exists trg_zz_notify_concours_presence on public.concours_presence;
create trigger trg_zz_notify_concours_presence
  after insert or update of status on public.concours_presence
  for each row execute function public.fn_notify_concours_presence();

commit;

-- ============================================================================
-- NOTE : synchrone volontairement (double intersection = fan-out borné ;
-- INSERT…SELECT = 1 statement ensembliste). Si le volume l'imposait un jour →
-- bascule cron/pg_net (patron 059). In-app + web via realtime existant (028/029).
-- ============================================================================
