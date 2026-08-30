-- ============================================================================
-- 105 — SYNCHRONISATION DES NOTIFICATIONS DE DEMANDE (DB-2)
-- ============================================================================
-- PROBLÈME : une notification « 🎓 Nouvelle demande de cours / stage »
--   (type course_request / stage_reservation, status='pending') reste en base
--   telle quelle même après que la demande a été acceptée / refusée / payée /
--   complétée / expirée / annulée. Le filtre UI (C3, selectActiveNotifications)
--   la masque, mais la donnée base reste incohérente.
--
-- SOLUTION : trigger AFTER UPDATE OF status sur course_demands + stage_reservations
--   qui met à jour la notif correspondante (status + lu=true) dès que la demande
--   quitte 'pending'.
--
-- RAPPROCHEMENT notif ↔ demande (vérifié sur la donnée réelle) :
--   - notif.destinataire_id = demande.coach_id
--   - notif.type            = 'course_request' | 'stage_reservation'
--   - PRIORITÉ : donnees->>'demandId' (course) / 'reservationId' (stage)
--       = id de la demande   (ajouté par reserver-coach.tsx / reserver-stage.tsx)
--   - REPLI (notifs déjà en base, sans demandId) :
--       donnees->>'annonceId' = course_demands.annonce_id
--       donnees->>'stageId'   = stage_reservations.stage_id
--
-- Mapping statut demande → statut notif (CHECK notifications = pending|accepted|
--   rejected|paid) :
--   accepted / awaiting_payment / completed → 'accepted'
--   paid                                    → 'paid'
--   rejected / cancelled / expired / payment_expired → 'rejected'
--
-- 100 % ADDITIF. Ne touche NI payments, NI escrow, NI RLS. Le filtre UI C3 reste
-- en place (filet de sécurité pour les notifs créées hors app / historiques).
-- Application : db query -f ... --linked  puis  migration repair --status applied 105.
-- ============================================================================

begin;

create or replace function public.fn_sync_demand_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_notif_type    text;
  v_id_key        text;
  v_id_val        text;
  v_fallback_key  text;
  v_fallback_val  text;
  v_new_status    text;
begin
  -- Rien à faire si le statut n'a pas changé, ou s'il (re)devient 'pending'.
  if new.status is not distinct from old.status then return new; end if;
  if new.status = 'pending' then return new; end if;

  if tg_table_name = 'course_demands' then
    v_notif_type   := 'course_request';
    v_id_key       := 'demandId';       v_id_val       := new.id::text;
    v_fallback_key := 'annonceId';      v_fallback_val := new.annonce_id::text;
  else -- stage_reservations
    v_notif_type   := 'stage_reservation';
    v_id_key       := 'reservationId';  v_id_val       := new.id::text;
    v_fallback_key := 'stageId';        v_fallback_val := new.stage_id::text;
  end if;

  v_new_status := case
    when new.status in ('accepted','awaiting_payment','completed') then 'accepted'
    when new.status = 'paid' then 'paid'
    else 'rejected'
  end;

  update public.notifications n
     set status = v_new_status,
         lu     = true
   where n.destinataire_id = new.coach_id
     and n.type   = v_notif_type
     and n.status = 'pending'
     and (
       (n.donnees ->> v_id_key) = v_id_val
       or ((n.donnees ->> v_id_key) is null and (n.donnees ->> v_fallback_key) = v_fallback_val)
     );

  return new;
end;
$$;

comment on function public.fn_sync_demand_notification() is
  '105 DB-2 — met à jour la notif course_request/stage_reservation quand la demande quitte pending.';

drop trigger if exists trg_sync_notif_course on public.course_demands;
create trigger trg_sync_notif_course
  after update of status on public.course_demands
  for each row execute function public.fn_sync_demand_notification();

drop trigger if exists trg_sync_notif_stage on public.stage_reservations;
create trigger trg_sync_notif_stage
  after update of status on public.stage_reservations
  for each row execute function public.fn_sync_demand_notification();

-- ── Backfill : résout les notifs pending dont la demande n'est plus pending ──
update public.notifications n
   set status = case
         when d.status in ('accepted','awaiting_payment','completed') then 'accepted'
         when d.status = 'paid' then 'paid'
         else 'rejected'
       end,
       lu = true
  from public.course_demands d
 where n.type = 'course_request'
   and n.status = 'pending'
   and d.coach_id = n.destinataire_id
   and d.status <> 'pending'
   and (
     (n.donnees ->> 'demandId') = d.id::text
     or ((n.donnees ->> 'demandId') is null and (n.donnees ->> 'annonceId') = d.annonce_id::text)
   );

update public.notifications n
   set status = case
         when r.status in ('accepted','awaiting_payment','completed') then 'accepted'
         when r.status = 'paid' then 'paid'
         else 'rejected'
       end,
       lu = true
  from public.stage_reservations r
 where n.type = 'stage_reservation'
   and n.status = 'pending'
   and r.coach_id = n.destinataire_id
   and r.status <> 'pending'
   and (
     (n.donnees ->> 'reservationId') = r.id::text
     or ((n.donnees ->> 'reservationId') is null and (n.donnees ->> 'stageId') = r.stage_id::text)
   );

commit;

-- ============================================================================
-- NB : les notifs "orphelines" (pending, aucune demande correspondante en base
-- — ex. 6 notifs stage_reservation de emilie.l dont le stage_id ne matche aucune
-- réservation) NE sont PAS touchées par ce backfill. Voir le SQL de nettoyage
-- séparé (proposals/cleanup_phantom_notifications.sql).
-- ============================================================================
