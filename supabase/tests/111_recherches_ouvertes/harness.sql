-- ============================================================================
-- HARNESS 111 — RECHERCHES OUVERTES, DESIGN MULTI-CHEVAUX (pilote Transport)
-- ============================================================================
-- AUTO-PORTANT. POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_111
--   psql -d eq_harness_111 -v ON_ERROR_STOP=1 -f supabase/tests/111_recherches_ouvertes/harness.sql
--
-- Charge la VRAIE chaîne de dépendance 088→089→110 (fichiers réels), puis
-- des STUBS minimalistes pour transport_annonces/transport_reservations
-- (+ triggers recalc/availability MIMIQUANT 051/053, pas les fichiers réels —
-- charger toute la chaîne 004→053 serait disproportionné pour ce harness ;
-- ces stubs ne re-testent PAS 051/053 eux-mêmes, ils valident que LA RPC 111
-- interagit correctement AVEC un trigger qui se comporte comme documenté).
-- box_annonces/box_reservations/coach_annonces/course_demands : stubs
-- minimalistes (colonnes suffisantes pour les FK), sans trigger — la RPC
-- Box/Coach n'existe pas encore dans cette migration (périmètre Transport
-- pilote uniquement, comme convenu).
--
-- IMPORTANT (piège psql découvert en session) : psql ne substitue PAS les
-- `:'var'` à l'intérieur d'un bloc `do $$ ... $$` (littéral dollar-quoté,
-- traité comme une vraie string). Toute valeur dynamique (ex. un id de
-- réservation retourné par la RPC via \gset) nécessaire DANS un bloc do doit
-- passer par un GUC de session : `select set_config('test.x', :'var', false);`
-- puis, dans le bloc do, `current_setting('test.x')::uuid`.
-- ============================================================================

\set ON_ERROR_STOP on
\echo '=== [0] SETUP schéma minimal + auth + rôles + seed ==='

create schema if not exists auth;
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end $$;
grant usage on schema public to authenticated, anon;
grant usage on schema auth  to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

create table public.users (id uuid primary key, prenom text, role text default 'cavalier');
grant select on public.users to authenticated, anon;
create table public.concours (id uuid primary key, nom text);
create table public.chevaux (id uuid primary key, proprietaire_id uuid, nom text not null);
grant select, insert, update, delete on public.chevaux to authenticated;

