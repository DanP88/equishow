-- ============================================================================
-- 114 — RECHERCHES OUVERTES · BOX UNIQUEMENT (demande sans annonce)
-- ============================================================================
-- Lot Box-0 (audit préalable 2026-09-20, GO Dan). Mirroir architectural de la
-- migration 111 (Transport), MAIS PAS UNE COPIE : différence structurelle
-- assumée et documentée ci-dessous. Coach non concerné (reporté, cf. audit).
--
-- Périmètre : permettre à un cavalier de publier une VRAIE recherche de box
--   quand aucune annonce existante ne correspond, qu'un offreur (écurie /
--   propriétaire de box) puisse y répondre en s'appuyant sur UNE DE SES
--   ANNONCES RÉELLES (box_annonces), et que le cavalier accepte une réponse
--   via une RPC transactionnelle qui crée la ou les vraies réservations.
--
-- ── DIFFÉRENCE STRUCTURELLE ASSUMÉE : 1 RÉSERVATION BOX = 1 CHEVAL ──────────
-- Transport (111) porte un design multi-cheval PAR RÉSERVATION : une seule
--   ligne transport_reservations peut couvrir N chevaux via la table de
--   jonction transport_reservation_chevaux (nb_places = compteur libre).
-- Box ne peut PAS reproduire ce design : box_reservations n'a qu'un seul
--   `cheval_id` scalaire nullable (mig 078, jamais une jonction), et son
--   modèle de capacité (mig 104, fn_availability_box = pic de concurrence
--   PAR PÉRIODE) représente des places physiques distinctes, pas un compteur
--   fongible — 1 ligne box_reservations = 1 box physique = 1 cheval.
-- Conséquence : PAS de table box_reservation_chevaux. Une acceptation portant
--   sur N chevaux insère N lignes box_reservations distinctes (une par
--   cheval), chacune transitionnant individuellement vers 'accepted' — le
--   trigger 104 (fn_availability_box) contrôle donc la capacité réelle
--   ligne par ligne, exactement comme le ferait N réservations V1
--   successives. Si la Nᵉ ligne dépasse la capacité, toute la RPC échoue et
--   ROLLBACK (fonction PL/pgSQL = transaction unique héritée de l'appelant) :
--   aucune des N-1 lignes déjà insérées ne survit.
--
-- 3 tables (au lieu de 4 pour Transport — pas de jonction réservation×chevaux) :
--   box_recherches, box_recherche_chevaux, box_recherche_reponses.
-- 100% ADDITIF sur les tables existantes (box_annonces/box_reservations/
--   payments/escrow intacts, aucune RLS/trigger existant modifié). Deux
--   colonnes nullables ajoutées par ALTER sur la vraie table V1
--   box_reservations (recherche_id, recherche_reponse_id) — même pattern
--   additif que cheval_id (mig 078) et que 111 sur transport_reservations.
--
-- Design conservé de 111 (audité, cf. migration 051) :
--   - `annonce_id` sur une réponse est OBLIGATOIRE : le trigger
--     recalc_box_reservation_amounts (051) exige une box_annonces réelle
--     pour calculer un prix autoritaire — impossible de créer une
--     réservation sans elle.
--   - La RPC d'acceptation ne recalcule NI prix NI commission NI seller_id :
--     elle insère chaque réservation au statut 'pending' (nb_nuits dérivé
--     des dates recherche/annonce), puis fait transiter son statut vers
--     'accepted' — ce qui déclenche les triggers déjà existants et déjà
--     audités (051 prix/commission/seller_id, 104 capacité date-aware),
--     plus le nouveau trigger générique de recalcul de couverture de la
--     recherche (§9). Aucune logique Stripe/escrow à ce stade (paiement =
--     étape séparée, ultérieure, inchangée, guard 047 non modifié).
--   - Verrouillage recherche-AVANT-réponse (cohérent avec Transport 111/R1) :
--     anti-deadlock, sérialise aussi toutes les acceptations concurrentes
--     sur une même recherche — mécanisme central anti-double-affectation.
--
-- Realtime : box_annonces/box_reservations sont DÉJÀ dans la publication
--   supabase_realtime (mig 037) — contrairement à Transport (qui a nécessité
--   un "Lot 0"/mig 112 séparé), les 3 NOUVELLES tables de ce fichier sont
--   ajoutées à la publication directement ici (§10), pas de migration
--   dédiée nécessaire.
--
-- LOCAL UNIQUEMENT POUR CE LOT : non appliqué en prod, non commité, front V2
--   non branché. Rollback : supabase/rollbacks/114_box_recherches_ouvertes_rollback.sql
--   Tests : supabase/tests/114_box_recherches_ouvertes/harness.sql
--
-- Idempotent. Application future (hors périmètre de ce lot) :
--   supabase db query -f <file> --linked
--   puis supabase migration repair --status applied 114. JAMAIS db push.
-- ============================================================================

begin;

-- ── 0. Pré-conditions ────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.concours_presence_chevaux') is null then
    raise exception '114 requiert 110 : table public.concours_presence_chevaux absente.';
  end if;
  if to_regclass('public.box_annonces') is null then
    raise exception '114 requiert 005 : table public.box_annonces absente.';
  end if;
  if to_regclass('public.box_reservations') is null then
    raise exception '114 requiert 005 : table public.box_reservations absente.';
  end if;
end $$;

-- ── 1. box_recherches ─────────────────────────────────────────────────────
-- nb_box n'est pas une saisie libre : maintenu par trigger (§9b) à partir du
-- nombre de lignes dans box_recherche_chevaux. Démarre à 0 (la recherche est
-- créée avant que ses chevaux ne soient rattachés) — pas de CHECK nb_box>0
-- au niveau table pour cette raison (état transitoire légitime, comme 111).
create table if not exists public.box_recherches (
  id              uuid primary key default gen_random_uuid(),
  demandeur_id    uuid not null references public.users(id) on delete cascade,
  concours_id     uuid references public.concours(id) on delete set null,
  lieu            text,
  date_debut      date,
  date_fin        date,
  litiere_incluse boolean not null default true,
  nb_box          integer not null default 0,
  status          text not null default 'open' check (status in ('open','matched','cancelled')),
  created_at      timestamptz not null default now()
);
comment on table public.box_recherches is
  '114 — recherche de box publiée sans annonce correspondante. Hors chemin paiement. '
  'nb_box dérivé par trigger du nombre de chevaux rattachés (1 cheval = 1 box = 1 réservation).';
create index if not exists idx_box_recherches_demandeur on public.box_recherches (demandeur_id);
create index if not exists idx_box_recherches_concours on public.box_recherches (concours_id);

-- ── 2. box_recherche_chevaux (multi-cheval, périmètre FIGÉ) ────────────────
-- Même principe que transport_recherche_chevaux (111) / concours_presence_chevaux
-- (110) : FK réelles, pas de uuid[]. Jamais amputée par une acceptation (cf.
-- RLS delete §5, qui interdit le retrait d'un cheval déjà couvert par une
-- réservation vivante).
create table if not exists public.box_recherche_chevaux (
  recherche_id uuid not null references public.box_recherches(id) on delete cascade,
  cheval_id    uuid not null references public.chevaux(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (recherche_id, cheval_id)
);
create index if not exists idx_brc_cheval on public.box_recherche_chevaux (cheval_id);

-- ── 3. box_recherche_reponses ───────────────────────────────────────────────
-- Réutilisable comme 111 : PAS de reservation_id 1:1 (une réponse peut
-- engendrer N réservations, une par cheval accepté). Le lien inverse est
-- porté par la réservation elle-même (box_reservations.recherche_reponse_id).
-- « déjà utilisée » n'est jamais stocké — fait dérivé (jointure réservations).
create table if not exists public.box_recherche_reponses (
  id            uuid primary key default gen_random_uuid(),
  recherche_id  uuid not null references public.box_recherches(id) on delete cascade,
  annonce_id    uuid not null references public.box_annonces(id) on delete cascade,
  offreur_id    uuid not null references public.users(id) on delete cascade,
  message       text,
  status        text not null default 'pending' check (status in ('pending','declined')),
  created_at    timestamptz not null default now(),
  unique (recherche_id, annonce_id)
);
comment on table public.box_recherche_reponses is
  '114 — offre d''un loueur pour une recherche de box. annonce_id obligatoire '
  '(source du prix autoritaire, cf. trigger 051). RÉUTILISABLE : une réponse '
  'peut produire plusieurs réservations (box_reservations.recherche_reponse_id '
  'porte le lien inverse).';
create index if not exists idx_brr_recherche on public.box_recherche_reponses (recherche_id);
create index if not exists idx_brr_offreur on public.box_recherche_reponses (offreur_id);

-- ── 4. box_reservations : colonnes de traçabilité recherche (ALTER V1) ─────
-- ADDITIF sur la vraie table V1 (mig 005), même pattern que cheval_id (078)
-- et que 111 sur transport_reservations. Nullable, jamais renseigné hors du
-- parcours recherche → transparent pour le flux de réservation directe V1
-- (reserver-box.tsx ne les lit ni ne les écrit).
alter table public.box_reservations
  add column if not exists recherche_id uuid references public.box_recherches(id) on delete set null;
alter table public.box_reservations
  add column if not exists recherche_reponse_id uuid references public.box_recherche_reponses(id) on delete set null;
comment on column public.box_reservations.recherche_id is
  '114 — recherche d''origine si cette réservation vient du parcours recherches ouvertes. NULL en V1 direct.';
comment on column public.box_reservations.recherche_reponse_id is
  '114 — offre d''origine (traçabilité uniquement, une réponse peut produire plusieurs réservations).';
create index if not exists idx_box_reservations_recherche
  on public.box_reservations (recherche_id) where recherche_id is not null;

-- ── 5. RLS — box_recherches ─────────────────────────────────────────────────
alter table public.box_recherches enable row level security;

drop policy if exists box_recherches_select_auth on public.box_recherches;
create policy box_recherches_select_auth on public.box_recherches for select to authenticated using (true);
drop policy if exists box_recherches_insert_own on public.box_recherches;
create policy box_recherches_insert_own on public.box_recherches for insert to authenticated with check (demandeur_id = auth.uid());
-- L'owner ne peut jamais écrire 'matched' lui-même (seule la fonction de
-- recalcul §9, SECURITY DEFINER, peut l'établir).
drop policy if exists box_recherches_update_own on public.box_recherches;
create policy box_recherches_update_own on public.box_recherches for update to authenticated
  using (demandeur_id = auth.uid() and status = 'open')
  with check (demandeur_id = auth.uid() and status in ('open','cancelled'));
-- Traçabilité (cf. 111) : suppression physique interdite dès qu'au moins une
-- réservation box a été produite par cette recherche, MÊME terminée/annulée.
drop policy if exists box_recherches_delete_own on public.box_recherches;
create policy box_recherches_delete_own on public.box_recherches for delete to authenticated
  using (
    demandeur_id = auth.uid()
    and not exists (select 1 from public.box_reservations br where br.recherche_id = box_recherches.id)
  );

-- ── 6. RLS — box_recherche_chevaux (ownership cheval + cohérence concours) ──
-- INSERT : (a) la recherche appartient à l'appelant et n'est pas cancelled,
--   ET si elle est liée à un concours, le cheval doit être dans
--   concours_presence_chevaux pour CE concours et CET utilisateur (réutilise
--   la table 110, aucun mécanisme parallèle) ; (b) le cheval appartient
--   réellement à l'appelant.
-- DELETE : en plus de l'ownership, le cheval ne doit être couvert par AUCUNE
--   réservation box vivante liée à cette recherche.
alter table public.box_recherche_chevaux enable row level security;
drop policy if exists box_recherche_chevaux_select_auth on public.box_recherche_chevaux;
create policy box_recherche_chevaux_select_auth on public.box_recherche_chevaux for select to authenticated using (true);
drop policy if exists box_recherche_chevaux_insert_own on public.box_recherche_chevaux;
create policy box_recherche_chevaux_insert_own on public.box_recherche_chevaux for insert to authenticated
  with check (
    exists (
      select 1 from public.box_recherches r
      where r.id = recherche_id
        and r.demandeur_id = auth.uid()
        and r.status <> 'cancelled'
        and (
          r.concours_id is null
          or exists (
            select 1 from public.concours_presence_chevaux cpc
            where cpc.concours_id = r.concours_id
              and cpc.user_id = auth.uid()
              and cpc.cheval_id = box_recherche_chevaux.cheval_id
          )
        )
    )
    and exists (
      select 1 from public.chevaux c
      where c.id = box_recherche_chevaux.cheval_id and c.proprietaire_id = auth.uid()
    )
  );
drop policy if exists box_recherche_chevaux_delete_own on public.box_recherche_chevaux;
create policy box_recherche_chevaux_delete_own on public.box_recherche_chevaux for delete to authenticated
  using (
    exists (select 1 from public.box_recherches r where r.id = recherche_id and r.demandeur_id = auth.uid())
    and not exists (
      select 1 from public.box_reservations br
      where br.recherche_id = box_recherche_chevaux.recherche_id
        and br.cheval_id = box_recherche_chevaux.cheval_id
        and br.status in ('accepted','awaiting_payment','paid','completed')
    )
  );

-- ── 7. RLS — box_recherche_reponses (anti-IDOR annonce) ────────────────────
-- SELECT : demandeur (via la recherche) OU l'offreur lui-même.
-- INSERT : offreur_id = auth.uid() ET annonce_id appartient réellement à
--   auth.uid() ET la recherche visée est encore 'open' ET le demandeur de la
--   recherche n'est pas l'offreur (anti auto-réponse).
-- PAS de policy UPDATE pour les utilisateurs : les transitions passent
--   EXCLUSIVEMENT par la RPC accept_box_recherche_response (SECURITY DEFINER).
-- DELETE : l'offreur peut retirer sa réponse tant qu'elle est 'pending' ET
--   qu'elle n'a produit AUCUNE réservation box (même terminée/annulée).
alter table public.box_recherche_reponses enable row level security;
drop policy if exists box_recherche_reponses_select_parties on public.box_recherche_reponses;
create policy box_recherche_reponses_select_parties on public.box_recherche_reponses for select to authenticated
  using (
    offreur_id = auth.uid()
    or exists (select 1 from public.box_recherches r where r.id = recherche_id and r.demandeur_id = auth.uid())
  );
drop policy if exists box_recherche_reponses_insert_own on public.box_recherche_reponses;
create policy box_recherche_reponses_insert_own on public.box_recherche_reponses for insert to authenticated
  with check (
    offreur_id = auth.uid()
    and exists (select 1 from public.box_annonces a where a.id = annonce_id and a.auteur_id = auth.uid())
    and exists (
      select 1 from public.box_recherches r
      where r.id = recherche_id and r.status = 'open' and r.demandeur_id <> auth.uid()
    )
  );
drop policy if exists box_recherche_reponses_delete_own_pending on public.box_recherche_reponses;
create policy box_recherche_reponses_delete_own_pending on public.box_recherche_reponses for delete to authenticated
  using (
    offreur_id = auth.uid()
    and status = 'pending'
    and not exists (select 1 from public.box_reservations br where br.recherche_reponse_id = box_recherche_reponses.id)
  );

-- ── 8. Recalcul de couverture — fonction partagée ───────────────────────────
-- Seule source de vérité pour décider si une recherche box est 'open' ou
-- 'matched' : compare le périmètre figé (box_recherche_chevaux) à la
-- couverture vivante (box_reservations.cheval_id dans un statut consommant —
-- même liste que fn_availability_box 104 : accepted/awaiting_payment/paid/
-- completed — PAS 'pending', qui ne consomme pas encore de capacité). Ne
-- touche jamais une recherche 'cancelled' (état terminal manuel).
create or replace function public.fn_recompute_box_recherche_status(p_recherche_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_total int; v_covered int; v_current_status text;
begin
  select status into v_current_status from public.box_recherches where id = p_recherche_id for update;
  if not found or v_current_status = 'cancelled' then
    return;
  end if;

  select count(*) into v_total
    from public.box_recherche_chevaux where recherche_id = p_recherche_id;

  select count(distinct br.cheval_id) into v_covered
    from public.box_reservations br
    where br.recherche_id = p_recherche_id
      and br.cheval_id is not null
      and br.status in ('accepted','awaiting_payment','paid','completed');

  update public.box_recherches
    set status = case when v_total > 0 and v_covered >= v_total then 'matched' else 'open' end
    where id = p_recherche_id;
end $$;

comment on function public.fn_recompute_box_recherche_status(uuid) is
  '114 — recalcule open/matched d''une recherche box à partir de la couverture '
  'réelle (box_reservations.cheval_id × statuts vivants). Seule fonction '
  'autorisée à faire transiter une recherche vers matched.';

-- ── 8b. Trigger — ajout/retrait de cheval dans une recherche ───────────────
create or replace function public.fn_sync_box_recherche_chevaux() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_recherche_id uuid;
begin
  v_recherche_id := coalesce(new.recherche_id, old.recherche_id);
  update public.box_recherches
    set nb_box = (select count(*) from public.box_recherche_chevaux where recherche_id = v_recherche_id)
    where id = v_recherche_id;
  perform public.fn_recompute_box_recherche_status(v_recherche_id);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_zz_sync_box_recherche_chevaux on public.box_recherche_chevaux;
create trigger trg_zz_sync_box_recherche_chevaux
  after insert or delete on public.box_recherche_chevaux
  for each row execute function public.fn_sync_box_recherche_chevaux();

-- ── 8c. Trigger — changement de statut / suppression d'une réservation ─────
-- Sans effet sur les réservations V1 hors recherche (recherche_id null →
-- sortie immédiate). Ne bloque aucune transition/suppression existante
-- (aucune policy V1 box_reservations touchée) : recalcule seulement en aval.
create or replace function public.fn_sync_box_recherche_on_reservation_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_recherche_id uuid;
begin
  v_recherche_id := coalesce(new.recherche_id, old.recherche_id);
  if v_recherche_id is not null then
    perform public.fn_recompute_box_recherche_status(v_recherche_id);
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_zz_sync_box_recherche_on_reservation on public.box_reservations;
create trigger trg_zz_sync_box_recherche_on_reservation
  after insert or update of status or delete on public.box_reservations
  for each row execute function public.fn_sync_box_recherche_on_reservation_change();

-- ── 9. RPC accept_box_recherche_response (1 réservation = 1 cheval) ────────
-- SECURITY DEFINER : bypass RLS en interne, revérifie auth.uid() à chaque
-- étape sensible. Verrouillage recherche-AVANT-réponse (cohérent avec 111,
-- anti-deadlock, sérialise aussi les acceptations concurrentes sur une même
-- recherche — mécanisme central anti-double-affectation d'un cheval).
-- p_cheval_ids : 1..N chevaux, tous membres de la recherche, tous non
-- couverts par une réservation vivante de cette recherche, sans doublon.
-- Insère N lignes box_reservations (1 par cheval), chacune transitionnant
-- pending→accepted individuellement — délègue prix/commission/seller_id à
-- 051 et capacité à 104 (aucune logique dupliquée). Toute exception à
-- N'IMPORTE QUELLE étape (y compris sur la dernière ligne) fait échouer la
-- fonction entière => ROLLBACK complet (fonction PL/pgSQL = transaction
-- unique héritée de l'appelant, aucune ligne partielle ne survit).
create or replace function public.accept_box_recherche_response(p_reponse_id uuid, p_cheval_ids uuid[])
returns uuid[]
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_reponse    public.box_recherche_reponses%rowtype;
  v_recherche  public.box_recherches%rowtype;
  v_annonce    public.box_annonces%rowtype;
  v_recherche_id      uuid;
  v_reservation_id    uuid;
  v_reservation_ids   uuid[] := '{}';
  v_nb_chevaux        integer;
  v_distinct_count    integer;
  v_membership_count  integer;
  v_already_covered   integer;
  v_cheval_id         uuid;
  v_date_debut        date;
  v_date_fin          date;
  v_nb_nuits          integer;
  v_lieu              text;
begin
  if auth.uid() is null then
    raise exception 'accept_box_recherche_response: authentification requise';
  end if;

  if p_cheval_ids is null or array_length(p_cheval_ids, 1) is null or array_length(p_cheval_ids, 1) < 1 then
    raise exception 'au moins un cheval doit être sélectionné';
  end if;
  v_nb_chevaux := array_length(p_cheval_ids, 1);

  select count(*) into v_distinct_count from (select distinct unnest(p_cheval_ids)) u;
  if v_distinct_count <> v_nb_chevaux then
    raise exception 'un cheval ne peut pas être sélectionné deux fois dans la même acceptation';
  end if;

  -- Lecture NON verrouillée, juste pour identifier la recherche parente.
  select recherche_id into v_recherche_id
    from public.box_recherche_reponses
    where id = p_reponse_id;
  if not found then
    raise exception 'réponse introuvable (%)', p_reponse_id;
  end if;

  -- Verrou recherche EN PREMIER (cf. 111/R1) : sérialise toutes les
  -- acceptations concurrentes sur cette recherche.
  select * into v_recherche from public.box_recherches where id = v_recherche_id for update;
  if not found then
    raise exception 'recherche introuvable (%)', v_recherche_id;
  end if;

  select * into v_reponse from public.box_recherche_reponses where id = p_reponse_id for update;
  if not found then
    raise exception 'réponse introuvable (%)', p_reponse_id;
  end if;

  if v_recherche.demandeur_id <> auth.uid() then
    raise exception 'seul le demandeur de la recherche peut accepter une réponse';
  end if;

  if v_recherche.status <> 'open' then
    raise exception 'recherche non ouverte (statut actuel: %)', v_recherche.status;
  end if;

  if v_reponse.status <> 'pending' then
    raise exception 'réponse non disponible (statut actuel: %)', v_reponse.status;
  end if;

  select * into v_annonce from public.box_annonces where id = v_reponse.annonce_id;
  if not found then
    -- Ne devrait jamais arriver (FK on delete cascade sur la réponse), garde défensive.
    raise exception 'annonce liée introuvable (%)', v_reponse.annonce_id;
  end if;

  -- Tous les chevaux demandés doivent appartenir au périmètre FIGÉ de cette
  -- recherche (box_recherche_chevaux). Ownership déjà validée par la RLS
  -- d'insertion de cette table (§6) — pas de revalidation dupliquée ici.
  select count(*) into v_membership_count
    from public.box_recherche_chevaux
    where recherche_id = v_recherche.id and cheval_id = any(p_cheval_ids);
  if v_membership_count <> v_nb_chevaux then
    raise exception 'un ou plusieurs chevaux ne font pas partie de cette recherche';
  end if;

  -- Aucun des chevaux demandés ne doit déjà être couvert par une réservation
  -- vivante de CETTE recherche (anti-double-affectation ; protégé contre la
  -- concurrence par le verrou recherche pris plus haut).
  select count(*) into v_already_covered
    from public.box_reservations br
    where br.cheval_id = any(p_cheval_ids)
      and br.recherche_id = v_recherche.id
      and br.status in ('accepted','awaiting_payment','paid','completed');
  if v_already_covered > 0 then
    raise exception 'un ou plusieurs chevaux sont déjà couverts par une réservation en cours';
  end if;

  -- Période effective : dates de la recherche si renseignées, sinon repli
  -- sur les dates de l'annonce (mêmes règles que le front BoxReserverV2).
  v_date_debut := coalesce(v_recherche.date_debut, v_annonce.date_debut::date);
  v_date_fin   := coalesce(v_recherche.date_fin, v_annonce.date_fin::date);
  if v_date_debut is null or v_date_fin is null or v_date_fin <= v_date_debut then
    raise exception 'période invalide pour la réservation (debut=%, fin=%)', v_date_debut, v_date_fin;
  end if;
  v_nb_nuits := v_date_fin - v_date_debut;
  v_lieu := coalesce(v_annonce.lieu, v_recherche.lieu);

  -- Une ligne box_reservations PAR CHEVAL (cf. en-tête : pas de jonction,
  -- box_reservations.cheval_id porte directement l'affectation). Chaque
  -- insertion + transition est individuellement contrôlée par 051 (prix) et
  -- 104 (capacité réelle de l'annonce sur la période) — si la Nᵉ ligne
  -- dépasse la capacité, l'exception remonte et annule TOUTE la fonction.
  foreach v_cheval_id in array p_cheval_ids loop
    insert into public.box_reservations (
      box_id, buyer_id, seller_id, title, lieu, nb_nuits, date_debut, date_fin,
      message, price_total_ht, platform_commission, price_total_ttc,
      cheval_id, status, recherche_id, recherche_reponse_id
    ) values (
      v_annonce.id, v_recherche.demandeur_id, v_annonce.auteur_id,
      'Box — ' || coalesce(v_lieu, 'recherche ' || v_recherche.id::text),
      v_lieu, v_nb_nuits, v_date_debut, v_date_fin,
      coalesce(v_reponse.message, ''), 0, 0, 0,
      v_cheval_id, 'pending', v_recherche.id, p_reponse_id
    )
    returning id into v_reservation_id;

    -- Transition pending → accepted. Déclenche :
    --   - recalc_box_reservation_amounts (051)                → prix/commission/seller_id
    --   - fn_availability_box (104)                            → capacité (raise si insuffisante)
    --   - fn_sync_box_recherche_on_reservation_change (8c)      → recalcul open/matched
    update public.box_reservations set status = 'accepted' where id = v_reservation_id;

    v_reservation_ids := array_append(v_reservation_ids, v_reservation_id);
  end loop;

  return v_reservation_ids;
end;
$fn$;

comment on function public.accept_box_recherche_response(uuid, uuid[]) is
  '114 — acceptation atomique (partielle ou totale) d''une réponse à une '
  'recherche box, pour 1..N chevaux de cette recherche. Insère 1 réservation '
  'PAR CHEVAL (pas de jonction — box_reservations.cheval_id porte directement '
  'l''affectation). Une même réponse est réutilisable tant qu''il reste des '
  'chevaux non couverts et de la capacité réelle sur l''annonce. Ne duplique '
  'ni prix ni commission ni logique Stripe/escrow — délègue aux triggers '
  '051/104/8c déjà en place.';

grant execute on function public.accept_box_recherche_response(uuid, uuid[]) to authenticated;

-- ── 10. Realtime — 3 nouvelles tables (box_annonces/box_reservations déjà
--   dans la publication depuis 037 ; pas de migration séparée nécessaire) ──
-- Garde sur l'EXISTENCE de la publication elle-même (pas seulement des
-- tables) : un cluster Postgres jetable local (harness) n'a pas l'extension
-- supabase_realtime pré-configurée — no-op silencieux là, comportement réel
-- inchangé en prod où la publication existe déjà (037).
do $$
declare
  t text;
  tables text[] := array['box_recherches', 'box_recherche_chevaux', 'box_recherche_reponses'];
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach t in array tables loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
      execute format('alter table public.%I replica identity full', t);
    end if;
  end loop;
end $$;

commit;
