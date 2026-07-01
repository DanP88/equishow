-- ============================================================================
-- HARNESS 062 — F1 ANTI-SURBOOKING STAGE + BOX (+ non-régression Coach/Transport)
-- ============================================================================
-- Clôture de dette : PROUVE que le fix symétrique 062 (Stage+Box), déjà appliqué
-- en prod, protège contre le surbooking sur TOUTES les arêtes d'entrée dans
-- l'ensemble consommant S = {accepted, awaiting_payment, paid, completed}.
--
-- AUTO-PORTANT. POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_062
--   psql -d eq_harness_062 -v ON_ERROR_STOP=1 \
--        -f supabase/tests/062_availability_stage_box/harness.sql
--
-- Charge les CORPS RÉELS de prod (fichiers migrations, non recopiés) :
--   053 (base : 4 fns + 4 triggers + guards) → 060 (transport symétrique)
--   → 062 (stage/box symétrique) → 057 (coach slot capacity).
-- Les triggers d'availability sont SECURITY DEFINER et n'utilisent pas auth.uid()
--   → tests exécutés en superuser, sans RLS ni guard 047 (non attaché ici).
-- Chaque échec => RAISE EXCEPTION ; sinon RAISE NOTICE 'PASS …'.
-- Test-only : n'ajoute AUCUN objet runtime, ne modifie AUCUN code métier.
-- ============================================================================

\set ON_ERROR_STOP on
\echo '=== [0] SETUP schéma minimal (stage/box/transport/coach) + auth stubs ==='

create schema if not exists auth;
create or replace function auth.uid()  returns uuid language sql stable as $$ select null::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;

-- ── STAGE ────────────────────────────────────────────────────────────────
create table public.stages (
  id uuid primary key, titre text, places int not null, places_disponibles int not null
);
create table public.stage_reservations (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stages(id),
  status text not null default 'pending',
  nb_participants int not null default 1,
  accepted_at timestamptz
);

-- ── BOX ──────────────────────────────────────────────────────────────────
create table public.box_annonces (id uuid primary key, nb_boxes int not null);
create table public.box_reservations (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references public.box_annonces(id),
  status text not null default 'pending',
  date_debut date not null,
  date_fin date not null,
  accepted_at timestamptz
);

-- ── TRANSPORT ──────────────────────────────────────────────────────────────
create table public.transport_annonces (
  id uuid primary key, type_transport text not null, nb_places_disponibles int not null
);
create table public.transport_reservations (
  id uuid primary key default gen_random_uuid(),
  transport_id uuid not null references public.transport_annonces(id),
  statut text not null default 'pending',
  nb_places int not null default 1,
  accepted_at timestamptz
);

-- ── COACH ──────────────────────────────────────────────────────────────────
create table public.coach_annonces (id uuid primary key, places_disponibles int);
create table public.course_demands (
  id uuid primary key default gen_random_uuid(),
  annonce_id uuid not null references public.coach_annonces(id),
  status text not null default 'pending',
  date_debut date not null,
  date_fin date not null,
  accepted_at timestamptz
);

\echo '=== [1] CHARGEMENT des corps prod : 053 → 060 → 062 → 057 ==='
\ir ../../migrations/053_availability_triggers.sql
\ir ../../migrations/060_fix_availability_transport_symmetric.sql
\ir ../../migrations/062_fix_availability_stage_box_symmetric.sql
\ir ../../migrations/057_coach_slot_capacity.sql

-- Sanity : les corps stage/box en test = bien la version symétrique (062).
do $$ begin
  if (select count(*) from pg_proc where proname='fn_availability_stage' and prosrc like '%c_consuming%') <> 1
     or (select count(*) from pg_proc where proname='fn_availability_box' and prosrc like '%c_consuming%') <> 1 then
    raise exception 'FAIL: corps stage/box non symétriques (062 non chargé)';
  end if;
  raise notice 'PASS: corps stage+box = version symétrique 062';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- STAGE
-- ════════════════════════════════════════════════════════════════════════════
\echo '=== [S1] STAGE réservation simple (pending→accepted consomme nb_participants) ==='
insert into public.stages(id,titre,places,places_disponibles)
  values ('00000000-0000-0000-0000-0000000000e1','Stage CSO',5,5);
insert into public.stage_reservations(id,stage_id,status,nb_participants)
  values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','pending',2);
update public.stage_reservations set status='accepted' where id='00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if (select places_disponibles from public.stages where id='00000000-0000-0000-0000-0000000000e1') <> 3
    then raise exception 'FAIL S1: dispo attendue 3'; end if;
  if (select accepted_at from public.stage_reservations where id='00000000-0000-0000-0000-0000000000a1') is null
    then raise exception 'FAIL S1: accepted_at non posé'; end if;
  raise notice 'PASS S1: dispo 5→3, accepted_at posé';
