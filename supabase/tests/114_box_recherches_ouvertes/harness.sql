-- ============================================================================
-- HARNESS 114 — RECHERCHES OUVERTES, BOX (1 réservation = 1 cheval)
-- ============================================================================
-- AUTO-PORTANT. POSTGRES LOCAL JETABLE (jamais prod) :
--   createdb eq_harness_114
--   psql -d eq_harness_114 -v ON_ERROR_STOP=1 -f supabase/tests/114_box_recherches_ouvertes/harness.sql
--
-- Charge la VRAIE chaîne de dépendance 088→089→110 (fichiers réels), puis des
-- STUBS minimalistes pour box_annonces/box_reservations (+ triggers recalc/
-- disponibilité MIMIQUANT 051/104, pas les fichiers réels — charger toute la
-- chaîne 005→104 serait disproportionné pour ce harness ; ces stubs ne
-- re-testent PAS 051/104 eux-mêmes, ils valident que LA RPC 114 interagit
-- correctement AVEC des triggers qui se comportent comme documenté).
--
-- Simplification assumée du stub fn_availability_box : capacité = COUNT des
-- réservations consommantes qui CHEVAUCHENT la période de la nouvelle ligne
-- (pas le calcul exact de pic instant-par-instant de 104). Pour les scénarios
-- de ce harness (toutes les réservations d'une même annonce partagent la
-- même période [2026-11-01,2026-11-03]), les deux calculs sont équivalents.
--
-- IMPORTANT (piège psql découvert en session 2026-09-18, cf. harness 111) :
-- psql ne substitue PAS les `:'var'` à l'intérieur d'un bloc `do $$ ... $$`.
-- Toute valeur dynamique nécessaire DANS un bloc do passe par un GUC de
-- session (`select set_config('test.x', :'var', false);` puis
-- `current_setting('test.x')::uuid` dans le bloc).
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

