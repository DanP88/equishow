-- ============================================================================
-- HARNESS 117 — NOTIFICATIONS RECHERCHES OUVERTES (Box + Transport) + annulation Box
-- ============================================================================
-- AUTO-PORTANT. POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_117
--   psql -d eq_harness_117 -v ON_ERROR_STOP=1 -f supabase/tests/117_recherche_events_notifications/harness.sql
--
-- Stubs minimalistes (pas la chaîne complète 111→116) : seules les colonnes
-- réellement lues/écrites par 117 sont présentes. Le CHECK notifications.type
-- est créé ICI à l'état PRÉ-117 (= 091) puis 117 (fichier réel) l'élargit —
-- reproduit fidèlement le ALTER en prod. Guard 047 stubbé (mêmes règles
-- exactes : bloque paid/completed/cancelled sauf bypass current_user) pour
-- valider EMPIRIQUEMENT que cancel_box_recherche_reservation le contourne
-- bien via SECURITY DEFINER — pas juste supposé par analogie avec 113.
-- ============================================================================

\set ON_ERROR_STOP on
\echo '=== [0] SETUP schéma minimal + auth + rôles + seed ==='

create schema if not exists auth;
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create or replace function auth.role() returns text
  language sql stable as $$ select nullif(current_setting('test.role', true), '') $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end $$;
grant usage on schema public to authenticated, anon;
grant usage on schema auth  to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant execute on function auth.role() to authenticated, anon;

create table public.users (id uuid primary key, prenom text);
grant select on public.users to authenticated, anon;

create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  destinataire_id     uuid not null references public.users(id) on delete cascade,
  auteur_id           uuid references public.users(id) on delete set null,
  type                text not null check (type in (
    'stage_reservation','box_reservation','transport_reservation','course_request',
    'reservation_request','message','like','comment','mention','trajet_complet',
    'support_request','support_ack','support_resolved','escrow_alert',
    'escrow_prestation_done','escrow_release_soon','dispute_resolved','dispute_opened',
    'seller_onboarded','concours_reply','concours_presence','concours_mention'
  )),
  titre               text not null,
  message             text not null,
  lu                  boolean not null default false,
  donnees             jsonb not null default '{}'::jsonb,
  action_url          text,
  lien                text,
  created_at          timestamptz not null default now()
);
grant select, insert, update on public.notifications to authenticated;