end $$;

\echo '=== [S2] STAGE remboursement / arête bug pending→paid (webhook, saute accepted) ==='
-- LE scénario du bug : entrée directe pending→paid doit CONSOMMER.
insert into public.stage_reservations(id,stage_id,status,nb_participants)
  values ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000e1','pending',1);
update public.stage_reservations set status='paid' where id='00000000-0000-0000-0000-0000000000a2';
do $$ begin
  if (select places_disponibles from public.stages where id='00000000-0000-0000-0000-0000000000e1') <> 2
    then raise exception 'FAIL S2: pending→paid n''a pas consommé (surbooking)'; end if;
  raise notice 'PASS S2: pending→paid consomme (dispo 3→2)';
end $$;
-- remboursement paid→cancelled restitue 1:1
update public.stage_reservations set status='cancelled' where id='00000000-0000-0000-0000-0000000000a2';
do $$ begin
  if (select places_disponibles from public.stages where id='00000000-0000-0000-0000-0000000000e1') <> 3
    then raise exception 'FAIL S2: remboursement n''a pas restitué'; end if;
  raise notice 'PASS S2: paid→cancelled restitue (dispo 2→3)';
end $$;

\echo '=== [S3] STAGE capacité maximale + garde concurrence (UPDATE conditionnel atomique) ==='
-- dispo=3. Accepter nb=2 → dispo=1. Puis nb=2 → refus (garde atomique >= v_qty).
insert into public.stage_reservations(id,stage_id,status,nb_participants)
  values ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000e1','pending',2),
         ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-0000000000e1','pending',2);
update public.stage_reservations set status='accepted' where id='00000000-0000-0000-0000-0000000000a3';
do $$ begin
  if (select places_disponibles from public.stages where id='00000000-0000-0000-0000-0000000000e1') <> 1
    then raise exception 'FAIL S3: dispo attendue 1'; end if;
  begin
    update public.stage_reservations set status='accepted' where id='00000000-0000-0000-0000-0000000000a4';
    raise exception 'FAIL S3: surbooking accepté (dispo 1 < qty 2)';
  exception when check_violation then raise notice 'PASS S3: stage_capacite_insuffisante (dispo 1 < 2)';
  end;
end $$;

\echo '=== [S4] STAGE annulation d''une résa consommante restitue ; pending→cancelled = PAS de place fantôme ==='
-- a3 (accepted, nb=2) annulée → dispo 1→3.
update public.stage_reservations set status='cancelled' where id='00000000-0000-0000-0000-0000000000a3';
do $$ begin
  if (select places_disponibles from public.stages where id='00000000-0000-0000-0000-0000000000e1') <> 3
    then raise exception 'FAIL S4: annulation accepted n''a pas restitué'; end if;
  raise notice 'PASS S4: accepted→cancelled restitue (dispo 1→3)';
end $$;
-- a4 (jamais consommé : encore pending) → cancelled : AUCUNE restitution (anti-fantôme).
update public.stage_reservations set status='cancelled' where id='00000000-0000-0000-0000-0000000000a4';
do $$ begin
  if (select places_disponibles from public.stages where id='00000000-0000-0000-0000-0000000000e1') <> 3
    then raise exception 'FAIL S4: pending→cancelled a créé une place fantôme'; end if;
  raise notice 'PASS S4: pending→cancelled = pas de place fantôme (dispo reste 3)';
end $$;

\echo '=== [S5] STAGE expiration : awaiting_payment→payment_expired restitue ==='
insert into public.stage_reservations(id,stage_id,status,nb_participants)
  values ('00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000e1','pending',1);
update public.stage_reservations set status='awaiting_payment' where id='00000000-0000-0000-0000-0000000000a5';
do $$ begin
  if (select places_disponibles from public.stages where id='00000000-0000-0000-0000-0000000000e1') <> 2
    then raise exception 'FAIL S5: awaiting_payment n''a pas consommé'; end if;
  raise notice 'PASS S5: pending→awaiting_payment consomme (dispo 3→2)';
end $$;
update public.stage_reservations set status='payment_expired' where id='00000000-0000-0000-0000-0000000000a5';
do $$ begin
  if (select places_disponibles from public.stages where id='00000000-0000-0000-0000-0000000000e1') <> 3
    then raise exception 'FAIL S5: expiration n''a pas restitué'; end if;
  raise notice 'PASS S5: awaiting_payment→payment_expired restitue (dispo 2→3)';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- BOX