-- Stubs annonces/réservations (colonnes minimales requises par 111 + triggers stub).
create table public.transport_annonces (
  id uuid primary key default gen_random_uuid(),
  auteur_id uuid not null, type_transport text not null default 'trajet',
  ville_depart text, ville_arrivee text,
  nb_places_disponibles int not null default 1, prix_ht numeric not null default 50
);
create table public.transport_reservations (
  id uuid primary key default gen_random_uuid(),
  transport_id uuid references public.transport_annonces(id) on delete set null,
  buyer_id uuid, seller_id uuid, titre text, ville_depart text, ville_arrivee text,
  nb_places int, message text, cheval_id uuid,
  prix_total_ht numeric, commission_plateforme numeric, prix_total_ttc numeric,
  statut text default 'pending', date_creation timestamptz default now()
);
create table public.box_annonces (id uuid primary key default gen_random_uuid(), auteur_id uuid not null, nb_boxes_disponibles int default 1, prix_nuit_ht numeric default 20);
create table public.box_reservations (id uuid primary key default gen_random_uuid(), box_id uuid, buyer_id uuid, seller_id uuid, status text default 'pending');
create table public.coach_annonces (id uuid primary key default gen_random_uuid(), auteur_id uuid not null, places_disponibles int default 1, prix_heure_ttc numeric default 45);
create table public.course_demands (id uuid primary key default gen_random_uuid(), annonce_id uuid, coach_id uuid, cavalier_id uuid, status text default 'pending');
-- Grants (en prod, Supabase les accorde par défaut au bootstrap projet ;
-- ce harness jetable doit le répliquer pour que les sous-requêtes RLS
-- (qui s'exécutent sous le rôle appelant, pas sous le propriétaire de la RPC)
-- puissent lire ces tables.
grant select on public.transport_annonces, public.box_annonces, public.coach_annonces to authenticated;
grant select, insert, update on public.transport_reservations, public.box_reservations, public.course_demands to authenticated;

-- Stub trigger recalc (mimique 051 recalc_transport_amounts, cas 'trajet').
create or replace function public.recalc_transport_amounts() returns trigger
language plpgsql as $$
declare v_prix numeric; v_auteur uuid;
begin
  select prix_ht, auteur_id into v_prix, v_auteur from public.transport_annonces where id = new.transport_id;
  if v_prix is null or v_prix <= 0 then
    raise exception 'invalid prix_ht for transport_annonce % (must be > 0)', new.transport_id;
  end if;
  if new.nb_places is null or new.nb_places <= 0 then
    raise exception 'invalid nb_places % (must be > 0)', new.nb_places;
  end if;
  new.seller_id := v_auteur;
  new.prix_total_ht := round(v_prix * new.nb_places, 2);
  new.commission_plateforme := round(new.prix_total_ht * 0.09, 2);
  new.prix_total_ttc := new.prix_total_ht + new.commission_plateforme;
  return new;
end $$;
create trigger trg_transport_reservations_recalc
  before insert or update of transport_id, nb_places, seller_id, prix_total_ht, prix_total_ttc, commission_plateforme
  on public.transport_reservations for each row execute function public.recalc_transport_amounts();

-- Stub trigger disponibilité (mimique 053 fn_availability_transport).
create or replace function public.fn_availability_transport() returns trigger
language plpgsql as $$
declare v_qty int;
begin
  if new.statut = 'accepted' and old.statut = 'pending' then
    v_qty := coalesce(new.nb_places, 0);
    update public.transport_annonces set nb_places_disponibles = nb_places_disponibles - v_qty
      where id = new.transport_id and nb_places_disponibles >= v_qty;
    if not found then
      raise exception 'transport_capacite_insuffisante (annonce=%, qty=%)', new.transport_id, v_qty;
    end if;
  elsif old.statut in ('accepted','awaiting_payment','paid','completed')
        and new.statut in ('rejected','cancelled','expired','payment_expired') then
    update public.transport_annonces set nb_places_disponibles = nb_places_disponibles + coalesce(new.nb_places,0)
      where id = new.transport_id;
  end if;
  return new;
end $$;
create trigger trg_zz_availability_transport
  before update of statut on public.transport_reservations
  for each row execute function public.fn_availability_transport();

-- Seed utilisateurs / concours / chevaux.
insert into public.users(id, prenom) values
  ('00000000-0000-0000-0000-0000000000a1','Alice'),   -- demandeur
  ('00000000-0000-0000-0000-0000000000a2','Bob'),     -- offreur X
  ('00000000-0000-0000-0000-0000000000a3','Carol');   -- offreur Y / tiers
insert into public.concours(id, nom) values ('00000000-0000-0000-0000-0000000000c1','CSO Deauville');
insert into public.chevaux(id, proprietaire_id, nom) values
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','Tornado'),
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000a1','Spirit'),
  ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000a1','Rio'),
  ('00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-0000000000a1','Jazz'),
  ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-0000000000a1','Oslo'),
  ('00000000-0000-0000-0000-0000000000f6','00000000-0000-0000-0000-0000000000a1','Balou'),
  ('00000000-0000-0000-0000-0000000000f8','00000000-0000-0000-0000-0000000000a1','Duke'),
  ('00000000-0000-0000-0000-0000000000f9','00000000-0000-0000-0000-0000000000a1','Duchesse'),
  ('00000000-0000-0000-0000-0000000000f7','00000000-0000-0000-0000-0000000000a3','Nala');   -- a3 (anti-IDOR)

-- Annonces transport de test.
insert into public.transport_annonces (id, auteur_id, ville_depart, ville_arrivee, nb_places_disponibles, prix_ht) values
  ('00000000-0000-0000-0000-000000000da2','00000000-0000-0000-0000-0000000000a2','Nantes','Meuse',5,50),   -- a2, 5 places
  ('00000000-0000-0000-0000-000000000da3','00000000-0000-0000-0000-0000000000a3','Rennes','Meuse',3,60),   -- a3, 3 places
  ('00000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-0000000000a2','Nantes','Meuse',1,50),   -- a2, 1 place (capacité insuffisante)
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','Nantes','Meuse',2,40);   -- a1 (auto-réponse)

\echo '=== [1] APPLICATION 088 → 089 → 110 (chaîne réelle) ==='
\ir ../../migrations/088_user_follows_graph.sql
\ir ../../migrations/089_concours_presence.sql
grant select, insert, update, delete on public.concours_presence to authenticated;
\ir ../../migrations/110_concours_participation_model.sql
grant select, insert, delete on public.concours_presence_chevaux to authenticated;

-- Engagement concours réel : a1 amène Duchesse (f9) sur c1.
insert into public.concours_presence (concours_id, user_id, status, cheval_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','going','00000000-0000-0000-0000-0000000000f9');
insert into public.concours_presence_chevaux (concours_id, user_id, cheval_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f9');

\echo '=== [2] APPLICATION 111 (design multi-chevaux) ==='
\ir ../../migrations/111_recherches_ouvertes.sql
grant select, insert, update, delete on public.transport_recherches to authenticated;
grant select, insert, delete on public.transport_recherche_chevaux to authenticated;
grant select, insert, delete on public.transport_recherche_reponses to authenticated;
grant select on public.transport_reservation_chevaux to authenticated;
grant select, insert, update, delete on public.box_recherches to authenticated;
grant select, insert, delete on public.box_recherche_chevaux to authenticated;
grant select, insert, delete on public.box_recherche_reponses to authenticated;
grant select, insert, update, delete on public.coach_recherches to authenticated;
grant select, insert, delete on public.coach_recherche_chevaux to authenticated;
grant select, insert, delete on public.coach_recherche_reponses to authenticated;

-- ============================================================================
-- [3] RECHERCHE À 1 CHEVAL, liée à un concours — création → réponse → accept
--     (couvre : « recherche avec 1 cheval » + cohérence concours conservée)
-- ============================================================================
\echo '=== [3a] a1 crée rc1 (1 cheval, liée à c1) et y rattache Duchesse (engagée sur c1) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.transport_recherches (id, demandeur_id, concours_id, destination)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c1','Meuse');
insert into public.transport_recherche_chevaux (recherche_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f9');
reset role;
do $$ begin
  if not exists (select 1 from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e1' and nb_places=1)
  then raise exception 'FAIL: nb_places non dérivé correctement (attendu 1)'; end if;
  raise notice 'PASS: recherche à 1 cheval créée, nb_places dérivé = 1';
end $$;

\echo '=== [3b] a1 tente de rattacher Nala (f7, appartient à a3) à rc1 — anti-IDOR, doit échouer ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.transport_recherche_chevaux (recherche_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f7');
reset role;
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from public.transport_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e1' and cheval_id='00000000-0000-0000-0000-0000000000f7')
  then raise exception 'FAIL: cheval d''un autre utilisateur accepté à tort (IDOR)'; end if;
  raise notice 'PASS: anti-IDOR cheval toujours actif — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [3c] a3 répond à rc1, a1 accepte pour Duchesse — cycle complet 1 cheval ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
insert into public.transport_recherche_reponses (id, recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000b0','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000da3','00000000-0000-0000-0000-0000000000a3');
reset role;
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_transport_recherche_response(
  '00000000-0000-0000-0000-0000000000b0',
  array['00000000-0000-0000-0000-0000000000f9']::uuid[]
) as res_c1 \gset
reset role;
do $$ begin
  if not exists (select 1 from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e1' and status='matched')
  then raise exception 'FAIL: rc1 (1 cheval) non passée matched après acceptation complète'; end if;
  raise notice 'PASS: cycle complet 1 cheval — création, réponse, acceptation, matched';
end $$;

-- ============================================================================
-- [4] RECHERCHE MULTI-CHEVAUX (5 chevaux) — scénario principal
-- ============================================================================
\echo '=== [4] a1 crée rcM (générique, 5 chevaux : Tornado/Spirit/Rio/Jazz/Oslo) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.transport_recherches (id, demandeur_id, destination)
  values ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000a1','Clinique vétérinaire');
insert into public.transport_recherche_chevaux (recherche_id, cheval_id) values
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f3'),
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f4'),
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f5');
reset role;
do $$ begin
  if not exists (select 1 from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e5' and nb_places=5 and status='open')
  then raise exception 'FAIL: rcM — nb_places (attendu 5) ou status (attendu open) incorrect'; end if;
  raise notice 'PASS: recherche multi-chevaux créée, nb_places dérivé = 5, status = open';
end $$;

\echo '=== [5] Retrait d''un cheval NON couvert (Balou temporaire) — doit être autorisé ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.transport_recherche_chevaux (recherche_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f6');
reset role;
do $$ begin
  if not exists (select 1 from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e5' and nb_places=6)
  then raise exception 'FAIL: nb_places non remonté à 6 après ajout de Balou'; end if;
  raise notice 'PASS: ajout d''un 6e cheval → nb_places recalculé à 6';
end $$;
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
delete from public.transport_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e5' and cheval_id='00000000-0000-0000-0000-0000000000f6';
reset role;
do $$ begin
  if exists (select 1 from public.transport_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e5' and cheval_id='00000000-0000-0000-0000-0000000000f6')
  then raise exception 'FAIL: retrait d''un cheval non couvert refusé à tort'; end if;
  if not exists (select 1 from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e5' and nb_places=5)
  then raise exception 'FAIL: nb_places non redescendu à 5 après retrait de Balou'; end if;
  raise notice 'PASS: retrait d''un cheval non couvert autorisé, nb_places recalculé à 5';
end $$;

\echo '=== [6] Deux offreurs répondent à rcM (a2 = 5 places, a3 = 3 places) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
insert into public.transport_recherche_reponses (id, recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000da2','00000000-0000-0000-0000-0000000000a2');
reset role;
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
insert into public.transport_recherche_reponses (id, recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000da3','00000000-0000-0000-0000-0000000000a3');
reset role;
do $$ begin
  if (select count(*) from public.transport_recherche_reponses where recherche_id='00000000-0000-0000-0000-0000000000e5') <> 2
  then raise exception 'FAIL: 2 réponses attendues sur rcM'; end if;
  raise notice 'PASS: a2 et a3 répondent tous deux à rcM (2 offres pending)';
end $$;

\echo '=== [7] AUTO-RÉPONSE INTERDITE : a1 tente de répondre à sa propre recherche (annonce ds1) ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.transport_recherche_reponses (recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1');
reset role;
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from public.transport_recherche_reponses where annonce_id='00000000-0000-0000-0000-0000000000d1')
  then raise exception 'FAIL: auto-réponse acceptée à tort'; end if;
  raise notice 'PASS: auto-réponse toujours rejetée — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [8] ANTI-IDOR ANNONCE : a2 tente de répondre à rcM avec l''annonce de a3 ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
insert into public.transport_recherche_reponses (recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000da3','00000000-0000-0000-0000-0000000000a2');
reset role;
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from public.transport_recherche_reponses where offreur_id='00000000-0000-0000-0000-0000000000a2' and annonce_id='00000000-0000-0000-0000-000000000da3')
  then raise exception 'FAIL: a2 a pu répondre avec l''annonce de a3 (IDOR)'; end if;
  raise notice 'PASS: anti-IDOR annonce toujours actif — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [9] CHEVAL ABSENT DE LA RECHERCHE : accepter rpa2 pour Balou (retiré en [5]) — doit échouer ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_transport_recherche_response(
  '00000000-0000-0000-0000-0000000000b2',
  array['00000000-0000-0000-0000-0000000000f6']::uuid[]
);
reset role;
\set ON_ERROR_STOP on
do $$ declare v_cnt int; begin
  select count(*) into v_cnt from public.transport_reservations where transport_id='00000000-0000-0000-0000-000000000da2';
  if v_cnt <> 0 then raise exception 'FAIL: une réservation a été créée pour un cheval hors recherche (%)', v_cnt; end if;
  raise notice 'PASS: cheval absent de la recherche rejeté par la RPC — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [10] DOUBLON DE CHEVAL : accepter rpa2 pour [Tornado, Tornado] — doit échouer ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_transport_recherche_response(
  '00000000-0000-0000-0000-0000000000b2',
  array['00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f1']::uuid[]
);
reset role;
\set ON_ERROR_STOP on
do $$ declare v_cnt int; begin
  select count(*) into v_cnt from public.transport_reservations where transport_id='00000000-0000-0000-0000-000000000da2';
  if v_cnt <> 0 then raise exception 'FAIL: une réservation a été créée malgré un doublon de cheval (%)', v_cnt; end if;
  raise notice 'PASS: doublon de cheval dans une acceptation rejeté — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [11] ACCEPTATION PARTIELLE #1 : a1 accepte rpa2 pour Tornado+Spirit+Rio (3 chevaux) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_transport_recherche_response(
  '00000000-0000-0000-0000-0000000000b2',
  array['00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f3']::uuid[]
) as res1 \gset
reset role;
select set_config('test.res1', :'res1', false);
do $$
declare v_res record; v_covered int;
begin
  select * into v_res from public.transport_reservations where id = current_setting('test.res1')::uuid;
  if v_res.nb_places <> 3 then raise exception 'FAIL: nb_places incorrect (%, attendu 3)', v_res.nb_places; end if;
  if v_res.buyer_id <> '00000000-0000-0000-0000-0000000000a1' then raise exception 'FAIL: buyer_id incorrect'; end if;
  -- PRIX/COMMISSION AUTORITAIRES (test 18) : 50 × 3 = 150 HT, 9% = 13.5, TTC = 163.5.
  if v_res.prix_total_ht <> 150 or v_res.commission_plateforme <> 13.5 or v_res.prix_total_ttc <> 163.5 then
    raise exception 'FAIL: montants incorrects (ht=%, comm=%, ttc=%)', v_res.prix_total_ht, v_res.commission_plateforme, v_res.prix_total_ttc;
  end if;
  -- SELLER_ID AUTORITAIRE (test 19) : doit être a2 (auteur de l'annonce), jamais fourni par l'appelant.
  if v_res.seller_id <> '00000000-0000-0000-0000-0000000000a2' then
    raise exception 'FAIL: seller_id incorrect (%, attendu a2)', v_res.seller_id;
  end if;
  if v_res.cheval_id is not null then
    raise exception 'FAIL: cheval_id scalaire aurait dû rester NULL (multi-cheval → transport_reservation_chevaux)';
  end if;

  select count(*) into v_covered from public.transport_reservation_chevaux where reservation_id = current_setting('test.res1')::uuid;
  if v_covered <> 3 then raise exception 'FAIL: % lignes dans transport_reservation_chevaux (attendu 3)', v_covered; end if;

  if not exists (select 1 from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e5' and status='open')
  then raise exception 'FAIL: rcM aurait dû rester open (3/5 couverts)'; end if;

  raise notice 'PASS: réservation partielle 3 chevaux — nb_places/prix/commission/seller_id corrects, cheval_id scalaire NULL, rcM reste open';
end $$;

\echo '=== [12] CHEVAL DÉJÀ COUVERT : a3 (2e offreur) tente d''accepter pour Tornado (déjà couvert) — doit échouer ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_transport_recherche_response(
  '00000000-0000-0000-0000-0000000000b3',
  array['00000000-0000-0000-0000-0000000000f1']::uuid[]
);
reset role;
\set ON_ERROR_STOP on
do $$ declare v_cnt int; begin
  -- da3 porte déjà 1 réservation légitime depuis [3c] (rc1/e1, sans lien avec
  -- rcM/e5) : on vérifie qu'aucune réservation supplémentaire n'a été créée
  -- pour rcM via cette tentative, pas que da3 est vierge.
  select count(*) into v_cnt from public.transport_reservations where transport_id='00000000-0000-0000-0000-000000000da3' and recherche_id='00000000-0000-0000-0000-0000000000e5';
  if v_cnt <> 0 then raise exception 'FAIL: une réservation a été créée pour un cheval déjà couvert (%)', v_cnt; end if;
  raise notice 'PASS: cheval déjà couvert par une autre réservation rejeté — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [13] RETRAIT D''UN CHEVAL COUVERT : tentative de retirer Tornado de rcM — doit échouer ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
delete from public.transport_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e5' and cheval_id='00000000-0000-0000-0000-0000000000f1';
reset role;
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from public.transport_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e5' and cheval_id='00000000-0000-0000-0000-0000000000f1')
  then raise exception 'FAIL: un cheval couvert par une réservation vivante a pu être retiré de la recherche'; end if;
  raise notice 'PASS: retrait d''un cheval couvert refusé (silencieux, 0 ligne affectée par la RLS) — Tornado toujours dans rcM';
end $$;

\echo '=== [14] MÊME RÉPONSE RÉUTILISÉE : a1 réutilise rpa2 pour Jazz (1 cheval, capacité restante sur l''annonce a2) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_transport_recherche_response(
  '00000000-0000-0000-0000-0000000000b2',
  array['00000000-0000-0000-0000-0000000000f4']::uuid[]
) as res2 \gset
reset role;
select set_config('test.res2', :'res2', false);
do $$
declare v_places int; v_cnt_rp int;
begin
  select nb_places_disponibles into v_places from public.transport_annonces where id='00000000-0000-0000-0000-000000000da2';
  if v_places <> 1 then raise exception 'FAIL: capacité annonce a2 incorrecte après 2 réservations (3+1=4 sur 5) — attendu 1, obtenu %', v_places; end if;

  select count(*) into v_cnt_rp from public.transport_reservations where recherche_reponse_id = '00000000-0000-0000-0000-0000000000b2';
  if v_cnt_rp <> 2 then raise exception 'FAIL: la réponse rpa2 devrait avoir produit 2 réservations (%)', v_cnt_rp; end if;

  if not exists (select 1 from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e5' and status='open')
  then raise exception 'FAIL: rcM aurait dû rester open (4/5 couverts)'; end if;

  raise notice 'PASS: même réponse (rpa2) réutilisée pour une 2e acceptation partielle — capacité annonce correctement décrémentée (5→2→1), rcM reste open (4/5)';
end $$;

\echo '=== [15] DEUXIÈME TRANSPORTEUR : a1 accepte rpa3 (a3) pour Oslo — dernier cheval, rcM doit passer matched ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_transport_recherche_response(
  '00000000-0000-0000-0000-0000000000b3',
  array['00000000-0000-0000-0000-0000000000f5']::uuid[]
) as res3 \gset
reset role;
select set_config('test.res3', :'res3', false);
do $$
declare v_res record;
begin
  select * into v_res from public.transport_reservations where id = current_setting('test.res3')::uuid;
  if v_res.seller_id <> '00000000-0000-0000-0000-0000000000a3' then raise exception 'FAIL: seller_id incorrect (%, attendu a3)', v_res.seller_id; end if;
  if v_res.prix_total_ht <> 60 or v_res.commission_plateforme <> 5.4 or v_res.prix_total_ttc <> 65.4 then
    raise exception 'FAIL: montants réservation a3 incorrects (ht=%, comm=%, ttc=%)', v_res.prix_total_ht, v_res.commission_plateforme, v_res.prix_total_ttc;
  end if;
  if not exists (select 1 from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e5' and status='matched')
  then raise exception 'FAIL: rcM aurait dû passer matched (5/5 couverts par 2 transporteurs)'; end if;
  raise notice 'PASS: 2e transporteur (a3) couvre le dernier cheval — rcM passe matched (5/5), montants propres à cette réservation';
end $$;

\echo '=== [16] PREUVE SÉQUENTIELLE ANTI-DOUBLE-ACCEPTATION (concurrence réelle non simulable en psql séquentiel) ==='
\echo '    Le verrou FOR UPDATE sur la ligne recherche (pris AVANT tout verrou réponse)'
\echo '    sérialise toute paire d''acceptations concurrentes visant la même recherche,'
\echo '    y compris pour des chevaux disjoints. La 2e attend le COMMIT/ROLLBACK de la'
\echo '    1re puis revoit un état de couverture déjà à jour. Preuve du résultat final'
\echo '    équivalent en séquentiel : tenter à nouveau Oslo (déjà couvert par [15]).'
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_transport_recherche_response(
  '00000000-0000-0000-0000-0000000000b2',
  array['00000000-0000-0000-0000-0000000000f5']::uuid[]
);
reset role;
\set ON_ERROR_STOP on
do $$ declare v_cnt int; begin
  select count(*) into v_cnt from public.transport_reservation_chevaux where cheval_id='00000000-0000-0000-0000-0000000000f5';
  if v_cnt <> 1 then raise exception 'FAIL: Oslo couvert par % réservations (attendu 1)', v_cnt; end if;
  raise notice 'PASS: nouvelle tentative sur un cheval déjà couvert rejetée — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [17] CAPACITÉ INSUFFISANTE : rcLow (2 chevaux) vs annonce à 1 place ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.transport_recherches (id, demandeur_id, destination)
  values ('00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-0000000000a1','Vétérinaire');
insert into public.transport_recherche_chevaux (recherche_id, cheval_id) values
  ('00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-0000000000f6'),
  ('00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-0000000000f8');
reset role;
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
insert into public.transport_recherche_reponses (id, recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000b9','00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-0000000000a2');
reset role;

\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_transport_recherche_response(
  '00000000-0000-0000-0000-0000000000b9',
  array['00000000-0000-0000-0000-0000000000f6','00000000-0000-0000-0000-0000000000f8']::uuid[]
);
reset role;
\set ON_ERROR_STOP on

do $$ declare v_cnt int; v_places int; begin
  select count(*) into v_cnt from public.transport_reservations where transport_id='00000000-0000-0000-0000-0000000000d9';
  if v_cnt <> 0 then raise exception 'FAIL: une réservation a été créée malgré capacité insuffisante (%)', v_cnt; end if;

  if not exists (select 1 from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e9' and status='open')
  then raise exception 'FAIL: rcLow passée matched malgré l''échec de capacité'; end if;

  select nb_places_disponibles into v_places from public.transport_annonces where id='00000000-0000-0000-0000-0000000000d9';
  if v_places <> 1 then raise exception 'FAIL: nb_places_disponibles altéré (%) malgré échec', v_places; end if;

  raise notice 'PASS: capacité insuffisante (2 chevaux vs 1 place) → échec propre, ROLLBACK complet, rcLow toujours open, capacité annonce inchangée';
end $$;

\echo '=== [18] ANNULATION PARTIELLE : annulation de la réservation de Jazz (res2) — chevaux libérés, rcM repasse open ==='
-- rcM est 'matched' depuis [15] (5/5). On annule ici la réservation qui couvrait
-- Jazz (res2, créée en [14]) par TRANSITION DE STATUT (parcours normal) : couvre
-- à la fois « annulation d'une réservation partielle → chevaux libérés » et
-- « annulation après recherche matched → repasse open » en un seul événement.
update public.transport_reservations set statut = 'cancelled' where id = current_setting('test.res2')::uuid;
do $$ begin
  if exists (
    select 1 from public.transport_reservation_chevaux trvc
    join public.transport_reservations tr on tr.id = trvc.reservation_id
    where trvc.cheval_id = '00000000-0000-0000-0000-0000000000f4'
      and tr.statut in ('accepted','awaiting_payment','paid','completed')
  ) then raise exception 'FAIL: Jazz encore compté comme couvert après annulation de sa réservation'; end if;

  if not exists (select 1 from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e5' and status='open')
  then raise exception 'FAIL: rcM aurait dû repasser open après annulation (4/5 couverts, Jazz libéré)'; end if;

  raise notice 'PASS: annulation d''une réservation partielle libère son cheval (Jazz) et fait repasser rcM de matched à open (4/5)';
end $$;

\echo '=== [19] V1 INTACTE : réservation directe SANS recherche (parcours V1 classique) ==='
-- Capacité annonce a2 : 5 → 2 après [11](-3) → 1 après [14](-1) → 2 après
-- [18] (annulation de la résa Jazz, +1 restituée par le trigger 053-stub,
-- exactement comme il le ferait déjà en V1). Cette résa V1 directe en reprend 1.
insert into public.transport_reservations (transport_id, buyer_id, titre, ville_depart, ville_arrivee, nb_places, message, statut)
  values ('00000000-0000-0000-0000-000000000da2','00000000-0000-0000-0000-0000000000a3','Résa V1 directe','Nantes','Meuse',1,'', 'pending')
  returning id as res_v1 \gset
update public.transport_reservations set statut = 'accepted' where id = :'res_v1';
select set_config('test.resv1', :'res_v1', false);
do $$
declare v_res record; v_places int;
begin
  select * into v_res from public.transport_reservations where id = current_setting('test.resv1')::uuid;
  if v_res.recherche_id is not null or v_res.recherche_reponse_id is not null then
    raise exception 'FAIL: réservation V1 directe a hérité de colonnes recherche (recherche_id=%, recherche_reponse_id=%)', v_res.recherche_id, v_res.recherche_reponse_id;
  end if;
  if v_res.prix_total_ht <> 50 or v_res.seller_id <> '00000000-0000-0000-0000-0000000000a2' then
    raise exception 'FAIL: triggers 051-stub non appliqués correctement au flux V1 direct';
  end if;
  select nb_places_disponibles into v_places from public.transport_annonces where id='00000000-0000-0000-0000-000000000da2';
  if v_places <> 1 then raise exception 'FAIL: capacité annonce a2 incorrecte après résa V1 directe (attendu 1, obtenu %)', v_places; end if;
  raise notice 'PASS: flux V1 direct (sans recherche) inchangé — prix/seller_id/capacité corrects, recherche_id/recherche_reponse_id restent NULL, aucun impact du nouveau trigger de recalcul';
end $$;

\echo '=== [20] Sanity Box/Coach : schéma + RLS de base inchangés (pas de RPC pour ces modules) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.box_recherches (id, demandeur_id, nb_box) values ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1',1);
insert into public.coach_recherches (id, demandeur_id, nb_seances) values ('00000000-0000-0000-0000-0000000000c9','00000000-0000-0000-0000-0000000000a1',1);
reset role;
do $$ begin
  if not exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000b1')
  then raise exception 'FAIL: box_recherches insert own échoué'; end if;
  if not exists (select 1 from public.coach_recherches where id='00000000-0000-0000-0000-0000000000c9')
  then raise exception 'FAIL: coach_recherches insert own échoué'; end if;
  raise notice 'PASS: box_recherches/coach_recherches inchangés — schéma + RLS insert-own OK (Box/Coach hors périmètre de cette révision)';
end $$;

-- ============================================================================
-- [21-25] TRAÇABILITÉ : suppression bloquée dès qu'une réservation existe
-- ============================================================================
\echo '=== [21] MÊME CHEVAL DANS 2 RECHERCHES DIFFÉRENTES : autorisé (pas de contrainte globale) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.transport_recherches (id, demandeur_id, destination)
  values ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000a1','Autre clinique');
insert into public.transport_recherche_chevaux (recherche_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000f1');
reset role;
do $$ begin
  if not exists (select 1 from public.transport_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e3' and cheval_id='00000000-0000-0000-0000-0000000000f1')
  then raise exception 'FAIL: Tornado n''a pas pu être rattaché à une 2e recherche (e3)'; end if;
  if not exists (select 1 from public.transport_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e5' and cheval_id='00000000-0000-0000-0000-0000000000f1')
  then raise exception 'FAIL: Tornado a disparu de rcM (e5) après rattachement à e3'; end if;
  raise notice 'PASS: Tornado présent simultanément dans 2 recherches différentes (e5 et e3) — aucune contrainte globale, comme voulu';
end $$;

\echo '=== [22] SUPPRESSION RECHERCHE SANS RÉSERVATION : e3 (aucune réponse/réservation) — doit réussir ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
delete from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e3';
reset role;
do $$ begin
  if exists (select 1 from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e3')
  then raise exception 'FAIL: suppression d''une recherche sans aucune réservation refusée à tort'; end if;
  raise notice 'PASS: suppression d''une recherche jamais utilisée pour une réservation autorisée';
end $$;

\echo '=== [23] SUPPRESSION RECHERCHE AYANT PRODUIT UNE RÉSERVATION : e1 (rc1, a produit res_c1) — doit échouer ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
delete from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ begin
  if not exists (select 1 from public.transport_recherches where id='00000000-0000-0000-0000-0000000000e1')
  then raise exception 'FAIL: une recherche ayant produit une réservation a pu être supprimée (perte d''historique)'; end if;
  raise notice 'PASS: suppression refusée (silencieuse, 0 ligne) pour une recherche ayant déjà produit une réservation — historique préservé';
end $$;

\echo '=== [24] SUPPRESSION RÉPONSE SANS RÉSERVATION : nouvelle réponse b4 sur rcLow (jamais acceptée) — doit réussir ==='
-- rcLow (e9) est restée 'open' (l'acceptation en [17] a échoué pour capacité
-- insuffisante). a3 y répond avec une annonce encore inutilisée sur cette
-- recherche (da3) — cette réponse n'est jamais acceptée.
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
insert into public.transport_recherche_reponses (id, recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000b4','00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-000000000da3','00000000-0000-0000-0000-0000000000a3');
delete from public.transport_recherche_reponses where id='00000000-0000-0000-0000-0000000000b4';
reset role;
do $$ begin
  if exists (select 1 from public.transport_recherche_reponses where id='00000000-0000-0000-0000-0000000000b4')
  then raise exception 'FAIL: suppression d''une réponse pending sans aucune réservation refusée à tort'; end if;
  raise notice 'PASS: suppression d''une réponse jamais utilisée pour une réservation autorisée';
end $$;

\echo '=== [25] SUPPRESSION RÉPONSE AYANT PRODUIT DES RÉSERVATIONS : rpa2 (b2, 2 réservations) — doit échouer ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
delete from public.transport_recherche_reponses where id='00000000-0000-0000-0000-0000000000b2';
reset role;
do $$ begin
  if not exists (select 1 from public.transport_recherche_reponses where id='00000000-0000-0000-0000-0000000000b2')
  then raise exception 'FAIL: une réponse ayant produit des réservations a pu être supprimée (perte d''historique)'; end if;
  raise notice 'PASS: suppression refusée (silencieuse, 0 ligne) pour une réponse ayant déjà produit une réservation — historique préservé';
end $$;

\echo '=== [26] ROLLBACK 111 + vérif propreté (110/annonces/réservations/V1 intacts) ==='
\ir ../../rollbacks/111_recherches_ouvertes_rollback.sql
do $$
declare v_tables text[] := array[
  'transport_recherches','box_recherches','coach_recherches',
  'transport_recherche_chevaux','box_recherche_chevaux','coach_recherche_chevaux',
  'transport_recherche_reponses','box_recherche_reponses','coach_recherche_reponses',
  'transport_reservation_chevaux'
];
declare t text; v_col_count int; v_reservations_count int;
begin
  foreach t in array v_tables loop
    if to_regclass('public.' || t) is not null then
      raise exception 'FAIL: table % non supprimée par le rollback', t;
    end if;
  end loop;

  if exists (select 1 from pg_proc where proname = 'accept_transport_recherche_response') then
    raise exception 'FAIL: RPC non supprimée par le rollback';
  end if;
  if exists (select 1 from pg_proc where proname in (
    'fn_recompute_transport_recherche_status',
    'fn_sync_transport_recherche_chevaux',
    'fn_sync_transport_recherche_on_reservation_change'
  )) then raise exception 'FAIL: fonctions de recalcul non supprimées par le rollback'; end if;

  select count(*) into v_col_count from information_schema.columns
    where table_schema='public' and table_name='transport_reservations'
      and column_name in ('recherche_id','recherche_reponse_id');
  if v_col_count <> 0 then raise exception 'FAIL: colonnes recherche_id/recherche_reponse_id encore présentes sur transport_reservations (%)', v_col_count; end if;

  if to_regclass('public.concours_presence_chevaux') is null then
    raise exception 'FAIL: le rollback 111 a supprimé une table de 110 — ne devait PAS arriver';
  end if;
  if to_regclass('public.transport_annonces') is null then
    raise exception 'FAIL: le rollback 111 a touché transport_annonces — ne devait PAS arriver';
  end if;

  -- V1 : les LIGNES de réservations (issues du parcours recherche ET du
  -- parcours V1 direct) doivent SURVIVRE au rollback — seules les 2 colonnes
  -- de traçabilité disparaissent, jamais les données.
  select count(*) into v_reservations_count from public.transport_reservations;
  if v_reservations_count <> 5 then
    raise exception 'FAIL: réservations perdues/ajoutées par le rollback (% restantes, attendu 5 : res_c1+res1+res2(cancelled)+res3+résa V1 directe)', v_reservations_count;
  end if;

  raise notice 'PASS: rollback 111 propre — 10 tables + 3 fonctions + RPC absentes, colonnes ALTER retirées de transport_reservations, 110/annonces intacts, % lignes de réservations V1/historiques préservées', v_reservations_count;
end $$;

\echo '=== HARNESS 111 TERMINÉ — tous les PASS ci-dessus ==='
