-- ============================================================================
-- 106 — course_request / stage_reservation : status NON-NULL garanti à l'INSERT
-- ============================================================================
-- CONTEXTE
--   Les notifs de type `course_request` / `stage_reservation` doivent porter un
--   `status` cohérent avec l'état de la demande sous-jacente
--   (pending → accepted → rejected / paid). Toutes les créations issues de
--   l'APPLICATION le font déjà explicitement :
--     - reserver-coach.tsx / reserver-stage.tsx ......... status = 'pending'
--     - coach-demandes.tsx (accept / reject) ............ 'accepted' / 'rejected'
--     - useCoursePayment.ts / useStagePayment.ts ........ 'pending'
--     - webhook-stripe (paiement reçu) ................. UPDATE → 'accepted'
--   MAIS les crons d'expiration insèrent des notifs TERMINALES
--   (« Demande expirée » / « Paiement expiré ») SANS colonne `status` :
--     - fn_expire_pending()          (mig 054)
--     - fn_expire_unpaid_accepted()  (mig 054)
--     - fn_expire_awaiting_payment() (mig 055 / 063, branche stage)
--   → ces lignes se retrouvent avec `status = NULL` (le CHECK l'autorise).
--   Résultat observé : notif `bffe25e9…` (course_request, status NULL, non lue)
--   qui gonfle le badge Notifications du destinataire.
--
-- RÈGLE (alignée sur la migration 105 : expired / payment_expired → 'rejected')
--   À l'INSERT d'une notif `course_request` / `stage_reservation` sans `status`,
--   forcer `status = 'rejected'` (la demande n'a pas abouti).
--
-- POURQUOI UN TRIGGER PLUTÔT QU'ÉDITER LES CRONS
--   Les fonctions `fn_expire_pending` / `fn_expire_unpaid_accepted` /
--   `fn_expire_awaiting_payment` contiennent aussi les branches box_reservation /
--   transport_reservation — hors périmètre, à ne pas toucher. Un trigger
--   BEFORE INSERT ciblé sur les deux seuls types concernés est plus sûr et
--   couvre aussi tout futur chemin de création.
--
-- 100 % ADDITIF (1 fonction + 1 trigger). Ne touche NI payments, NI escrow,
--   NI RLS, NI realtime, NI les modules Box / Transport.
-- Application : db query -f supabase/migrations/106_notif_demand_status_not_null.sql --linked
--               puis migration repair --status applied 106. JAMAIS db push.
-- ============================================================================

begin;

create or replace function public.fn_notif_default_demand_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Les notifs de demande entrante créées par l'app portent toujours un status
  -- explicite. Une notif course_request / stage_reservation sans status = notif
  -- terminale émise par un cron d'expiration → la demande n'a pas abouti.
  if new.status is null and new.type in ('course_request', 'stage_reservation') then
    new.status := 'rejected';
  end if;
  return new;
end;
$$;

comment on function public.fn_notif_default_demand_status() is
  '106 — garantit un status non-NULL sur les notifs course_request / stage_reservation '
  '(les crons d''expiration mig 054/063 les inséraient sans status).';

drop trigger if exists trg_notifications_default_demand_status on public.notifications;
create trigger trg_notifications_default_demand_status
  before insert on public.notifications
  for each row execute function public.fn_notif_default_demand_status();

commit;

-- ============================================================================
-- VÉRIF post-application (attendu : 0 ligne)
--   select count(*) from public.notifications
--    where type in ('course_request','stage_reservation') and status is null;
-- ============================================================================