-- ════════════════════════════════════════════════════════════════════════════
\echo '=== [B1] BOX réservation simple (contrôle chevauchement à l''entrée dans S) ==='
insert into public.box_annonces(id,nb_boxes) values ('00000000-0000-0000-0000-0000000000b0',1);
insert into public.box_reservations(id,box_id,status,date_debut,date_fin)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b0','pending','2026-07-10','2026-07-12');
update public.box_reservations set status='accepted' where id='00000000-0000-0000-0000-0000000000c1';
do $$ begin
  if (select accepted_at from public.box_reservations where id='00000000-0000-0000-0000-0000000000c1') is null
    then raise exception 'FAIL B1: accepted_at non posé'; end if;
  raise notice 'PASS B1: box acceptée (cap 1, 0 concurrente)';
end $$;

\echo '=== [B2] BOX capacité max / concurrence : 2e résa qui chevauche refusée (cap=1) ==='
insert into public.box_reservations(id,box_id,status,date_debut,date_fin)
  values ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000b0','pending','2026-07-11','2026-07-13');
do $$ begin
  begin
    update public.box_reservations set status='accepted' where id='00000000-0000-0000-0000-0000000000c2';
    raise exception 'FAIL B2: chevauchement accepté (surbooking box)';
  exception when check_violation then raise notice 'PASS B2: box_conflit_periode (chevauchement refusé)';
  end;
end $$;

\echo '=== [B3] BOX awaiting_payment occupe la box (pas de surbooking pendant fenêtre Stripe) ==='
-- Nouvelle box cap=1. A pending→awaiting_payment (occupe). B chevauche → refus.
insert into public.box_annonces(id,nb_boxes) values ('00000000-0000-0000-0000-0000000000b1',1);
insert into public.box_reservations(id,box_id,status,date_debut,date_fin)
  values ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000b1','pending','2026-08-01','2026-08-03'),
         ('00000000-0000-0000-0000-0000000000c4','00000000-0000-0000-0000-0000000000b1','pending','2026-08-02','2026-08-04');
update public.box_reservations set status='awaiting_payment' where id='00000000-0000-0000-0000-0000000000c3';
do $$ begin
  begin
    update public.box_reservations set status='accepted' where id='00000000-0000-0000-0000-0000000000c4';
    raise exception 'FAIL B3: chevauchement accepté alors qu''awaiting_payment occupe';
  exception when check_violation then raise notice 'PASS B3: awaiting_payment compte dans l''occupation';
  end;
end $$;

\echo '=== [B4] BOX annulation libère (implicite) → le créneau redevient réservable ==='
-- c3 awaiting_payment→cancelled (remboursement/abandon) quitte S ; c4 devient acceptable.
update public.box_reservations set status='cancelled' where id='00000000-0000-0000-0000-0000000000c3';
update public.box_reservations set status='accepted'  where id='00000000-0000-0000-0000-0000000000c4';
do $$ begin
  if (select status from public.box_reservations where id='00000000-0000-0000-0000-0000000000c4') <> 'accepted'
    then raise exception 'FAIL B4: c4 non acceptée après libération de c3'; end if;
  raise notice 'PASS B4: sortie de S libère le créneau (c4 acceptée)';
end $$;

\echo '=== [B5] BOX capacité 2 : deux chevauchantes OK, la 3e refusée ; non-chevauchante OK ==='
insert into public.box_annonces(id,nb_boxes) values ('00000000-0000-0000-0000-0000000000b2',2);
insert into public.box_reservations(id,box_id,status,date_debut,date_fin) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000b2','pending','2026-09-01','2026-09-05'),
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000b2','pending','2026-09-02','2026-09-04'),
  ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000b2','pending','2026-09-03','2026-09-06'),
  ('00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-0000000000b2','pending','2026-12-01','2026-12-02');
update public.box_reservations set status='paid'     where id='00000000-0000-0000-0000-0000000000d1'; -- pending→paid direct
update public.box_reservations set status='accepted' where id='00000000-0000-0000-0000-0000000000d2';
do $$ begin
  begin
    update public.box_reservations set status='accepted' where id='00000000-0000-0000-0000-0000000000d3';
    raise exception 'FAIL B5: 3e chevauchante acceptée (cap 2 dépassée)';
  exception when check_violation then raise notice 'PASS B5: 3e chevauchante refusée (cap 2)';
  end;
  -- non-chevauchante (décembre) doit passer même box pleine sur septembre
  update public.box_reservations set status='accepted' where id='00000000-0000-0000-0000-0000000000d4';
  if (select status from public.box_reservations where id='00000000-0000-0000-0000-0000000000d4') <> 'accepted'
    then raise exception 'FAIL B5: non-chevauchante refusée à tort'; end if;
  raise notice 'PASS B5: pending→paid contrôlé + non-chevauchante OK';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- COACH (non-régression 057 : capacité créneau + advisory lock)
