-- ============================================================================
-- HARNESS 090 — NOTIF PRÉSENCE CONCOURS · PR2b
-- ============================================================================
-- AUTO-PORTANT. POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_090
--   psql -d eq_harness_090 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/090_concours_presence_notify/harness.sql
--
--   1. schéma minimal (users/concours/followers/presence/notifications + sources
--      knowers : user_follows/conversations/réservations) ;
--   2. charge 090 (fichier réel) ;
--   3. tests audience (follow/messagerie/réservation), exclusions (inconnu, non-
--      follower, soi-même), règle 'going' only, promotion interested→going,
--      dédup, best-effort ;
--   4. rollback 090 réel + vérif propreté.
-- Triggers 090 = SECURITY DEFINER sans auth.uid() → exécutables en superuser.
-- ============================================================================

\set ON_ERROR_STOP on
\echo '=== [0] SETUP schéma minimal + seed ==='

create table public.users (
  id uuid primary key, prenom text, pseudo text, initiales text, avatar_color text,
  role text not null default 'cavalier'
);
create table public.concours (id uuid primary key, nom text);
create table public.concours_followers (
  concours_id uuid not null, user_id uuid not null references public.users(id),
  primary key (concours_id, user_id)
);
create table public.concours_presence (
  concours_id uuid not null, user_id uuid not null references public.users(id),
  status text not null default 'going', cheval_id uuid,
  primary key (concours_id, user_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  destinataire_id uuid not null references public.users(id),
  auteur_id uuid references public.users(id),
  type text not null, titre text not null, message text not null,
  action_url text, lien text, lu boolean not null default false,
  donnees jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- sources "knowers"
create table public.user_follows (follower_id uuid not null, followee_id uuid not null, primary key (follower_id, followee_id));
create table public.conversations (id uuid primary key default gen_random_uuid(), participant_a uuid, participant_b uuid);
create table public.box_reservations (id uuid primary key default gen_random_uuid(), buyer_id uuid, seller_id uuid);
create table public.stage_reservations (id uuid primary key default gen_random_uuid(), cavalier_id uuid, coach_id uuid);
create table public.course_demands (id uuid primary key default gen_random_uuid(), cavalier_id uuid, coach_id uuid);
create table public.transport_reservations (id uuid primary key default gen_random_uuid(), buyer_id uuid, seller_id uuid);

-- Acteurs : a1 = déclarant D. a2 le suit, a3 lui a parlé, a4 a réservé avec lui,
-- a5 inconnu, a6 le connaît mais ne suit pas le concours. c1 = concours.
insert into public.users(id, prenom, pseudo, initiales) values
  ('00000000-0000-0000-0000-0000000000a1','Diane','DianeCSO','DC'),
  ('00000000-0000-0000-0000-0000000000a2','Followeur','Fol','FO'),
  ('00000000-0000-0000-0000-0000000000a3','Messager','Msg','MS'),
  ('00000000-0000-0000-0000-0000000000a4','Client','Cli','CL'),
  ('00000000-0000-0000-0000-0000000000a5','Inconnu','Inc','IN'),
  ('00000000-0000-0000-0000-0000000000a6','ConnaitPasSuivi','Cps','CP');
insert into public.concours(id, nom) values ('00000000-0000-0000-0000-0000000000c1','CSO Deauville');

-- Followers du concours : a2,a3,a4,a5 ET a1 (déclarant, pour tester self-exclusion).
insert into public.concours_followers(concours_id, user_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a4'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a5'),
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1');

-- Relations "connaît a1" :
insert into public.user_follows(follower_id, followee_id) values
  ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1'), -- a2 suit a1
  ('00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-0000000000a1'); -- a6 suit a1 (mais ne suit PAS le concours)
insert into public.conversations(participant_a, participant_b) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a3'); -- a3 <-> a1
insert into public.box_reservations(buyer_id, seller_id) values
  ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-0000000000a1'); -- a4 <-> a1

\echo '=== [1] APPLICATION migration 090 + sanity ==='
\ir ../../migrations/090_concours_presence_notify.sql
do $$ begin
  if (select count(*) from pg_proc where proname='fn_notify_concours_presence') <> 1
    then raise exception 'FAIL: fonction 090 absente'; end if;
  if (select count(*) from pg_trigger where tgname='trg_zz_notify_concours_presence') <> 1
    then raise exception 'FAIL: trigger 090 absent'; end if;
  if (select count(*) from pg_indexes where indexname='uq_notifications_concours_presence') <> 1
    then raise exception 'FAIL: index dédup absent'; end if;
  raise notice 'PASS [1]: fn + trigger + index présents';
end $$;

\echo '=== [2] going INSERT : audience = a2(follow)+a3(msg)+a4(book) ; exclut a5/a6/self ==='
insert into public.concours_presence(concours_id, user_id, status)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','going');
do $$
declare n int; dest uuid[];
begin
  select count(*), array_agg(destinataire_id order by destinataire_id)
    into n, dest from public.notifications where type='concours_presence';
  if n <> 3 then raise exception 'FAIL [2]: % notifs (attendu 3)', n; end if;
  if dest <> array[
      '00000000-0000-0000-0000-0000000000a2',
      '00000000-0000-0000-0000-0000000000a3',
      '00000000-0000-0000-0000-0000000000a4']::uuid[]
    then raise exception 'FAIL [2]: destinataires = % (attendu a2,a3,a4)', dest; end if;
  -- vérifs payload sur une notif
  perform 1 from public.notifications
    where type='concours_presence' and destinataire_id='00000000-0000-0000-0000-0000000000a2'
      and auteur_id='00000000-0000-0000-0000-0000000000a1'
      and action_url='/concours/00000000-0000-0000-0000-0000000000c1'
      and donnees->>'presence_user_id'='00000000-0000-0000-0000-0000000000a1'
      and donnees->>'concours_id'='00000000-0000-0000-0000-0000000000c1'
      and message like 'DianeCSO%';
  if not found then raise exception 'FAIL [2]: payload/deep-link incorrect'; end if;
  raise notice 'PASS [2]: 3 notifs (a2 follow, a3 msg, a4 book) ; a5 inconnu, a6 non-follower, self exclus ; payload OK';
end $$;

\echo '=== [3] dédup : retoggle (delete + re-insert going) ne recrée PAS de 2e notif ==='
delete from public.concours_presence
  where concours_id='00000000-0000-0000-0000-0000000000c1' and user_id='00000000-0000-0000-0000-0000000000a1';
insert into public.concours_presence(concours_id, user_id, status)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','going');
do $$ declare n int; begin
  select count(*) into n from public.notifications where type='concours_presence';
  if n <> 3 then raise exception 'FAIL [3]: % notifs après retoggle (attendu 3, dédup)', n; end if;
  raise notice 'PASS [3]: dédup OK (retoggle → toujours 3)';
end $$;

\echo '=== [4] going→going (édition cheval) : pas de nouvelle notif ==='
update public.concours_presence set cheval_id=gen_random_uuid(), status='going'
  where concours_id='00000000-0000-0000-0000-0000000000c1' and user_id='00000000-0000-0000-0000-0000000000a1';
do $$ declare n int; begin
  select count(*) into n from public.notifications where type='concours_presence';
  if n <> 3 then raise exception 'FAIL [4]: % notifs après édition (attendu 3)', n; end if;
  raise notice 'PASS [4]: édition d''une présence déjà going ne re-notifie pas';
end $$;

\echo '=== [5] interested : AUCUNE notif ==='
insert into public.users(id, prenom, pseudo, initiales) values
  ('00000000-0000-0000-0000-0000000000b1','Bea','Bea','BE');
insert into public.concours_followers(concours_id, user_id)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b1');
insert into public.user_follows(follower_id, followee_id)
  values ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000b1'); -- a2 suit b1
insert into public.concours_presence(concours_id, user_id, status)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b1','interested');
do $$ declare n int; begin
  select count(*) into n from public.notifications
    where type='concours_presence' and donnees->>'presence_user_id'='00000000-0000-0000-0000-0000000000b1';
  if n <> 0 then raise exception 'FAIL [5]: interested a notifié (%)', n; end if;
  raise notice 'PASS [5]: interested ne notifie pas';
end $$;

\echo '=== [6] promotion interested→going : notifie (a2 suit b1) ==='
update public.concours_presence set status='going'
  where concours_id='00000000-0000-0000-0000-0000000000c1' and user_id='00000000-0000-0000-0000-0000000000b1';
do $$ declare n int; begin
  select count(*) into n from public.notifications
    where type='concours_presence' and donnees->>'presence_user_id'='00000000-0000-0000-0000-0000000000b1'
      and destinataire_id='00000000-0000-0000-0000-0000000000a2';
  if n <> 1 then raise exception 'FAIL [6]: promotion interested→going n''a pas notifié (%)', n; end if;
  raise notice 'PASS [6]: interested→going notifie a2';
end $$;

\echo '=== [7] best-effort : un échec du chemin notif ne bloque PAS la déclaration ==='
-- Trigger BEFORE INSERT sur notifications qui lève → le insert de notif échoue,
-- mais la présence 'going' doit quand même être persistée (exception avalée).
create function public.h_boom() returns trigger language plpgsql as $$
begin raise exception 'boom'; end $$;
create trigger h_boom_trg before insert on public.notifications for each row execute function public.h_boom();
insert into public.users(id, prenom, pseudo, initiales) values
  ('00000000-0000-0000-0000-0000000000b2','Cyril','Cyril','CY');
-- a2 est déjà follower du concours (setup) ; a2 suit b2 → a2 est audience de b2.
insert into public.user_follows(follower_id, followee_id)
  values ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000b2');
insert into public.concours_presence(concours_id, user_id, status)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b2','going');
do $$ begin
  if not exists (select 1 from public.concours_presence
    where concours_id='00000000-0000-0000-0000-0000000000c1' and user_id='00000000-0000-0000-0000-0000000000b2')
    then raise exception 'FAIL [7]: la déclaration a été bloquée par l''échec notif'; end if;
  raise notice 'PASS [7]: best-effort — présence persistée malgré échec notif';
end $$;
drop trigger h_boom_trg on public.notifications;
drop function public.h_boom();

\echo '=== [8] ROLLBACK 090 réel + vérif propreté ==='
\ir ../../migrations/090_concours_presence_notify_rollback.sql
do $$ begin
  if exists (select 1 from pg_proc where proname='fn_notify_concours_presence')
    then raise exception 'FAIL [8]: fonction non droppée'; end if;
  if exists (select 1 from pg_trigger where tgname='trg_zz_notify_concours_presence')
    then raise exception 'FAIL [8]: trigger non droppé'; end if;
  if exists (select 1 from pg_indexes where indexname='uq_notifications_concours_presence')
    then raise exception 'FAIL [8]: index non droppé'; end if;
  if exists (select 1 from public.notifications where type='concours_presence')
    then raise exception 'FAIL [8]: notifs concours_presence non purgées'; end if;
  raise notice 'PASS [8]: rollback propre (fn+trigger+index absents, notifs purgées)';
end $$;

\echo '=== HARNESS 090 TERMINÉ — tous les PASS ci-dessus ==='