-- Stubs annonces/réservations Box (colonnes minimales requises par 114 + triggers stub).
create table public.box_annonces (
  id uuid primary key default gen_random_uuid(),
  auteur_id uuid not null,
  lieu text not null,
  date_debut timestamptz not null,
  date_fin timestamptz not null,
  nb_boxes int not null default 1,
  nb_boxes_disponibles int not null default 1,
  prix_nuit_ht numeric not null default 25,
  concours_id uuid
);
create table public.box_reservations (
  id uuid primary key default gen_random_uuid(),
  box_id uuid references public.box_annonces(id) on delete cascade,
  seller_id uuid, buyer_id uuid,
  title text not null default '',
  lieu text,
  nb_nuits int not null default 1,
  date_debut date not null,
  date_fin date not null,
  message text,
  price_total_ht numeric, platform_commission numeric, price_total_ttc numeric,
  status text not null default 'pending',
  cheval_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Grants (en prod, Supabase les accorde par défaut au bootstrap projet ; ce
-- harness jetable doit le répliquer pour que les sous-requêtes RLS
-- (exécutées sous le rôle appelant, pas sous le propriétaire de la RPC)
-- puissent lire ces tables.
grant select on public.box_annonces to authenticated;
grant select, insert, update on public.box_reservations to authenticated;

-- Stub trigger recalc (mimique 051 recalc_box_reservation_amounts).
create or replace function public.recalc_box_reservation_amounts() returns trigger
language plpgsql as $$
declare v_unit numeric; v_auteur uuid;
begin
  select prix_nuit_ht, auteur_id into v_unit, v_auteur from public.box_annonces where id = new.box_id;
  if v_unit is null or v_unit <= 0 then
    raise exception 'invalid prix_nuit_ht for box_annonce % (must be > 0)', new.box_id;
  end if;
  if new.nb_nuits is null or new.nb_nuits <= 0 then
    raise exception 'invalid nb_nuits % (must be > 0)', new.nb_nuits;
  end if;
  new.seller_id           := v_auteur;
  new.price_total_ht      := round(v_unit * new.nb_nuits, 2);
  new.platform_commission := round(new.price_total_ht * 0.05, 2); -- commission_box défaut (mig 005)
  new.price_total_ttc     := new.price_total_ht + new.platform_commission;
  return new;
end $$;
create trigger trg_box_reservations_recalc
  before insert or update of box_id, nb_nuits, price_total_ht, price_total_ttc, platform_commission, seller_id
  on public.box_reservations for each row execute function public.recalc_box_reservation_amounts();

-- Stub trigger disponibilité (mimique 104 fn_availability_box — cf. note d'en-tête).
create or replace function public.fn_availability_box() returns trigger
language plpgsql as $$
declare
  v_cap int;
  v_peak int;
  c_consuming constant text[] := array['accepted','awaiting_payment','paid','completed'];
  v_old_status text := (case when tg_op = 'INSERT' then null else old.status end);
begin
  if (v_old_status is null or not (v_old_status = any(c_consuming))) and (new.status = any(c_consuming)) then
    select nb_boxes into v_cap from public.box_annonces where id = new.box_id for update;
    select count(*) into v_peak
      from public.box_reservations r
     where r.box_id = new.box_id and r.id <> new.id and r.status = any(c_consuming)
       and r.date_debut <= new.date_fin and r.date_fin >= new.date_debut;
    if v_peak + 1 > coalesce(v_cap, 0) then
      raise exception 'box_conflit_periode (box=%, pic_existant=%, capacite=%)', new.box_id, v_peak, v_cap;
    end if;
  end if;
  return new;
end $$;
create trigger trg_zz_availability_box
  before insert or update of status on public.box_reservations
  for each row execute function public.fn_availability_box();

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

-- Annonces box de test (toutes datées large 20/10→15/11, couvrent la période
-- de recherche standard 01/11→03/11 utilisée par la majorité des scénarios).
insert into public.box_annonces (id, auteur_id, lieu, date_debut, date_fin, nb_boxes, prix_nuit_ht) values
  ('00000000-0000-0000-0000-000000000da2','00000000-0000-0000-0000-0000000000a2','Écurie du Golfe','2026-10-20','2026-11-15',5,25),  -- a2, 5 box
  ('00000000-0000-0000-0000-000000000da3','00000000-0000-0000-0000-0000000000a3','Écurie des Prés','2026-10-20','2026-11-15',3,30),  -- a3, 3 box
  ('00000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-0000000000a2','Petit box','2026-10-20','2026-11-15',1,40),        -- a2, 1 box (capacité insuffisante)
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','Chez moi','2026-10-20','2026-11-15',2,20);          -- a1 (auto-réponse)

\echo '=== [1] APPLICATION 088 → 089 → 110 (chaîne réelle) ==='
\ir ../../migrations/088_user_follows_graph.sql
\ir ../../migrations/089_concours_presence.sql
grant select, insert, update, delete on public.concours_presence to authenticated;
\ir ../../migrations/110_concours_participation_model.sql
grant select, insert, delete on public.concours_presence_chevaux to authenticated;

-- Engagement concours réel : a1 amène Duchesse (f9) sur c1. Tornado (f1)
-- N'EST PAS engagé sur c1 (sert au test de cohérence concours [3a3]).
insert into public.concours_presence (concours_id, user_id, status, cheval_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','going','00000000-0000-0000-0000-0000000000f9');
insert into public.concours_presence_chevaux (concours_id, user_id, cheval_id) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f9');

\echo '=== [2] APPLICATION 114 (1 réservation = 1 cheval) ==='
\ir ../../migrations/114_box_recherches_ouvertes.sql
grant select, insert, update, delete on public.box_recherches to authenticated;
grant select, insert, delete on public.box_recherche_chevaux to authenticated;
grant select, insert, delete on public.box_recherche_reponses to authenticated;

-- ============================================================================
-- [3] RECHERCHE À 1 CHEVAL, liée à un concours — création → cohérence concours
--     → anti-IDOR → réponse → accept (cycle complet)
-- ============================================================================
\echo '=== [3a] a1 crée rc1 (liée à c1, période 01/11→03/11) et y rattache Duchesse (engagée sur c1) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.box_recherches (id, demandeur_id, concours_id, lieu, date_debut, date_fin)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c1','Deauville','2026-11-01','2026-11-03');
insert into public.box_recherche_chevaux (recherche_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f9');
reset role;
do $$ begin
  if not exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000e1' and nb_box=1)
  then raise exception 'FAIL: nb_box non dérivé correctement (attendu 1)'; end if;
  raise notice 'PASS: recherche à 1 cheval créée, nb_box dérivé = 1';
end $$;

\echo '=== [3a2] ANTI-IDOR CHEVAL : a1 tente de rattacher Nala (f7, appartient à a3) à rc1 — doit échouer ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.box_recherche_chevaux (recherche_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f7');
reset role;
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from public.box_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e1' and cheval_id='00000000-0000-0000-0000-0000000000f7')
  then raise exception 'FAIL: cheval d''un autre utilisateur accepté à tort (IDOR)'; end if;
  raise notice 'PASS: anti-IDOR cheval actif — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [3a3] COHÉRENCE CONCOURS : a1 tente de rattacher Tornado (f1, PAS engagé sur c1) à rc1 — doit échouer ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.box_recherche_chevaux (recherche_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f1');
reset role;
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from public.box_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e1' and cheval_id='00000000-0000-0000-0000-0000000000f1')
  then raise exception 'FAIL: cheval non engagé sur le concours de la recherche accepté à tort'; end if;
  raise notice 'PASS: cohérence concours active (cheval doit être engagé sur c1 via concours_presence_chevaux) — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [3b] a3 répond à rc1, a1 accepte pour Duchesse — cycle complet 1 cheval ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
insert into public.box_recherche_reponses (id, recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000b0','00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000da3','00000000-0000-0000-0000-0000000000a3');
reset role;
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_box_recherche_response(
  '00000000-0000-0000-0000-0000000000b0',
  array['00000000-0000-0000-0000-0000000000f9']::uuid[]
) as res_c1 \gset
reset role;
select set_config('test.res_c1', :'res_c1', false);
do $$
declare v_ids uuid[]; v_res record;
begin
  v_ids := current_setting('test.res_c1')::uuid[];
  if array_length(v_ids, 1) <> 1 then raise exception 'FAIL: rc1 aurait dû produire exactement 1 réservation (%)', array_length(v_ids,1); end if;
  select * into v_res from public.box_reservations where id = v_ids[1];
  if v_res.cheval_id <> '00000000-0000-0000-0000-0000000000f9' then raise exception 'FAIL: cheval_id incorrect sur la réservation rc1'; end if;
  if v_res.seller_id <> '00000000-0000-0000-0000-0000000000a3' then raise exception 'FAIL: seller_id incorrect (%, attendu a3)', v_res.seller_id; end if;
  if v_res.price_total_ht <> 60 or v_res.platform_commission <> 3 or v_res.price_total_ttc <> 63 then
    raise exception 'FAIL: montants incorrects (ht=%, comm=%, ttc=%)', v_res.price_total_ht, v_res.platform_commission, v_res.price_total_ttc;
  end if;
  if not exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000e1' and status='matched')
  then raise exception 'FAIL: rc1 non passée matched après acceptation complète'; end if;
  raise notice 'PASS: cycle complet 1 cheval — cheval_id/seller_id/montants corrects, rc1 matched';
end $$;

-- ============================================================================
-- [4] RECHERCHE MULTI-CHEVAUX (5 chevaux), sans concours — scénario principal
-- ============================================================================
\echo '=== [4] a1 crée rcM (5 chevaux : Tornado/Spirit/Rio/Jazz/Oslo, période 01/11→03/11) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.box_recherches (id, demandeur_id, lieu, date_debut, date_fin)
  values ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000a1','Clinique vétérinaire','2026-11-01','2026-11-03');
insert into public.box_recherche_chevaux (recherche_id, cheval_id) values
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f2'),
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f3'),
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f4'),
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f5');
reset role;
do $$ begin
  if not exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000e5' and nb_box=5 and status='open')
  then raise exception 'FAIL: rcM — nb_box (attendu 5) ou status (attendu open) incorrect'; end if;
  raise notice 'PASS: recherche multi-chevaux créée, nb_box dérivé = 5, status = open';
end $$;

\echo '=== [5] Retrait d''un cheval NON couvert (Balou temporaire) — doit être autorisé ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.box_recherche_chevaux (recherche_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000f6');
reset role;
do $$ begin
  if not exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000e5' and nb_box=6)
  then raise exception 'FAIL: nb_box non remonté à 6 après ajout de Balou'; end if;
  raise notice 'PASS: ajout d''un 6e cheval → nb_box recalculé à 6';
end $$;
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
delete from public.box_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e5' and cheval_id='00000000-0000-0000-0000-0000000000f6';
reset role;
do $$ begin
  if exists (select 1 from public.box_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e5' and cheval_id='00000000-0000-0000-0000-0000000000f6')
  then raise exception 'FAIL: retrait d''un cheval non couvert refusé à tort'; end if;
  if not exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000e5' and nb_box=5)
  then raise exception 'FAIL: nb_box non redescendu à 5 après retrait de Balou'; end if;
  raise notice 'PASS: retrait d''un cheval non couvert autorisé, nb_box recalculé à 5';
end $$;

\echo '=== [6] Deux offreurs répondent à rcM (a2 = 5 box, a3 = 3 box) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
insert into public.box_recherche_reponses (id, recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000da2','00000000-0000-0000-0000-0000000000a2');
reset role;
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
insert into public.box_recherche_reponses (id, recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000da3','00000000-0000-0000-0000-0000000000a3');
reset role;
do $$ begin
  if (select count(*) from public.box_recherche_reponses where recherche_id='00000000-0000-0000-0000-0000000000e5') <> 2
  then raise exception 'FAIL: 2 réponses attendues sur rcM'; end if;
  raise notice 'PASS: a2 et a3 répondent tous deux à rcM (2 offres pending)';
end $$;

\echo '=== [7] AUTO-RÉPONSE INTERDITE : a1 tente de répondre à sa propre recherche (annonce d1) ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.box_recherche_reponses (recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1');
reset role;
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from public.box_recherche_reponses where annonce_id='00000000-0000-0000-0000-0000000000d1')
  then raise exception 'FAIL: auto-réponse acceptée à tort'; end if;
  raise notice 'PASS: auto-réponse toujours rejetée — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [8] ANTI-IDOR ANNONCE : a2 tente de répondre à rcM avec l''annonce de a3 ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
insert into public.box_recherche_reponses (recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-000000000da3','00000000-0000-0000-0000-0000000000a2');
reset role;
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from public.box_recherche_reponses where offreur_id='00000000-0000-0000-0000-0000000000a2' and annonce_id='00000000-0000-0000-0000-000000000da3')
  then raise exception 'FAIL: a2 a pu répondre avec l''annonce de a3 (IDOR)'; end if;
  raise notice 'PASS: anti-IDOR annonce actif — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [9] CHEVAL ABSENT DE LA RECHERCHE : accepter rpa2 pour Balou (retiré en [5]) — doit échouer ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_box_recherche_response(
  '00000000-0000-0000-0000-0000000000b2',
  array['00000000-0000-0000-0000-0000000000f6']::uuid[]
);
reset role;
\set ON_ERROR_STOP on
do $$ declare v_cnt int; begin
  select count(*) into v_cnt from public.box_reservations where box_id='00000000-0000-0000-0000-000000000da2';
  if v_cnt <> 0 then raise exception 'FAIL: une réservation a été créée pour un cheval hors recherche (%)', v_cnt; end if;
  raise notice 'PASS: cheval absent de la recherche rejeté par la RPC — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [10] DOUBLON DE CHEVAL : accepter rpa2 pour [Tornado, Tornado] — doit échouer ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_box_recherche_response(
  '00000000-0000-0000-0000-0000000000b2',
  array['00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f1']::uuid[]
);
reset role;
\set ON_ERROR_STOP on
do $$ declare v_cnt int; begin
  select count(*) into v_cnt from public.box_reservations where box_id='00000000-0000-0000-0000-000000000da2';
  if v_cnt <> 0 then raise exception 'FAIL: une réservation a été créée malgré un doublon de cheval (%)', v_cnt; end if;
  raise notice 'PASS: doublon de cheval dans une acceptation rejeté — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [11] ACCEPTATION PARTIELLE #1 : a1 accepte rpa2 pour Tornado+Spirit+Rio (3 chevaux → 3 réservations) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_box_recherche_response(
  '00000000-0000-0000-0000-0000000000b2',
  array['00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000f3']::uuid[]
) as res1 \gset
reset role;
select set_config('test.res1', :'res1', false);
do $$
declare v_ids uuid[]; v_cnt int; v_cheval_set uuid[];
begin
  v_ids := current_setting('test.res1')::uuid[];
  if array_length(v_ids, 1) <> 3 then raise exception 'FAIL: 3 réservations attendues (obtenu %)', array_length(v_ids,1); end if;

  select count(*) into v_cnt from public.box_reservations where id = any(v_ids);
  if v_cnt <> 3 then raise exception 'FAIL: % lignes box_reservations trouvées pour les 3 ids retournés (attendu 3)', v_cnt; end if;

  select array_agg(cheval_id order by cheval_id) into v_cheval_set from public.box_reservations where id = any(v_ids);
  if v_cheval_set <> array[
    '00000000-0000-0000-0000-0000000000f1'::uuid,
    '00000000-0000-0000-0000-0000000000f2'::uuid,
    '00000000-0000-0000-0000-0000000000f3'::uuid
  ] then raise exception 'FAIL: cheval_id des 3 réservations incorrects'; end if;

  -- PRIX/COMMISSION/SELLER_ID AUTORITAIRES : 25 × 2 nuits = 50 HT, 5% = 2.5, TTC = 52.5, seller=a2.
  if exists (
    select 1 from public.box_reservations where id = any(v_ids)
      and (price_total_ht <> 50 or platform_commission <> 2.5 or price_total_ttc <> 52.5
           or seller_id <> '00000000-0000-0000-0000-0000000000a2' or nb_nuits <> 2)
  ) then raise exception 'FAIL: montants/seller_id/nb_nuits incorrects sur au moins une des 3 réservations'; end if;

  if not exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000e5' and status='open')
  then raise exception 'FAIL: rcM aurait dû rester open (3/5 couverts)'; end if;

  raise notice 'PASS: réservation partielle 3 chevaux — 3 lignes box_reservations (1/cheval), montants/seller_id/nb_nuits corrects, rcM reste open';