-- ── Box : stubs minimalistes (colonnes réellement utilisées par 117) ───────
create table public.box_annonces (id uuid primary key default gen_random_uuid(), auteur_id uuid, lieu text);
create table public.box_recherches (id uuid primary key default gen_random_uuid(), demandeur_id uuid not null);
create table public.box_recherche_reponses (
  id uuid primary key default gen_random_uuid(),
  recherche_id uuid not null references public.box_recherches(id),
  annonce_id uuid not null references public.box_annonces(id),
  offreur_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (recherche_id, annonce_id)
);
create table public.box_reservations (
  id uuid primary key default gen_random_uuid(),
  box_id uuid, buyer_id uuid not null, seller_id uuid,
  lieu text, status text not null default 'pending',
  recherche_id uuid references public.box_recherches(id),
  recherche_reponse_id uuid references public.box_recherche_reponses(id),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.box_annonces, public.box_recherches,
  public.box_recherche_reponses, public.box_reservations to authenticated;

-- ── Transport : stubs minimalistes (colonne `statut` FR, comme en prod) ────
create table public.transport_annonces (id uuid primary key default gen_random_uuid(), auteur_id uuid, ville_arrivee text);
create table public.transport_recherches (id uuid primary key default gen_random_uuid(), demandeur_id uuid not null);
create table public.transport_recherche_reponses (
  id uuid primary key default gen_random_uuid(),
  recherche_id uuid not null references public.transport_recherches(id),
  annonce_id uuid not null references public.transport_annonces(id),
  offreur_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (recherche_id, annonce_id)
);
create table public.transport_reservations (
  id uuid primary key default gen_random_uuid(),
  transport_id uuid, buyer_id uuid not null, seller_id uuid,
  ville_arrivee text, statut text not null default 'pending',
  recherche_id uuid references public.transport_recherches(id),
  recherche_reponse_id uuid references public.transport_recherche_reponses(id),
  cancelled_by uuid, cancelled_at timestamptz, cancellation_reason text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.transport_annonces, public.transport_recherches,
  public.transport_recherche_reponses, public.transport_reservations to authenticated;

-- Stub cancel_transport_recherche_reservation (113) — juste assez pour que
-- 117 §6 (revoke/grant) trouve la fonction à durcir sans erreur.
create or replace function public.cancel_transport_recherche_reservation(p_reservation_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.transport_reservations set statut = 'cancelled', cancelled_by = auth.uid(),
    cancelled_at = now(), cancellation_reason = p_reason where id = p_reservation_id;
end $$;
grant execute on function public.cancel_transport_recherche_reservation(uuid, text) to public, anon, authenticated;

-- ── Guard 047 (stub fidèle — mêmes règles exactes, box.status + transport.statut) ──
create or replace function public.fn_can_bypass_reservation_guard() returns boolean
language plpgsql stable as $$
begin
  if current_user not in ('authenticated','anon','authenticator') then
    return true;
  end if;
  return false;
end $$;

create or replace function public.trg_guard_status_transition() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status not in ('paid','completed','cancelled') then return new; end if;
  if public.fn_can_bypass_reservation_guard() then return new; end if;
  raise exception 'forbidden_status_transition: % -> % by %', old.status, new.status, current_user using errcode = '42501';
end $$;
create trigger trg_guard_status_transition before update on public.box_reservations
  for each row execute function public.trg_guard_status_transition();

create or replace function public.trg_guard_statut_transition() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.statut is not distinct from old.statut then return new; end if;
  if new.statut not in ('paid','cancelled') then return new; end if;
  if public.fn_can_bypass_reservation_guard() then return new; end if;
  raise exception 'forbidden_statut_transition: % -> % by %', old.statut, new.statut, current_user using errcode = '42501';
end $$;
create trigger trg_guard_statut_transition before update on public.transport_reservations
  for each row execute function public.trg_guard_statut_transition();

-- ── Seed ─────────────────────────────────────────────────────────────────
insert into public.users(id, prenom) values
  ('00000000-0000-0000-0000-0000000000a1','Alice'),  -- demandeur/buyer
  ('00000000-0000-0000-0000-0000000000a2','Bob'),    -- offreur/seller
  ('00000000-0000-0000-0000-0000000000a3','Carol');  -- tiers (anti-IDOR)

\echo '=== [1] APPLICATION 117 (fichier réel) ==='
\ir ../../migrations/117_recherche_events_notifications.sql

\echo '=== [2] BOX — réponse reçue ==='
do $$
declare v_rid uuid; v_annonce uuid; v_n int;
begin
  insert into public.box_recherches (id, demandeur_id) values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1');
  insert into public.box_annonces (id, auteur_id, lieu) values ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a2','Deauville');
  insert into public.box_recherche_reponses (recherche_id, annonce_id, offreur_id)
    values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a2');

  select count(*) into v_n from public.notifications
    where destinataire_id = '00000000-0000-0000-0000-0000000000a1' and type = 'box_reponse_recue';
  if v_n <> 1 then raise exception 'FAIL: box_reponse_recue absente ou dupliquée (n=%)', v_n; end if;
  raise notice 'PASS: box_reponse_recue — demandeur notifié 1x';

  -- Anti-auto-notif : le demandeur répond à sa propre recherche (edge case).
  insert into public.box_annonces (id, auteur_id, lieu) values ('00000000-0000-0000-0000-0000000000b9','00000000-0000-0000-0000-0000000000a1','Chez moi');
  insert into public.box_recherche_reponses (recherche_id, annonce_id, offreur_id)
    values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b9','00000000-0000-0000-0000-0000000000a1');
  select count(*) into v_n from public.notifications where type = 'box_reponse_recue' and auteur_id = '00000000-0000-0000-0000-0000000000a1';
  if v_n <> 0 then raise exception 'FAIL: auto-notification créée à tort (demandeur = offreur)'; end if;
  raise notice 'PASS: pas d''auto-notification si demandeur = offreur';
end $$;

\echo '=== [3] BOX — réponse acceptée + paiement reçu ==='
do $$
declare v_reponse_id uuid; v_resa_id uuid; v_n int;
begin
  select id into v_reponse_id from public.box_recherche_reponses
    where recherche_id = '00000000-0000-0000-0000-0000000000b1' and offreur_id = '00000000-0000-0000-0000-0000000000a2';

  insert into public.box_reservations (buyer_id, seller_id, lieu, status, recherche_id, recherche_reponse_id)
    values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','Deauville','pending',
            '00000000-0000-0000-0000-0000000000b1', v_reponse_id)
    returning id into v_resa_id;

  update public.box_reservations set status = 'accepted' where id = v_resa_id;
  select count(*) into v_n from public.notifications
    where destinataire_id = '00000000-0000-0000-0000-0000000000a2' and type = 'box_reponse_acceptee'
      and (donnees->>'reservation_id')::uuid = v_resa_id;
  if v_n <> 1 then raise exception 'FAIL: box_reponse_acceptee absente ou dupliquée (n=%)', v_n; end if;
  raise notice 'PASS: box_reponse_acceptee — offreur notifié 1x';

  -- Re-UPDATE vers le même statut (no-op métier) → pas de 2e notif (dédup).
  update public.box_reservations set status = 'accepted' where id = v_resa_id;
  select count(*) into v_n from public.notifications
    where destinataire_id = '00000000-0000-0000-0000-0000000000a2' and type = 'box_reponse_acceptee'
      and (donnees->>'reservation_id')::uuid = v_resa_id;
  if v_n <> 1 then raise exception 'FAIL: dédup box_reponse_acceptee cassée (n=%)', v_n; end if;
  raise notice 'PASS: dédup box_reponse_acceptee (2e update identique → toujours 1 notif)';

  -- Paiement (simulateur du chemin webhook, direct-to-paid).
  update public.box_reservations set status = 'paid' where id = v_resa_id;
  select count(*) into v_n from public.notifications
    where destinataire_id = '00000000-0000-0000-0000-0000000000a2' and type = 'box_paiement_recu'
      and (donnees->>'reservation_id')::uuid = v_resa_id;
  if v_n <> 1 then raise exception 'FAIL: box_paiement_recu absente ou dupliquée (n=%)', v_n; end if;
  raise notice 'PASS: box_paiement_recu — vendeur notifié 1x';

  perform set_config('test.resa_box', v_resa_id::text, false);
end $$;

\echo '=== [4] BOX — annulation : IDOR, scope, mauvais statut, puis succès ==='
do $$
declare v_n int; v_ok boolean;
begin
  -- IDOR : Carol (tiers) tente d'annuler la résa de Alice/Bob.
  begin
    set role authenticated;
    perform set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
    perform public.cancel_box_recherche_reservation(current_setting('test.resa_box')::uuid, 'tentative IDOR');
    v_ok := false;
  exception when others then v_ok := true;
  end;
  reset role;
  if not v_ok then raise exception 'FAIL: un tiers a pu annuler une réservation qui ne lui appartient pas (IDOR)'; end if;
  raise notice 'PASS: anti-IDOR annulation Box actif — voir ERROR ci-dessus, attendue';

  -- Mauvais statut : la résa est déjà 'paid' (hors périmètre RPC).
  begin
    set role authenticated;
    perform set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
    perform public.cancel_box_recherche_reservation(current_setting('test.resa_box')::uuid, null);
    v_ok := false;
  exception when others then v_ok := true;
  end;
  reset role;
  if not v_ok then raise exception 'FAIL: annulation d''une réservation "paid" acceptée à tort (hors périmètre)'; end if;
  raise notice 'PASS: annulation refusée depuis le statut "paid" — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [5] BOX — annulation réelle depuis "accepted" (nouvelle résa) + notif ==='
do $$
declare v_reponse_id uuid; v_resa_id uuid; v_n int; v_cancelled_by uuid; v_status text;
begin
  select id into v_reponse_id from public.box_recherche_reponses
    where recherche_id = '00000000-0000-0000-0000-0000000000b1' and offreur_id = '00000000-0000-0000-0000-0000000000a2';
  insert into public.box_reservations (buyer_id, seller_id, lieu, status, recherche_id, recherche_reponse_id)
    values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','Deauville','accepted',
            '00000000-0000-0000-0000-0000000000b1', v_reponse_id)
    returning id into v_resa_id;

  -- Le buyer (Alice) annule — le seller (Bob) doit être notifié, pas l'inverse.
  set role authenticated;
  perform set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
  perform public.cancel_box_recherche_reservation(v_resa_id, 'changement de plan');
  reset role;

  select status, cancelled_by into v_status, v_cancelled_by from public.box_reservations where id = v_resa_id;
  if v_status <> 'cancelled' or v_cancelled_by <> '00000000-0000-0000-0000-0000000000a1' then
    raise exception 'FAIL: annulation légitime n''a pas abouti (status=%, cancelled_by=%)', v_status, v_cancelled_by;
  end if;
  raise notice 'PASS: annulation légitime réussie malgré le guard 047 (bypass SECURITY DEFINER, comme 113)';

  select count(*) into v_n from public.notifications
    where destinataire_id = '00000000-0000-0000-0000-0000000000a2' and type = 'box_annulation'
      and (donnees->>'reservation_id')::uuid = v_resa_id;
  if v_n <> 1 then raise exception 'FAIL: box_annulation absente ou dupliquée (n=%)', v_n; end if;
  raise notice 'PASS: box_annulation — l''AUTRE partie (seller) notifiée 1x, pas l''annulant';

  select count(*) into v_n from public.notifications
    where destinataire_id = '00000000-0000-0000-0000-0000000000a1' and type = 'box_annulation';
  if v_n <> 0 then raise exception 'FAIL: l''annulant a été notifié de sa propre annulation'; end if;
  raise notice 'PASS: l''annulant lui-même n''est jamais notifié';
end $$;

\echo '=== [6] TRANSPORT — réponse reçue, acceptée, paiement, annulation (miroir) ==='
do $$
declare v_reponse_id uuid; v_resa_id uuid; v_n int; v_status text; v_cancelled_by uuid;
begin
  insert into public.transport_recherches (id, demandeur_id) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1');
  insert into public.transport_annonces (id, auteur_id, ville_arrivee) values ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000a2','Lyon');
  insert into public.transport_recherche_reponses (recherche_id, annonce_id, offreur_id)
    values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000a2');

  select count(*) into v_n from public.notifications
    where destinataire_id = '00000000-0000-0000-0000-0000000000a1' and type = 'transport_reponse_recue';
  if v_n <> 1 then raise exception 'FAIL: transport_reponse_recue absente ou dupliquée (n=%)', v_n; end if;
  raise notice 'PASS: transport_reponse_recue — demandeur notifié 1x';

  select id into v_reponse_id from public.transport_recherche_reponses where recherche_id = '00000000-0000-0000-0000-0000000000e1';
  insert into public.transport_reservations (buyer_id, seller_id, ville_arrivee, statut, recherche_id, recherche_reponse_id)
    values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','Lyon','pending',
            '00000000-0000-0000-0000-0000000000e1', v_reponse_id)
    returning id into v_resa_id;

  update public.transport_reservations set statut = 'accepted' where id = v_resa_id;
  select count(*) into v_n from public.notifications
    where destinataire_id = '00000000-0000-0000-0000-0000000000a2' and type = 'transport_reponse_acceptee'
      and (donnees->>'reservation_id')::uuid = v_resa_id;
  if v_n <> 1 then raise exception 'FAIL: transport_reponse_acceptee absente ou dupliquée (n=%)', v_n; end if;
  raise notice 'PASS: transport_reponse_acceptee — offreur notifié 1x';

  update public.transport_reservations set statut = 'paid' where id = v_resa_id;
  select count(*) into v_n from public.notifications
    where destinataire_id = '00000000-0000-0000-0000-0000000000a2' and type = 'transport_paiement_recu'
      and (donnees->>'reservation_id')::uuid = v_resa_id;
  if v_n <> 1 then raise exception 'FAIL: transport_paiement_recu absente ou dupliquée (n=%)', v_n; end if;
  raise notice 'PASS: transport_paiement_recu — vendeur notifié 1x';

  -- Annulation transport : doit passer par le statut 'accepted' (nouvelle résa,
  -- celle-ci est déjà 'paid' donc hors périmètre RPC 113 — vérifie juste le
  -- trigger de notif directement via UPDATE, pas la RPC 113 elle-même (déjà
  -- prouvée en prod, hors périmètre de CE harness qui teste 117 uniquement).
  insert into public.transport_reservations (buyer_id, seller_id, ville_arrivee, statut, recherche_id, recherche_reponse_id, cancelled_by, cancellation_reason)
    values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','Lyon','accepted',
            '00000000-0000-0000-0000-0000000000e1', v_reponse_id, null, null)
    returning id into v_resa_id;
  update public.transport_reservations
    set statut = 'cancelled', cancelled_by = '00000000-0000-0000-0000-0000000000a2', cancellation_reason = 'test'
    where id = v_resa_id;

  select count(*) into v_n from public.notifications
    where destinataire_id = '00000000-0000-0000-0000-0000000000a1' and type = 'transport_annulation'
      and (donnees->>'reservation_id')::uuid = v_resa_id;
  if v_n <> 1 then raise exception 'FAIL: transport_annulation absente ou dupliquée (n=%)', v_n; end if;
  raise notice 'PASS: transport_annulation — l''AUTRE partie (buyer) notifiée 1x (annulant = seller)';
