-- ============================================================================
-- 111 — RECHERCHES OUVERTES · Transport/Box/Coach (demande sans annonce)
-- ============================================================================
-- Périmètre : permettre à un cavalier de publier une VRAIE recherche quand
--   aucune annonce existante ne correspond, que des offreurs puissent y
--   répondre en s'appuyant sur UNE DE LEURS ANNONCES RÉELLES, et que le
--   cavalier accepte une réponse via une RPC transactionnelle qui crée la
--   vraie réservation (Transport = module pilote pour la RPC ; le schéma
--   Box/Coach est posé mais leur RPC viendra dans une migration ultérieure).
--
-- 10 tables : 3 recherches + 3 recherche_chevaux + 3 recherche_reponses +
--   1 reservation_chevaux (Transport uniquement, cf. design multi-chevaux
--   ci-dessous). 100% ADDITIF sur les tables déjà existantes (annonces/
--   payments/escrow intacts, aucune RLS/trigger existant modifié). Deux
--   colonnes nullables ajoutées par ALTER sur la vraie table V1
--   transport_reservations (recherche_id, recherche_reponse_id) — même
--   pattern additif que cheval_id (mig 078), transparent pour le flux V1.
--
-- ── DESIGN TRANSPORT MULTI-CHEVAUX (revu 2026-09-18, remplace la V1 du fix R3) ──
-- Règles produit validées :
--   - Une recherche porte 1..N chevaux (aucun plafond), choisis à la création.
--   - nb_places de la recherche = nombre de chevaux qu'elle porte (dérivé par
--     trigger, plus une saisie libre) : 1 cheval = 1 place.
--   - Une recherche peut être satisfaite par PLUSIEURS réservations (un ou
--     plusieurs transporteurs différents, chacun prenant un sous-ensemble des
--     chevaux). La recherche reste 'open' tant qu'au moins un cheval n'est
--     rattaché à AUCUNE réservation vivante ; elle passe 'matched' quand la
--     totalité de ses chevaux est couverte.
--   - Une même réponse (offre d'un transporteur) est RÉUTILISABLE pour
--     plusieurs acceptations successives tant que (a) la recherche a des
--     chevaux non couverts et (b) l'annonce a encore de la capacité réelle.
--     Conséquence : une réponse n'a plus de relation 1:1 avec une réservation
--     — `transport_recherche_reponses.reservation_id` disparaît (impossible
--     de le maintenir puisqu'une réponse peut engendrer N réservations). Le
--     lien inverse est porté par la réservation elle-même :
--     `transport_reservations.recherche_reponse_id` (traçabilité, pas
--     d'obligation). Le statut de la réponse redevient un simple
--     pending/declined — « déjà utilisée » n'est plus un état stocké mais un
--     fait dérivé (jointure sur les réservations qu'elle a produites).
--   - `transport_recherche_chevaux` reste le périmètre FIGÉ de la recherche
--     (jamais amputé par une acceptation). `transport_reservation_chevaux`
--     (nouvelle table) porte les chevaux réellement affectés à CHAQUE
--     réservation. Les chevaux restant à transporter = différence entre les
--     deux, recalculée en direct — jamais un champ stocké séparément.
--   - Retrait d'un cheval de `transport_recherche_chevaux` : autorisé
--     uniquement s'il n'est couvert par AUCUNE réservation vivante liée à
--     cette recherche (RLS DELETE dédiée, §11).
--   - Aucun plafond artificiel : la seule limite vient de la capacité réelle
--     de l'annonce du transporteur (trigger 053, inchangé).
--
-- Remplace entièrement le design pilote initial (RPC à 1 paramètre,
-- acceptation unique fermant toute la recherche, propagation cheval_id
-- conditionnelle) — jamais appliqué en prod, donc réécrit directement plutôt
-- que patché.
--
-- Design clé conservé (audité avant écriture, cf. migration 051) :
--   - `annonce_id` sur une réponse est OBLIGATOIRE : les triggers
--     recalc_*_amounts (051) exigent une annonce réelle pour calculer un
--     prix autoritaire — impossible de créer une réservation sans elle.
--   - La RPC d'acceptation ne recalcule NI prix NI commission NI seller_id :
--     elle insère la réservation avec `nb_places` dérivé du nombre de chevaux
--     sélectionnés à CETTE acceptation, puis fait transiter son statut vers
--     'accepted' — ce qui déclenche les triggers déjà existants et déjà
--     audités (fn_availability_transport pour la capacité,
--     recalc_transport_amounts pour le prix/commission/seller_id), plus le
--     nouveau trigger générique de recalcul de couverture de la recherche
--     (§14). Aucune logique Stripe/escrow à ce stade (paiement = étape
--     séparée, ultérieure, inchangée).
--
-- Rollback : supabase/rollbacks/111_recherches_ouvertes_rollback.sql
--   (HORS de supabase/migrations/ délibérément — 110 a montré que le CLI
--   `migration list` interprète tout fichier préfixé par un numéro dans ce
--   dossier comme une migration candidate, même un rollback. Nouvelle
--   convention à partir de 111 ; 074→110 restent inchangées par cohérence
--   historique, décision déjà actée.)
-- Tests : supabase/tests/111_recherches_ouvertes/harness.sql
--
-- Idempotent. Application : supabase db query -f <file> --linked
--   puis supabase migration repair --status applied 111. JAMAIS db push.
-- ============================================================================

begin;

-- ── 0. Pré-conditions ────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.concours_presence_chevaux') is null then
    raise exception '111 requiert 110 : table public.concours_presence_chevaux absente.';
  end if;
  if to_regclass('public.transport_annonces') is null
     or to_regclass('public.box_annonces') is null
     or to_regclass('public.coach_annonces') is null then
    raise exception '111 requiert 005/074 : tables annonces absentes.';
  end if;
  if to_regclass('public.transport_reservations') is null then
    raise exception '111 requiert 004 : table public.transport_reservations absente.';
  end if;
end $$;

-- ── 1. transport_recherches ──────────────────────────────────────────────────
-- nb_places n'est plus une saisie libre : maintenu par trigger (§14) à partir
-- du nombre de lignes dans transport_recherche_chevaux. Démarre à 0 (la
-- recherche est créée avant que ses chevaux ne soient rattachés) — pas de
-- CHECK nb_places>0 au niveau table pour cette raison (état transitoire
-- légitime), la règle « minimum 1 cheval » est portée par le flux applicatif.
create table if not exists public.transport_recherches (
  id           uuid primary key default gen_random_uuid(),
  demandeur_id uuid not null references public.users(id) on delete cascade,
  concours_id  uuid references public.concours(id) on delete set null,
  depart       text,
  destination  text,
  date_debut   date,
  date_fin     date,
  aller_retour boolean not null default false,
  nb_places    integer not null default 0,
  status       text not null default 'open' check (status in ('open','matched','cancelled')),
  created_at   timestamptz not null default now()
);
comment on table public.transport_recherches is
  '111 — recherche de transport publiée sans annonce correspondante. Hors chemin paiement. '
  'nb_places dérivé par trigger du nombre de chevaux rattachés (1 cheval = 1 place).';
create index if not exists idx_transport_recherches_demandeur on public.transport_recherches (demandeur_id);
create index if not exists idx_transport_recherches_concours on public.transport_recherches (concours_id);

-- ── 2. box_recherches (inchangé — Box hors périmètre de cette révision) ─────
create table if not exists public.box_recherches (
  id           uuid primary key default gen_random_uuid(),
  demandeur_id uuid not null references public.users(id) on delete cascade,
  concours_id  uuid references public.concours(id) on delete set null,
  lieu         text,
  date_debut   date,
  date_fin     date,
  nb_box       integer not null default 1 check (nb_box > 0),
  status       text not null default 'open' check (status in ('open','matched','cancelled')),
  created_at   timestamptz not null default now()
);
comment on table public.box_recherches is
  '111 — recherche de box publiée sans annonce correspondante. Hors chemin paiement.';
create index if not exists idx_box_recherches_demandeur on public.box_recherches (demandeur_id);
create index if not exists idx_box_recherches_concours on public.box_recherches (concours_id);

-- ── 3. coach_recherches (inchangé — Coach hors périmètre de cette révision) ─
create table if not exists public.coach_recherches (
  id           uuid primary key default gen_random_uuid(),
  demandeur_id uuid not null references public.users(id) on delete cascade,
  concours_id  uuid references public.concours(id) on delete set null,
  discipline   text,
  niveau       text,
  date_debut   date,
  date_fin     date,
  nb_seances   integer not null default 1 check (nb_seances > 0),
  status       text not null default 'open' check (status in ('open','matched','cancelled')),
  created_at   timestamptz not null default now()
);
comment on table public.coach_recherches is
  '111 — recherche de coaching publiée sans annonce correspondante. Hors chemin paiement.';
create index if not exists idx_coach_recherches_demandeur on public.coach_recherches (demandeur_id);
create index if not exists idx_coach_recherches_concours on public.coach_recherches (concours_id);

-- ── 4/5/6. Jonctions recherche × chevaux (multi-cheval, périmètre FIGÉ) ─────
-- Même principe que concours_presence_chevaux (110) : FK réelles, pas de uuid[].
-- Transport : jamais amputée par une acceptation (cf. RLS delete §11, qui
-- interdit le retrait d'un cheval déjà couvert par une réservation vivante).
create table if not exists public.transport_recherche_chevaux (
  recherche_id uuid not null references public.transport_recherches(id) on delete cascade,
  cheval_id    uuid not null references public.chevaux(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (recherche_id, cheval_id)
);
create index if not exists idx_trc_cheval on public.transport_recherche_chevaux (cheval_id);

create table if not exists public.box_recherche_chevaux (
  recherche_id uuid not null references public.box_recherches(id) on delete cascade,
  cheval_id    uuid not null references public.chevaux(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (recherche_id, cheval_id)
);
create index if not exists idx_brc_cheval on public.box_recherche_chevaux (cheval_id);

create table if not exists public.coach_recherche_chevaux (
  recherche_id uuid not null references public.coach_recherches(id) on delete cascade,
  cheval_id    uuid not null references public.chevaux(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (recherche_id, cheval_id)
);
create index if not exists idx_crc_cheval on public.coach_recherche_chevaux (cheval_id);

-- ── 7. transport_recherche_reponses ─────────────────────────────────────────
-- Design multi-cheval : PLUS de reservation_id (une réponse peut engendrer N
-- réservations, cf. §14/§15). PLUS de statut 'accepted' (« déjà utilisée »
-- est un fait dérivé, jamais stocké). status ne bouge que par action explicite
-- du demandeur (déclin manuel, non implémenté dans ce lot) ou reste 'pending'
-- indéfiniment — une réponse pending mais « épuisée » (annonce sans capacité
-- restante, ou recherche déjà entièrement couverte) est filtrée au moment de
-- l'acceptation par la RPC, jamais en réécrivant son statut.
create table if not exists public.transport_recherche_reponses (
  id            uuid primary key default gen_random_uuid(),
  recherche_id  uuid not null references public.transport_recherches(id) on delete cascade,
  annonce_id    uuid not null references public.transport_annonces(id) on delete cascade,
  offreur_id    uuid not null references public.users(id) on delete cascade,
  message       text,
  status        text not null default 'pending' check (status in ('pending','declined')),
  created_at    timestamptz not null default now(),
  unique (recherche_id, annonce_id)
);
comment on table public.transport_recherche_reponses is
  '111 — offre d''un transporteur pour une recherche. annonce_id obligatoire '
  '(source du prix autoritaire, cf. trigger 051). RÉUTILISABLE : une réponse '
  'peut produire plusieurs réservations (transport_reservations.recherche_reponse_id '
  'porte le lien inverse, une réponse n''a plus de reservation_id unique).';
create index if not exists idx_trr_recherche on public.transport_recherche_reponses (recherche_id);
create index if not exists idx_trr_offreur on public.transport_recherche_reponses (offreur_id);

-- ── 8. box_recherche_reponses (inchangé — Box hors périmètre) ──────────────
create table if not exists public.box_recherche_reponses (
  id            uuid primary key default gen_random_uuid(),
  recherche_id  uuid not null references public.box_recherches(id) on delete cascade,
  annonce_id    uuid not null references public.box_annonces(id) on delete cascade,
  offreur_id    uuid not null references public.users(id) on delete cascade,
  message       text,
  status        text not null default 'pending' check (status in ('pending','accepted','declined')),
  reservation_id uuid references public.box_reservations(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (recherche_id, annonce_id)
);
create index if not exists idx_brr_recherche on public.box_recherche_reponses (recherche_id);
create index if not exists idx_brr_offreur on public.box_recherche_reponses (offreur_id);

-- ── 9. coach_recherche_reponses (inchangé — Coach hors périmètre) ──────────
create table if not exists public.coach_recherche_reponses (
  id            uuid primary key default gen_random_uuid(),
  recherche_id  uuid not null references public.coach_recherches(id) on delete cascade,
  annonce_id    uuid not null references public.coach_annonces(id) on delete cascade,
  offreur_id    uuid not null references public.users(id) on delete cascade,
  message       text,
  status        text not null default 'pending' check (status in ('pending','accepted','declined')),
  reservation_id uuid references public.course_demands(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (recherche_id, annonce_id)
);
create index if not exists idx_crr_recherche on public.coach_recherche_reponses (recherche_id);
create index if not exists idx_crr_offreur on public.coach_recherche_reponses (offreur_id);

-- ── 9b. transport_reservation_chevaux (NOUVEAU — chevaux réels par réservation) ─
-- Quels chevaux sont réellement affectés à CHAQUE réservation (par opposition
-- au périmètre figé de la recherche, §4). Sans plafond. Écrite EXCLUSIVEMENT
-- par la RPC accept_transport_recherche_response (SECURITY DEFINER, bypass
-- RLS) — aucune policy INSERT/UPDATE/DELETE pour authenticated : même
-- principe que transport_recherche_reponses (§12), aucun chemin d'écriture
-- directe non contrôlée.
create table if not exists public.transport_reservation_chevaux (
  reservation_id uuid not null references public.transport_reservations(id) on delete cascade,
  cheval_id      uuid not null references public.chevaux(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (reservation_id, cheval_id)
);
comment on table public.transport_reservation_chevaux is
  '111 — chevaux réellement affectés à une réservation transport issue d''une '
  'recherche. Écriture réservée à accept_transport_recherche_response.';
create index if not exists idx_trvc_cheval on public.transport_reservation_chevaux (cheval_id);
create index if not exists idx_trvc_reservation on public.transport_reservation_chevaux (reservation_id);

-- ── 9c. transport_reservations : colonnes de traçabilité recherche (ALTER V1) ─
-- ADDITIF sur la vraie table V1 (mig 004), même pattern que cheval_id (078).
-- Nullable, jamais renseigné hors du parcours recherche → totalement
-- transparent pour le flux de réservation directe V1 (aucun écran, aucun hook
-- V1 ne les lit ni ne les écrit).
alter table public.transport_reservations
  add column if not exists recherche_id uuid references public.transport_recherches(id) on delete set null;
alter table public.transport_reservations
  add column if not exists recherche_reponse_id uuid references public.transport_recherche_reponses(id) on delete set null;
comment on column public.transport_reservations.recherche_id is
  '111 — recherche d''origine si cette réservation vient du parcours recherches ouvertes. NULL en V1 direct.';
comment on column public.transport_reservations.recherche_reponse_id is
  '111 — offre d''origine (traçabilité uniquement, une réponse peut produire plusieurs réservations).';
create index if not exists idx_transport_reservations_recherche
  on public.transport_reservations (recherche_id) where recherche_id is not null;

-- ── 10. RLS — recherches (3 tables) ─────────────────────────────────────────
alter table public.transport_recherches enable row level security;
alter table public.box_recherches enable row level security;
alter table public.coach_recherches enable row level security;

drop policy if exists tr_select_auth on public.transport_recherches;
create policy tr_select_auth on public.transport_recherches for select to authenticated using (true);
drop policy if exists tr_insert_own on public.transport_recherches;
create policy tr_insert_own on public.transport_recherches for insert to authenticated with check (demandeur_id = auth.uid());
-- L'owner ne peut jamais écrire 'matched' lui-même (seule la fonction de
-- recalcul §14, SECURITY DEFINER, peut l'établir) ; une recherche déjà
-- matched/cancelled devient immuable pour son owner via ce chemin direct.
drop policy if exists tr_update_own on public.transport_recherches;
create policy tr_update_own on public.transport_recherches for update to authenticated
  using (demandeur_id = auth.uid() and status = 'open')
  with check (demandeur_id = auth.uid() and status in ('open','cancelled'));
-- FIX AUDIT traçabilité (2026-09-18) : suppression physique interdite dès
-- qu'au moins une réservation transport a été produite par cette recherche,
-- MÊME si cette réservation est ensuite terminée/annulée (on regarde
-- l'existence d'une ligne dans transport_reservations, pas son statut). Le
-- statut de la recherche reste libre d'évoluer (open/matched/cancelled) —
-- seule la ligne elle-même devient immuable en suppression, pour préserver
-- l'historique recherche → réponse → réservation(s) → chevaux.
drop policy if exists tr_delete_own on public.transport_recherches;
create policy tr_delete_own on public.transport_recherches for delete to authenticated
  using (
    demandeur_id = auth.uid()
    and not exists (select 1 from public.transport_reservations tr where tr.recherche_id = transport_recherches.id)
  );

drop policy if exists br_select_auth on public.box_recherches;
create policy br_select_auth on public.box_recherches for select to authenticated using (true);
drop policy if exists br_insert_own on public.box_recherches;
create policy br_insert_own on public.box_recherches for insert to authenticated with check (demandeur_id = auth.uid());
drop policy if exists br_update_own on public.box_recherches;
create policy br_update_own on public.box_recherches for update to authenticated
  using (demandeur_id = auth.uid()) with check (demandeur_id = auth.uid());
drop policy if exists br_delete_own on public.box_recherches;
create policy br_delete_own on public.box_recherches for delete to authenticated using (demandeur_id = auth.uid());

drop policy if exists cr_select_auth on public.coach_recherches;
create policy cr_select_auth on public.coach_recherches for select to authenticated using (true);
drop policy if exists cr_insert_own on public.coach_recherches;
create policy cr_insert_own on public.coach_recherches for insert to authenticated with check (demandeur_id = auth.uid());
drop policy if exists cr_update_own on public.coach_recherches;
create policy cr_update_own on public.coach_recherches for update to authenticated
  using (demandeur_id = auth.uid()) with check (demandeur_id = auth.uid());
drop policy if exists cr_delete_own on public.coach_recherches;
create policy cr_delete_own on public.coach_recherches for delete to authenticated using (demandeur_id = auth.uid());

-- ── 11. RLS — jonctions recherche_chevaux (ownership cheval + cohérence concours) ─
-- INSERT : (a) la recherche appartient à l'appelant et n'est pas cancelled,
--   ET si elle est liée à un concours, le cheval doit être dans
--   concours_presence_chevaux pour CE concours et CET utilisateur ; (b) le
--   cheval appartient réellement à l'appelant.
-- DELETE (Transport uniquement) : en plus de l'ownership, le cheval ne doit
--   être couvert par AUCUNE réservation vivante liée à cette recherche —
--   règle produit validée 2026-09-18 : un cheval déjà affecté à une
--   réservation en cours ne peut pas disparaître du périmètre de la recherche.
alter table public.transport_recherche_chevaux enable row level security;
drop policy if exists trc_select_auth on public.transport_recherche_chevaux;
create policy trc_select_auth on public.transport_recherche_chevaux for select to authenticated using (true);
drop policy if exists trc_insert_own on public.transport_recherche_chevaux;
create policy trc_insert_own on public.transport_recherche_chevaux for insert to authenticated
  with check (
    exists (
      select 1 from public.transport_recherches r
      where r.id = recherche_id
        and r.demandeur_id = auth.uid()
        and r.status <> 'cancelled'
        and (
          r.concours_id is null
          or exists (
            select 1 from public.concours_presence_chevaux cpc
            where cpc.concours_id = r.concours_id
              and cpc.user_id = auth.uid()
              and cpc.cheval_id = transport_recherche_chevaux.cheval_id
          )
        )
    )
    and exists (
      select 1 from public.chevaux c
      where c.id = transport_recherche_chevaux.cheval_id and c.proprietaire_id = auth.uid()
    )
  );
drop policy if exists trc_delete_own on public.transport_recherche_chevaux;
create policy trc_delete_own on public.transport_recherche_chevaux for delete to authenticated
  using (
    exists (select 1 from public.transport_recherches r where r.id = recherche_id and r.demandeur_id = auth.uid())
    and not exists (
      select 1 from public.transport_reservation_chevaux trvc
      join public.transport_reservations tr on tr.id = trvc.reservation_id
      where trvc.cheval_id = transport_recherche_chevaux.cheval_id
        and tr.recherche_id = transport_recherche_chevaux.recherche_id
        and tr.statut in ('accepted','awaiting_payment','paid','completed')
    )
  );

alter table public.box_recherche_chevaux enable row level security;
drop policy if exists brc_select_auth on public.box_recherche_chevaux;
create policy brc_select_auth on public.box_recherche_chevaux for select to authenticated using (true);
drop policy if exists brc_insert_own on public.box_recherche_chevaux;
create policy brc_insert_own on public.box_recherche_chevaux for insert to authenticated
  with check (
    exists (
      select 1 from public.box_recherches r
      where r.id = recherche_id
        and r.demandeur_id = auth.uid()
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
drop policy if exists brc_delete_own on public.box_recherche_chevaux;
create policy brc_delete_own on public.box_recherche_chevaux for delete to authenticated
  using (exists (select 1 from public.box_recherches r where r.id = recherche_id and r.demandeur_id = auth.uid()));

alter table public.coach_recherche_chevaux enable row level security;
drop policy if exists crc_select_auth on public.coach_recherche_chevaux;
create policy crc_select_auth on public.coach_recherche_chevaux for select to authenticated using (true);
drop policy if exists crc_insert_own on public.coach_recherche_chevaux;
create policy crc_insert_own on public.coach_recherche_chevaux for insert to authenticated
  with check (
    exists (
      select 1 from public.coach_recherches r
      where r.id = recherche_id
        and r.demandeur_id = auth.uid()
        and (
          r.concours_id is null
          or exists (
            select 1 from public.concours_presence_chevaux cpc
            where cpc.concours_id = r.concours_id
              and cpc.user_id = auth.uid()
              and cpc.cheval_id = coach_recherche_chevaux.cheval_id
          )
        )
    )
    and exists (
      select 1 from public.chevaux c
      where c.id = coach_recherche_chevaux.cheval_id and c.proprietaire_id = auth.uid()
    )
  );
drop policy if exists crc_delete_own on public.coach_recherche_chevaux;
create policy crc_delete_own on public.coach_recherche_chevaux for delete to authenticated
  using (exists (select 1 from public.coach_recherches r where r.id = recherche_id and r.demandeur_id = auth.uid()));

-- ── 12. RLS — réponses (anti-IDOR annonce : l'offreur DOIT être l'auteur) ───
-- SELECT : demandeur (via la recherche) OU l'offreur lui-même.
-- INSERT : offreur_id = auth.uid() ET annonce_id appartient réellement à
--   auth.uid() ET la recherche visée est encore 'open' ET le demandeur de la
--   recherche n'est pas l'offreur (anti auto-réponse).
-- PAS de policy UPDATE pour les utilisateurs : les transitions passent
--   EXCLUSIVEMENT par la RPC accept_*_recherche_response (SECURITY DEFINER).
-- DELETE : l'offreur peut retirer sa réponse tant qu'elle est 'pending' ET
--   qu'elle n'a produit AUCUNE réservation transport (même terminée/annulée)
--   — suppression physique interdite au-delà, pour préserver l'historique
--   recherche → réponse → réservation(s) → chevaux (trr_delete_own_pending).
alter table public.transport_recherche_reponses enable row level security;
drop policy if exists trr_select_parties on public.transport_recherche_reponses;
create policy trr_select_parties on public.transport_recherche_reponses for select to authenticated
  using (
    offreur_id = auth.uid()
    or exists (select 1 from public.transport_recherches r where r.id = recherche_id and r.demandeur_id = auth.uid())
  );
drop policy if exists trr_insert_own on public.transport_recherche_reponses;
create policy trr_insert_own on public.transport_recherche_reponses for insert to authenticated
  with check (
    offreur_id = auth.uid()
    and exists (select 1 from public.transport_annonces a where a.id = annonce_id and a.auteur_id = auth.uid())
    and exists (
      select 1 from public.transport_recherches r
      where r.id = recherche_id and r.status = 'open' and r.demandeur_id <> auth.uid()
    )
  );
-- FIX AUDIT traçabilité (2026-09-18) : suppression physique interdite dès
-- qu'au moins une réservation a été produite par cette réponse (même
-- principe que tr_delete_own ci-dessus — MÊME si cette réservation est
-- ensuite terminée/annulée). Avant cette révision, recherche_reponse_id
-- passait juste à NULL par ON DELETE SET NULL (perte de traçabilité
-- silencieuse, tolérée initialement) ; on préserve maintenant explicitement
-- la chaîne recherche → réponse → réservation(s) → chevaux.
drop policy if exists trr_delete_own_pending on public.transport_recherche_reponses;
create policy trr_delete_own_pending on public.transport_recherche_reponses for delete to authenticated
  using (
    offreur_id = auth.uid()
    and status = 'pending'
    and not exists (select 1 from public.transport_reservations tr where tr.recherche_reponse_id = transport_recherche_reponses.id)
  );

alter table public.box_recherche_reponses enable row level security;
drop policy if exists brr_select_parties on public.box_recherche_reponses;
create policy brr_select_parties on public.box_recherche_reponses for select to authenticated
  using (
    offreur_id = auth.uid()
    or exists (select 1 from public.box_recherches r where r.id = recherche_id and r.demandeur_id = auth.uid())
  );
drop policy if exists brr_insert_own on public.box_recherche_reponses;
create policy brr_insert_own on public.box_recherche_reponses for insert to authenticated
  with check (
    offreur_id = auth.uid()
    and exists (select 1 from public.box_annonces a where a.id = annonce_id and a.auteur_id = auth.uid())
    and exists (select 1 from public.box_recherches r where r.id = recherche_id and r.status = 'open')
  );
drop policy if exists brr_delete_own_pending on public.box_recherche_reponses;
create policy brr_delete_own_pending on public.box_recherche_reponses for delete to authenticated
  using (offreur_id = auth.uid() and status = 'pending');

alter table public.coach_recherche_reponses enable row level security;
drop policy if exists crr_select_parties on public.coach_recherche_reponses;
create policy crr_select_parties on public.coach_recherche_reponses for select to authenticated
  using (
    offreur_id = auth.uid()
    or exists (select 1 from public.coach_recherches r where r.id = recherche_id and r.demandeur_id = auth.uid())
  );
drop policy if exists crr_insert_own on public.coach_recherche_reponses;
create policy crr_insert_own on public.coach_recherche_reponses for insert to authenticated
  with check (
    offreur_id = auth.uid()
    and exists (select 1 from public.coach_annonces a where a.id = annonce_id and a.auteur_id = auth.uid())
    and exists (select 1 from public.coach_recherches r where r.id = recherche_id and r.status = 'open')
  );
drop policy if exists crr_delete_own_pending on public.coach_recherche_reponses;
create policy crr_delete_own_pending on public.coach_recherche_reponses for delete to authenticated
  using (offreur_id = auth.uid() and status = 'pending');

-- ── 13. RLS — transport_reservation_chevaux ─────────────────────────────────
-- Aucune policy INSERT/UPDATE/DELETE pour authenticated : écriture réservée à
-- la RPC (SECURITY DEFINER, bypass RLS). SELECT restreint aux parties de la
-- réservation concernée (même granularité que transport_reservations_select_own).
alter table public.transport_reservation_chevaux enable row level security;
drop policy if exists trvc_select_parties on public.transport_reservation_chevaux;
create policy trvc_select_parties on public.transport_reservation_chevaux for select to authenticated
  using (
    exists (
      select 1 from public.transport_reservations tr
      where tr.id = reservation_id and (tr.buyer_id = auth.uid() or tr.seller_id = auth.uid())
    )
  );

-- ── 14. Recalcul de couverture — fonction partagée ──────────────────────────
-- Seule source de vérité pour décider si une recherche transport est 'open'
-- ou 'matched' : compare le périmètre figé (transport_recherche_chevaux) à la
-- couverture vivante (transport_reservation_chevaux jointe à des réservations
-- dans un statut consommant, même liste que fn_availability_transport 053 :
-- accepted/awaiting_payment/paid/completed — PAS 'pending', qui ne consomme
-- pas encore de capacité). Ne touche jamais une recherche 'cancelled' (état
-- terminal manuel, jamais recalculé automatiquement). Appelée par les deux
-- seuls triggers qui peuvent faire varier la couverture : §14b (ajout/retrait
-- de cheval côté recherche) et §14c (changement de statut/suppression d'une
-- réservation).
create or replace function public.fn_recompute_transport_recherche_status(p_recherche_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_total int; v_covered int; v_current_status text;
begin
  select status into v_current_status from public.transport_recherches where id = p_recherche_id for update;
  if not found or v_current_status = 'cancelled' then
    return;
  end if;

  select count(*) into v_total
    from public.transport_recherche_chevaux where recherche_id = p_recherche_id;

  select count(distinct trvc.cheval_id) into v_covered
    from public.transport_reservation_chevaux trvc
    join public.transport_reservations tr on tr.id = trvc.reservation_id
    where tr.recherche_id = p_recherche_id
      and tr.statut in ('accepted','awaiting_payment','paid','completed');

  update public.transport_recherches
    set status = case when v_total > 0 and v_covered >= v_total then 'matched' else 'open' end
    where id = p_recherche_id;
end $$;

comment on function public.fn_recompute_transport_recherche_status(uuid) is
  '111 — recalcule open/matched d''une recherche transport à partir de la '
  'couverture réelle (transport_reservation_chevaux × réservations vivantes). '
  'Seule fonction autorisée à faire transiter une recherche vers matched.';

-- ── 14b. Trigger — ajout/retrait de cheval dans une recherche ──────────────
-- Maintient nb_places (= count des chevaux) et redéclenche le recalcul de
-- couverture (ajouter un cheval à une recherche déjà 'matched' doit la
-- rouvrir automatiquement ; c'est le seul cas où 14 reçoit un total qui
-- augmente au lieu de diminuer).
create or replace function public.fn_sync_transport_recherche_chevaux() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_recherche_id uuid;
begin
  v_recherche_id := coalesce(new.recherche_id, old.recherche_id);
  update public.transport_recherches
    set nb_places = (select count(*) from public.transport_recherche_chevaux where recherche_id = v_recherche_id)
    where id = v_recherche_id;
  perform public.fn_recompute_transport_recherche_status(v_recherche_id);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_zz_sync_transport_recherche_chevaux on public.transport_recherche_chevaux;
create trigger trg_zz_sync_transport_recherche_chevaux
  after insert or delete on public.transport_recherche_chevaux
  for each row execute function public.fn_sync_transport_recherche_chevaux();

-- ── 14c. Trigger — changement de statut / suppression d'une réservation ────
-- Couvre à la fois l'acceptation (pending→accepted, déclenchée par la RPC
-- elle-même) et l'annulation (transition vers un statut non-consommant, ou
-- suppression brute de la ligne — la policy V1 transport_reservations_
-- delete_parties reste inchangée, aucun blocage ajouté : le recalcul en
-- direct rend une réservation supprimée aussi "non couvrante" qu'une
-- réservation annulée, sans avoir besoin d'interdire la suppression).
-- Sans effet sur les réservations V1 hors recherche (recherche_id null →
-- sortie immédiate).
create or replace function public.fn_sync_transport_recherche_on_reservation_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_recherche_id uuid;
begin
  v_recherche_id := coalesce(new.recherche_id, old.recherche_id);
  if v_recherche_id is not null then
    perform public.fn_recompute_transport_recherche_status(v_recherche_id);
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_zz_sync_transport_recherche_on_reservation on public.transport_reservations;
create trigger trg_zz_sync_transport_recherche_on_reservation
  after insert or update of statut or delete on public.transport_reservations
  for each row execute function public.fn_sync_transport_recherche_on_reservation_change();

-- ── 15. RPC accept_transport_recherche_response (module pilote, multi-cheval) ─
-- SECURITY DEFINER : bypass RLS en interne, revérifie auth.uid() à chaque
-- étape sensible. Verrouillage recherche-AVANT-réponse (anti-deadlock, cf.
-- audit R1 — sérialise aussi désormais toutes les acceptations concurrentes
-- sur une même recherche, ce qui est le mécanisme central de protection
-- anti-double-affectation d'un cheval, cf. §4 du design).
-- p_cheval_ids : 1..N chevaux, tous membres de la recherche, tous non
-- couverts par une réservation vivante de cette recherche, sans doublon.
-- nb_places de la réservation = array_length(p_cheval_ids) — jamais recopié
-- depuis un champ recherche. Ne recalcule NI prix NI commission NI seller_id :
-- délègue aux triggers déjà existants et déjà audités (051 prix, 053
-- capacité) + au nouveau trigger de recalcul de couverture (§14c).
create or replace function public.accept_transport_recherche_response(p_reponse_id uuid, p_cheval_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_reponse    public.transport_recherche_reponses%rowtype;
  v_recherche  public.transport_recherches%rowtype;
  v_annonce    public.transport_annonces%rowtype;
  v_recherche_id      uuid;
  v_reservation_id    uuid;
  v_nb_places         integer;
  v_distinct_count    integer;
  v_membership_count  integer;
  v_already_covered   integer;
  v_cheval_id         uuid;
begin
  if auth.uid() is null then
    raise exception 'accept_transport_recherche_response: authentification requise';
  end if;

  if p_cheval_ids is null or array_length(p_cheval_ids, 1) is null or array_length(p_cheval_ids, 1) < 1 then
    raise exception 'au moins un cheval doit être sélectionné';
  end if;
  v_nb_places := array_length(p_cheval_ids, 1);

  select count(*) into v_distinct_count from (select distinct unnest(p_cheval_ids)) u;
  if v_distinct_count <> v_nb_places then
    raise exception 'un cheval ne peut pas être sélectionné deux fois dans la même acceptation';
  end if;

  -- Lecture NON verrouillée, juste pour identifier la recherche parente.
  select recherche_id into v_recherche_id
    from public.transport_recherche_reponses
    where id = p_reponse_id;
  if not found then
    raise exception 'réponse introuvable (%)', p_reponse_id;
  end if;

  -- Verrou recherche EN PREMIER (cf. commentaire d'en-tête) : sérialise toutes
  -- les acceptations concurrentes sur cette recherche, quelle que soit la
  -- réponse ou les chevaux visés.
  select * into v_recherche from public.transport_recherches where id = v_recherche_id for update;
  if not found then
    raise exception 'recherche introuvable (%)', v_recherche_id;
  end if;

  select * into v_reponse from public.transport_recherche_reponses where id = p_reponse_id for update;
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

  select * into v_annonce from public.transport_annonces where id = v_reponse.annonce_id;
  if not found then
    -- Ne devrait jamais arriver (FK on delete cascade sur la réponse), garde défensive.
    raise exception 'annonce liée introuvable (%)', v_reponse.annonce_id;
  end if;

  -- Tous les chevaux demandés doivent appartenir au périmètre FIGÉ de cette
  -- recherche (transport_recherche_chevaux). Cette appartenance a déjà été
  -- validée par la RLS d'insertion de cette table (propriété réelle du cheval
  -- + cohérence concours) au moment de l'attachement — pas de revalidation
  -- dupliquée ici, juste la vérification de membership.
  select count(*) into v_membership_count
    from public.transport_recherche_chevaux
    where recherche_id = v_recherche.id and cheval_id = any(p_cheval_ids);
  if v_membership_count <> v_nb_places then
    raise exception 'un ou plusieurs chevaux ne font pas partie de cette recherche';
  end if;

  -- Aucun des chevaux demandés ne doit déjà être couvert par une réservation
  -- vivante de CETTE recherche (anti-double-affectation ; protégé contre la
  -- concurrence par le verrou recherche pris plus haut).
  select count(*) into v_already_covered
    from public.transport_reservation_chevaux trvc
    join public.transport_reservations tr on tr.id = trvc.reservation_id
    where trvc.cheval_id = any(p_cheval_ids)
      and tr.recherche_id = v_recherche.id
      and tr.statut in ('accepted','awaiting_payment','paid','completed');
  if v_already_covered > 0 then
    raise exception 'un ou plusieurs chevaux sont déjà couverts par une réservation en cours';
  end if;

  -- Étape 1 : insertion au statut pending, nb_places dérivé de la sélection.
  -- SANS toucher prix/commission/seller_id — le trigger 051 les calcule.
  -- cheval_id (scalaire, V1) volontairement laissé NULL : avec un nombre de
  -- chevaux non plafonné, un miroir sur un seul des N serait trompeur pour
  -- les écrans V1 qui le lisent — ils afficheront « aucun cheval sélectionné »
  -- jusqu'à leur migration vers transport_reservation_chevaux (chantier front V2).
  insert into public.transport_reservations (
    transport_id, buyer_id, titre, ville_depart, ville_arrivee, nb_places, message, statut,
    recherche_id, recherche_reponse_id
  ) values (
    v_annonce.id, v_recherche.demandeur_id,
    coalesce(v_recherche.destination, 'Transport — recherche ' || v_recherche.id::text),
    coalesce(v_annonce.ville_depart, v_recherche.depart, '—'),
    coalesce(v_recherche.destination, v_annonce.ville_arrivee, '—'),
    v_nb_places,
    coalesce(v_reponse.message, ''),
    'pending',
    v_recherche.id, p_reponse_id
  )
  returning id into v_reservation_id;

  -- Étape 2 : chevaux réellement affectés à cette réservation.
  foreach v_cheval_id in array p_cheval_ids loop
    insert into public.transport_reservation_chevaux (reservation_id, cheval_id)
      values (v_reservation_id, v_cheval_id);
  end loop;

  -- Étape 3 : transition pending → accepted. Déclenche :
  --   - recalc_transport_amounts (051)                    → prix/commission/seller_id
  --   - fn_availability_transport (053)                    → capacité (raise si insuffisante)
  --   - fn_sync_transport_recherche_on_reservation_change (14c) → recalcul open/matched
  -- Toute exception à n'importe quelle étape => ROLLBACK complet automatique
  -- (aucune modification partielle persistante : ni réservation, ni jonction
  -- chevaux, ni changement de statut de la recherche).
  update public.transport_reservations set statut = 'accepted' where id = v_reservation_id;

  return v_reservation_id;
end;
$fn$;

comment on function public.accept_transport_recherche_response(uuid, uuid[]) is
  '111 — acceptation atomique (partielle ou totale) d''une réponse à une '
  'recherche transport, pour 1..N chevaux de cette recherche. Une même réponse '
  'est réutilisable tant qu''il reste des chevaux non couverts et de la '
  'capacité réelle sur l''annonce. Ne duplique ni prix ni commission ni '
  'logique Stripe/escrow — délègue aux triggers 051/053/14c déjà en place. '
  'Transport = module pilote ; Box/Coach suivront dans une migration ultérieure.';

-- Ancienne signature à 1 paramètre (design pilote initial, jamais en prod) :
-- supprimée explicitement pour éviter une fonction fantôme si ce fichier a
-- déjà été exécuté une fois localement lors d'un test précédent.
drop function if exists public.accept_transport_recherche_response(uuid);

grant execute on function public.accept_transport_recherche_response(uuid, uuid[]) to authenticated;

commit;