end $$;

\echo '=== [12] CHEVAL DÉJÀ COUVERT : a3 (2e offreur) tente d''accepter pour Tornado (déjà couvert) — doit échouer ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_box_recherche_response(
  '00000000-0000-0000-0000-0000000000b3',
  array['00000000-0000-0000-0000-0000000000f1']::uuid[]
);
reset role;
\set ON_ERROR_STOP on
do $$ declare v_cnt int; begin
  select count(*) into v_cnt from public.box_reservations where box_id='00000000-0000-0000-0000-000000000da3' and recherche_id='00000000-0000-0000-0000-0000000000e5';
  if v_cnt <> 0 then raise exception 'FAIL: une réservation a été créée pour un cheval déjà couvert (%)', v_cnt; end if;
  raise notice 'PASS: cheval déjà couvert par une autre réservation rejeté — voir ERROR ci-dessus, attendue';
end $$;

\echo '=== [13] RETRAIT D''UN CHEVAL COUVERT : tentative de retirer Tornado de rcM — doit échouer ==='
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
delete from public.box_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e5' and cheval_id='00000000-0000-0000-0000-0000000000f1';
reset role;
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from public.box_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e5' and cheval_id='00000000-0000-0000-0000-0000000000f1')
  then raise exception 'FAIL: un cheval couvert par une réservation vivante a pu être retiré de la recherche'; end if;
  raise notice 'PASS: retrait d''un cheval couvert refusé (silencieux, 0 ligne affectée par la RLS) — Tornado toujours dans rcM';