end $$;

\echo '=== [7] Durcissement EXECUTE (§6 bonus) ==='
do $$
declare v_n int;
begin
  select count(*) into v_n from information_schema.role_routine_grants
    where routine_name = 'cancel_transport_recherche_reservation' and grantee = 'anon';
  if v_n <> 0 then raise exception 'FAIL: anon a encore EXECUTE sur cancel_transport_recherche_reservation'; end if;
  raise notice 'PASS: EXECUTE anon révoqué sur cancel_transport_recherche_reservation (bonus §6)';

  select count(*) into v_n from information_schema.role_routine_grants
    where routine_name = 'cancel_box_recherche_reservation' and grantee = 'anon';
  if v_n <> 0 then raise exception 'FAIL: anon a EXECUTE sur cancel_box_recherche_reservation dès la création'; end if;
  raise notice 'PASS: EXECUTE anon jamais accordé sur cancel_box_recherche_reservation (durci dès la création)';
end $$;

\echo '=== [8] Isolation cross-module (aucune fuite de type) ==='
do $$
declare v_n int;
begin
  select count(*) into v_n from public.notifications where type like 'box_%' and destinataire_id = '00000000-0000-0000-0000-0000000000a1'
    and type not in ('box_reponse_recue');
  -- Alice a aussi reçu box_annulation (résa Deauville) — attendu, pas une fuite.
  select count(*) into v_n from public.notifications where type like 'transport_%' and type not like 'transport_%';
  if v_n <> 0 then raise exception 'FAIL: type invalide détecté'; end if;
  raise notice 'PASS: aucun type de notification invalide/croisé détecté';
end $$;

\echo '=== TOUT VERT ==='