-- ════════════════════════════════════════════════════════════════════════════
\echo '=== [C1] COACH créneau cap=1 : 2e demande même créneau refusée ; autre créneau OK ==='
insert into public.coach_annonces(id,places_disponibles) values ('00000000-0000-0000-0000-000000000091',1);
insert into public.course_demands(id,annonce_id,status,date_debut,date_fin) values
  ('00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000091','pending','2026-07-20','2026-07-20'),
  ('00000000-0000-0000-0000-000000000072','00000000-0000-0000-0000-000000000091','pending','2026-07-20','2026-07-20'),
  ('00000000-0000-0000-0000-000000000073','00000000-0000-0000-0000-000000000091','pending','2026-07-21','2026-07-21');
update public.course_demands set status='accepted' where id='00000000-0000-0000-0000-000000000071';
do $$ begin
  begin
    update public.course_demands set status='accepted' where id='00000000-0000-0000-0000-000000000072';
    raise exception 'FAIL C1: 2e demande même créneau acceptée (double-booking)';
  exception when exclusion_violation then raise notice 'PASS C1: coach_slot_full (créneau complet)';
  end;
  -- autre date = créneau indépendant → OK
  update public.course_demands set status='accepted' where id='00000000-0000-0000-0000-000000000073';
  if (select status from public.course_demands where id='00000000-0000-0000-0000-000000000073') <> 'accepted'
    then raise exception 'FAIL C1: créneau distinct refusé à tort'; end if;
  raise notice 'PASS C1: créneau distinct indépendant (accepté)';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- TRANSPORT (non-régression 060 : compteur symétrique, location early-return)
-- ════════════════════════════════════════════════════════════════════════════
\echo '=== [T1] TRANSPORT trajet : pending→paid consomme ; surbooking refusé ; remboursement restitue ==='
insert into public.transport_annonces(id,type_transport,nb_places_disponibles)
  values ('00000000-0000-0000-0000-000000000081','trajet',3);
insert into public.transport_reservations(id,transport_id,statut,nb_places) values
  ('00000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000081','pending',2),
  ('00000000-0000-0000-0000-000000000062','00000000-0000-0000-0000-000000000081','pending',2);
update public.transport_reservations set statut='paid' where id='00000000-0000-0000-0000-000000000061'; -- saute accepted
do $$ begin
  if (select nb_places_disponibles from public.transport_annonces where id='00000000-0000-0000-0000-000000000081') <> 1
    then raise exception 'FAIL T1: pending→paid n''a pas consommé'; end if;
  begin
    update public.transport_reservations set statut='paid' where id='00000000-0000-0000-0000-000000000062';
    raise exception 'FAIL T1: surbooking transport accepté (1 < 2)';
  exception when check_violation then raise notice 'PASS T1: transport_capacite_insuffisante (1 < 2)';
  end;
end $$;
update public.transport_reservations set statut='cancelled' where id='00000000-0000-0000-0000-000000000061';
do $$ begin
  if (select nb_places_disponibles from public.transport_annonces where id='00000000-0000-0000-0000-000000000081') <> 3
    then raise exception 'FAIL T1: remboursement transport n''a pas restitué'; end if;
  raise notice 'PASS T1: paid→cancelled restitue (dispo 1→3)';
end $$;

\echo '=== [T2] TRANSPORT location : early-return, aucun compteur touché ==='
insert into public.transport_annonces(id,type_transport,nb_places_disponibles)
  values ('00000000-0000-0000-0000-000000000082','location',0);
insert into public.transport_reservations(id,transport_id,statut,nb_places)
  values ('00000000-0000-0000-0000-000000000063','00000000-0000-0000-0000-000000000082','pending',1);
-- même avec dispo=0, une location ne déclenche jamais transport_capacite_insuffisante
update public.transport_reservations set statut='paid' where id='00000000-0000-0000-0000-000000000063';
do $$ begin
  if (select nb_places_disponibles from public.transport_annonces where id='00000000-0000-0000-0000-000000000082') <> 0
    then raise exception 'FAIL T2: location a touché le compteur'; end if;
  raise notice 'PASS T2: location early-return (compteur intact, pas de raise)';
end $$;

\echo '=== HARNESS 062 TERMINÉ — tous les PASS ci-dessus (Stage/Box/Coach/Transport) ==='