end $$;

\echo '=== [14] MÊME RÉPONSE RÉUTILISÉE : a1 réutilise rpa2 pour Jazz (1 cheval, capacité restante sur l''annonce a2) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_box_recherche_response(
  '00000000-0000-0000-0000-0000000000b2',
  array['00000000-0000-0000-0000-0000000000f4']::uuid[]
) as res2 \gset
reset role;
select set_config('test.res2', :'res2', false);
do $$
declare v_ids uuid[]; v_cnt_rp int;
begin
  v_ids := current_setting('test.res2')::uuid[];
  if array_length(v_ids,1) <> 1 then raise exception 'FAIL: 1 réservation attendue pour Jazz (obtenu %)', array_length(v_ids,1); end if;

  select count(*) into v_cnt_rp from public.box_reservations where recherche_reponse_id = '00000000-0000-0000-0000-0000000000b2';
  if v_cnt_rp <> 4 then raise exception 'FAIL: la réponse rpa2 devrait avoir produit 4 réservations au total (3 de [11] + 1 ici, obtenu %)', v_cnt_rp; end if;

  if not exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000e5' and status='open')
  then raise exception 'FAIL: rcM aurait dû rester open (4/5 couverts)'; end if;

  raise notice 'PASS: même réponse (rpa2) réutilisée pour une 2e acceptation partielle — rpa2 porte 4 réservations au total, rcM reste open (4/5)';
end $$;

\echo '=== [15] DEUXIÈME OFFREUR : a1 accepte rpa3 (a3) pour Oslo — dernier cheval, rcM doit passer matched ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_box_recherche_response(
  '00000000-0000-0000-0000-0000000000b3',
  array['00000000-0000-0000-0000-0000000000f5']::uuid[]
) as res3 \gset
reset role;
select set_config('test.res3', :'res3', false);
do $$
declare v_ids uuid[]; v_res record;
begin
  v_ids := current_setting('test.res3')::uuid[];
  select * into v_res from public.box_reservations where id = v_ids[1];
  if v_res.seller_id <> '00000000-0000-0000-0000-0000000000a3' then raise exception 'FAIL: seller_id incorrect (%, attendu a3)', v_res.seller_id; end if;
  if v_res.price_total_ht <> 60 or v_res.platform_commission <> 3 or v_res.price_total_ttc <> 63 then
    raise exception 'FAIL: montants réservation a3 incorrects (ht=%, comm=%, ttc=%)', v_res.price_total_ht, v_res.platform_commission, v_res.price_total_ttc;
  end if;
  if not exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000e5' and status='matched')
  then raise exception 'FAIL: rcM aurait dû passer matched (5/5 couverts par 2 offreurs)'; end if;
  raise notice 'PASS: 2e offreur (a3) couvre le dernier cheval — rcM passe matched (5/5), montants propres à cette réservation';
end $$;

\echo '=== [16] PREUVE SÉQUENTIELLE ANTI-DOUBLE-ACCEPTATION (concurrence réelle non simulable en psql séquentiel) ==='
\echo '    Le verrou FOR UPDATE sur la ligne recherche (pris AVANT tout verrou réponse)'
\echo '    sérialise toute paire d''acceptations concurrentes visant la même recherche.'
\echo '    Preuve du résultat final équivalent en séquentiel : tenter à nouveau Oslo (déjà couvert par [15]).'
\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_box_recherche_response(
  '00000000-0000-0000-0000-0000000000b2',
  array['00000000-0000-0000-0000-0000000000f5']::uuid[]
);
reset role;
\set ON_ERROR_STOP on
do $$ declare v_cnt int; begin
  select count(*) into v_cnt from public.box_reservations
   where cheval_id='00000000-0000-0000-0000-0000000000f5' and recherche_id='00000000-0000-0000-0000-0000000000e5'
     and status in ('accepted','awaiting_payment','paid','completed');
  if v_cnt <> 1 then raise exception 'FAIL: Oslo couvert par % réservations vivantes (attendu 1)', v_cnt; end if;
  raise notice 'PASS: nouvelle tentative sur un cheval déjà couvert rejetée — voir ERROR ci-dessus, attendue';
end $$;

-- ============================================================================
-- [17] CAPACITÉ INSUFFISANTE — ROLLBACK ATOMIQUE COMPLET
-- ============================================================================
\echo '=== [17] rcLow (2 chevaux : Balou + Duke) vs annonce à 1 box — la 2e ligne doit tout annuler ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.box_recherches (id, demandeur_id, lieu, date_debut, date_fin)
  values ('00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-0000000000a1','Vétérinaire','2026-11-01','2026-11-03');
insert into public.box_recherche_chevaux (recherche_id, cheval_id) values
  ('00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-0000000000f6'),
  ('00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-0000000000f8');
reset role;
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
insert into public.box_recherche_reponses (id, recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000b9','00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-0000000000a2');
reset role;

\set ON_ERROR_STOP off
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_box_recherche_response(
  '00000000-0000-0000-0000-0000000000b9',
  array['00000000-0000-0000-0000-0000000000f6','00000000-0000-0000-0000-0000000000f8']::uuid[]
);
reset role;
\set ON_ERROR_STOP on

do $$ declare v_cnt int; begin
  -- Point critique de la demande de Dan : la 1re ligne (Balou) aurait pu
  -- s'insérer+accepter AVANT que la 2e (Duke) échoue sur la capacité — on
  -- vérifie ici qu'AUCUNE des deux ne survit (rollback de la fonction entière).
  select count(*) into v_cnt from public.box_reservations where box_id='00000000-0000-0000-0000-0000000000d9';
  if v_cnt <> 0 then raise exception 'FAIL: % réservation(s) survivent malgré capacité insuffisante (rollback partiel !)', v_cnt; end if;

  if not exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000e9' and status='open')
  then raise exception 'FAIL: rcLow passée matched malgré l''échec de capacité'; end if;

  raise notice 'PASS: capacité insuffisante (2 chevaux vs 1 box) → échec propre, ROLLBACK ATOMIQUE COMPLET (0 réservation, y compris celle qui avait réussi avant l''échec), rcLow toujours open';
end $$;

\echo '=== [18] ANNULATION PARTIELLE : annulation de la réservation de Jazz (res2) — cheval libéré, rcM repasse open ==='
update public.box_reservations set status = 'cancelled' where id = (current_setting('test.res2')::uuid[])[1];
do $$ begin
  if exists (
    select 1 from public.box_reservations
     where cheval_id='00000000-0000-0000-0000-0000000000f4' and recherche_id='00000000-0000-0000-0000-0000000000e5'
       and status in ('accepted','awaiting_payment','paid','completed')
  ) then raise exception 'FAIL: Jazz encore compté comme couvert après annulation de sa réservation'; end if;

  if not exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000e5' and status='open')
  then raise exception 'FAIL: rcM aurait dû repasser open après annulation (4/5 couverts, Jazz libéré)'; end if;

  raise notice 'PASS: annulation d''une réservation partielle libère son cheval (Jazz) et fait repasser rcM de matched à open (4/5)';
end $$;

\echo '=== [19] V1 INTACTE : réservation directe SANS recherche (parcours reserver-box.tsx classique) ==='
insert into public.box_reservations (box_id, buyer_id, title, lieu, nb_nuits, date_debut, date_fin, status)
  values ('00000000-0000-0000-0000-000000000da2','00000000-0000-0000-0000-0000000000a3','Résa V1 directe','Écurie du Golfe',1,'2026-11-05','2026-11-06','pending')
  returning id as res_v1 \gset
update public.box_reservations set status = 'accepted' where id = :'res_v1';
select set_config('test.resv1', :'res_v1', false);
do $$
declare v_res record;
begin
  select * into v_res from public.box_reservations where id = current_setting('test.resv1')::uuid;
  if v_res.recherche_id is not null or v_res.recherche_reponse_id is not null then
    raise exception 'FAIL: réservation V1 directe a hérité de colonnes recherche (recherche_id=%, recherche_reponse_id=%)', v_res.recherche_id, v_res.recherche_reponse_id;
  end if;
  if v_res.price_total_ht <> 25 or v_res.seller_id <> '00000000-0000-0000-0000-0000000000a2' then
    raise exception 'FAIL: triggers 051-stub non appliqués correctement au flux V1 direct (ht=%, seller=%)', v_res.price_total_ht, v_res.seller_id;
  end if;
  raise notice 'PASS: flux V1 direct (sans recherche) inchangé — prix/seller_id corrects, recherche_id/recherche_reponse_id restent NULL';
end $$;

-- ============================================================================
-- [20-24] TRAÇABILITÉ
-- ============================================================================
\echo '=== [20] MÊME CHEVAL DANS 2 RECHERCHES DIFFÉRENTES : autorisé (pas de contrainte globale) ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.box_recherches (id, demandeur_id, lieu, date_debut, date_fin)
  values ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000a1','Autre écurie','2026-11-01','2026-11-03');
insert into public.box_recherche_chevaux (recherche_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000f1');
reset role;
do $$ begin
  if not exists (select 1 from public.box_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e3' and cheval_id='00000000-0000-0000-0000-0000000000f1')
  then raise exception 'FAIL: Tornado n''a pas pu être rattaché à une 2e recherche (e3)'; end if;
  if not exists (select 1 from public.box_recherche_chevaux where recherche_id='00000000-0000-0000-0000-0000000000e5' and cheval_id='00000000-0000-0000-0000-0000000000f1')
  then raise exception 'FAIL: Tornado a disparu de rcM (e5) après rattachement à e3'; end if;
  raise notice 'PASS: Tornado présent simultanément dans 2 recherches différentes (e5 et e3) — aucune contrainte globale, comme voulu';
end $$;

\echo '=== [21] SUPPRESSION RECHERCHE SANS RÉSERVATION : e3 (aucune réponse/réservation) — doit réussir ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
delete from public.box_recherches where id='00000000-0000-0000-0000-0000000000e3';
reset role;
do $$ begin
  if exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000e3')
  then raise exception 'FAIL: suppression d''une recherche sans aucune réservation refusée à tort'; end if;
  raise notice 'PASS: suppression d''une recherche jamais utilisée pour une réservation autorisée';
end $$;

\echo '=== [22] SUPPRESSION RECHERCHE AYANT PRODUIT UNE RÉSERVATION : e1 (rc1, a produit res_c1) — doit échouer ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
delete from public.box_recherches where id='00000000-0000-0000-0000-0000000000e1';
reset role;
do $$ begin
  if not exists (select 1 from public.box_recherches where id='00000000-0000-0000-0000-0000000000e1')
  then raise exception 'FAIL: une recherche ayant produit une réservation a pu être supprimée (perte d''historique)'; end if;
  raise notice 'PASS: suppression refusée (silencieuse, 0 ligne) pour une recherche ayant déjà produit une réservation — historique préservé';
end $$;

\echo '=== [23] SUPPRESSION RÉPONSE SANS RÉSERVATION : nouvelle réponse b4 sur rcLow (jamais acceptée) — doit réussir ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
insert into public.box_recherche_reponses (id, recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000b4','00000000-0000-0000-0000-0000000000e9','00000000-0000-0000-0000-000000000da3','00000000-0000-0000-0000-0000000000a3');
delete from public.box_recherche_reponses where id='00000000-0000-0000-0000-0000000000b4';
reset role;
do $$ begin
  if exists (select 1 from public.box_recherche_reponses where id='00000000-0000-0000-0000-0000000000b4')
  then raise exception 'FAIL: suppression d''une réponse pending sans aucune réservation refusée à tort'; end if;
  raise notice 'PASS: suppression d''une réponse jamais utilisée pour une réservation autorisée';
end $$;

\echo '=== [24] SUPPRESSION RÉPONSE AYANT PRODUIT DES RÉSERVATIONS : rpa2 (b2, 4 réservations) — doit échouer ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
delete from public.box_recherche_reponses where id='00000000-0000-0000-0000-0000000000b2';
reset role;
do $$ begin
  if not exists (select 1 from public.box_recherche_reponses where id='00000000-0000-0000-0000-0000000000b2')
  then raise exception 'FAIL: une réponse ayant produit des réservations a pu être supprimée (perte d''historique)'; end if;
  raise notice 'PASS: suppression refusée (silencieuse, 0 ligne) pour une réponse ayant déjà produit des réservations — historique préservé';
end $$;

-- ============================================================================
-- [25] REPLI SUR LES DATES DE L'ANNONCE (recherche sans dates propres)
-- ============================================================================
\echo '=== [25] rcNoDate (Duchesse à nouveau, autre recherche) sans date_debut/date_fin — nb_nuits dérivé de l''annonce ==='
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.box_recherches (id, demandeur_id, lieu)
  values ('00000000-0000-0000-0000-0000000000e7','00000000-0000-0000-0000-0000000000a1','Sans dates précises');
insert into public.box_recherche_chevaux (recherche_id, cheval_id)
  values ('00000000-0000-0000-0000-0000000000e7','00000000-0000-0000-0000-0000000000f9');
reset role;
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
insert into public.box_recherche_reponses (id, recherche_id, annonce_id, offreur_id)
  values ('00000000-0000-0000-0000-0000000000b7','00000000-0000-0000-0000-0000000000e7','00000000-0000-0000-0000-000000000da2','00000000-0000-0000-0000-0000000000a2');
reset role;
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select public.accept_box_recherche_response(
  '00000000-0000-0000-0000-0000000000b7',
  array['00000000-0000-0000-0000-0000000000f9']::uuid[]
) as res7 \gset
reset role;
select set_config('test.res7', :'res7', false);
do $$
declare v_ids uuid[]; v_res record;
begin
  v_ids := current_setting('test.res7')::uuid[];
  select * into v_res from public.box_reservations where id = v_ids[1];
  if v_res.date_debut <> '2026-10-20' or v_res.date_fin <> '2026-11-15' then
    raise exception 'FAIL: repli sur les dates de l''annonce incorrect (debut=%, fin=%)', v_res.date_debut, v_res.date_fin;
  end if;
  if v_res.nb_nuits <> 26 then raise exception 'FAIL: nb_nuits incorrect en repli annonce (%, attendu 26)', v_res.nb_nuits; end if;
  raise notice 'PASS: recherche sans dates propres → repli correct sur les dates de l''annonce (26 nuits)';
end $$;

-- ============================================================================
-- [26] ROLLBACK 114 + vérif propreté (110/annonces/réservations/V1 intacts)
-- ============================================================================
\echo '=== [26] ROLLBACK 114 + vérif propreté ==='
\ir ../../rollbacks/114_box_recherches_ouvertes_rollback.sql
do $$
declare v_tables text[] := array[
  'box_recherches',
  'box_recherche_chevaux',
  'box_recherche_reponses'
];
declare t text; v_col_count int; v_reservations_count int;
begin
  foreach t in array v_tables loop
    if to_regclass('public.' || t) is not null then
      raise exception 'FAIL: table % non supprimée par le rollback', t;
    end if;
  end loop;

  if exists (select 1 from pg_proc where proname = 'accept_box_recherche_response') then
    raise exception 'FAIL: RPC non supprimée par le rollback';
  end if;
  if exists (select 1 from pg_proc where proname in (
    'fn_recompute_box_recherche_status',
    'fn_sync_box_recherche_chevaux',
    'fn_sync_box_recherche_on_reservation_change'
  )) then raise exception 'FAIL: fonctions de recalcul non supprimées par le rollback'; end if;

  select count(*) into v_col_count from information_schema.columns
    where table_schema='public' and table_name='box_reservations'
      and column_name in ('recherche_id','recherche_reponse_id');
  if v_col_count <> 0 then raise exception 'FAIL: colonnes recherche_id/recherche_reponse_id encore présentes sur box_reservations (%)', v_col_count; end if;

  if to_regclass('public.concours_presence_chevaux') is null then
    raise exception 'FAIL: le rollback 114 a supprimé une table de 110 — ne devait PAS arriver';
  end if;
  if to_regclass('public.box_annonces') is null then
    raise exception 'FAIL: le rollback 114 a touché box_annonces — ne devait PAS arriver';
  end if;

  -- V1 : les LIGNES de réservations (issues du parcours recherche ET du
  -- parcours V1 direct) doivent SURVIVRE au rollback — seules les 2 colonnes
  -- de traçabilité disparaissent, jamais les données.
  select count(*) into v_reservations_count from public.box_reservations;
  if v_reservations_count <> 8 then
    raise exception 'FAIL: réservations perdues/ajoutées par le rollback (% restantes, attendu 8 : res_c1 + 3(res1) + res2(cancelled) + res3 + résa V1 directe + res7)', v_reservations_count;
  end if;

  raise notice 'PASS: rollback 114 propre — 3 tables + 3 fonctions + RPC absentes, colonnes ALTER retirées de box_reservations, 110/annonces intacts, % lignes de réservations V1/historiques préservées', v_reservations_count;
end $$;

\echo '=== HARNESS 114 TERMINÉ — tous les PASS ci-dessus ==='
