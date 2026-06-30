-- ============================================================================
-- 088 — USER FOLLOWS · GRAPHE SOCIAL (PR1 "réseau social des concours")
-- ============================================================================
-- Périmètre : table user_follows (follow ASYMÉTRIQUE type Instagram, sans
--   demande/acceptation) + RLS own-only en écriture + lecture authenticated
--   + RPC read-only fn_people_i_know(viewer) (graphe "personnes que je connais").
--
-- 100% ADDITIF. Ne touche NI payments, NI escrow, NI Stripe, NI webhooks,
-- NI reservations (lecture seule dans la RPC), NI notifications. Aucune
-- colonne ajoutée à une table existante.
--
-- Modèle : suivre = INSERT, désuivre = DELETE. Pas d'UPDATE. Le lien est
-- public (IDs uniquement, aucune donnée sensible exposée).
--
-- Idempotent. Application : supabase db query -f <file> --linked
--   puis supabase migration repair --status applied 088. JAMAIS db push.
-- Rollback : 088_user_follows_graph_rollback.sql
-- S'inspire du pattern 075 (concours_followers).
-- ============================================================================

begin;

-- ── 0. Pré-condition : public.users doit exister ────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    raise exception '088 requiert public.users (mig 005). Table absente.';
  end if;
end $$;

-- ── 1. Table user_follows (arête sociale asymétrique) ───────────────────────
-- PK composite (follower_id, followee_id) = anti-doublon natif (on ne suit
-- qu'une fois). check follower_id <> followee_id = pas d'auto-follow.
create table if not exists public.user_follows (
  follower_id  uuid not null references public.users(id) on delete cascade,
  followee_id  uuid not null references public.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint user_follows_no_self check (follower_id <> followee_id)
);

comment on table public.user_follows is
  '088 PR1 — graphe social. follower_id suit followee_id (asymétrique, Instagram-like). '
  'Lien public (IDs only). Hors chemin paiement.';

-- ── 2. Index ────────────────────────────────────────────────────────────────
-- "Qui me suit" (followers d'un user). follower_id couvert par préfixe gauche PK
-- (sert "qui je suis").
create index if not exists idx_user_follows_followee
  on public.user_follows (followee_id);

-- ── 3. RLS (écriture own-only, lecture authenticated) ───────────────────────
alter table public.user_follows enable row level security;

-- SELECT : tout utilisateur authentifié peut lire les liens (compteurs +
-- "est-ce que je suis X"). N'expose que des IDs.
drop policy if exists uf_select_auth on public.user_follows;
create policy uf_select_auth
  on public.user_follows for select
  to authenticated
  using (true);

-- INSERT : on ne peut créer QUE ses propres follows (follower_id = soi).
drop policy if exists uf_insert_own on public.user_follows;
create policy uf_insert_own
  on public.user_follows for insert
  to authenticated
  with check (follower_id = auth.uid());

-- DELETE : on ne peut retirer QUE ses propres follows.
drop policy if exists uf_delete_own on public.user_follows;
create policy uf_delete_own
  on public.user_follows for delete
  to authenticated
  using (follower_id = auth.uid());
-- Pas d'UPDATE : suivre = INSERT, désuivre = DELETE.

-- ── 4. RPC fn_people_i_know(viewer) — graphe "personnes que je connais" ─────
-- Read-only. Retourne (user_id, relation) en UNION de sources DÉJÀ en base.
-- relation ∈ {following, messaged, booked, club}. DISTINCT par user_id, en
-- gardant la relation la plus forte (priorité following > messaged > booked > club).
--
-- ROBUSTESSE : chaque source au-delà de user_follows est gardée par un test
-- d'existence (to_regclass / information_schema). Si une table/colonne manque,
-- la source est ignorée — la fonction ne casse jamais. Construction dynamique
-- via EXECUTE (validation différée). users.club_name n'existe PAS aujourd'hui
-- sur public.users (il est sur la table legacy public.profiles) → source 'club'
-- automatiquement ignorée (DETTE notée : normaliser les clubs dans un lot futur).
--
-- SÉCURITÉ : SECURITY DEFINER (la RPC lit des tables protégées par RLS pour
-- reconstituer le graphe), MAIS anti-énumération : un appelant authentifié ne
-- peut demander QUE son propre graphe (viewer = auth.uid()), sauf admin. En
-- contexte service_role / harness (auth.uid() NULL) la garde est inactive.
--
-- CONTRAINTE : ne lit JAMAIS public.payments. Ne retourne que des IDs + un tag.
create or replace function public.fn_people_i_know(viewer uuid)
returns table (user_id uuid, relation text)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_parts text[] := array[]::text[];
  v_sql   text;
begin
  if viewer is null then
    return;
  end if;

  -- Anti-énumération : seul mon propre graphe (sauf admin). Inactif si pas d'auth (harness).
  if auth.uid() is not null
     and viewer <> auth.uid()
     and not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  then
    raise exception 'fn_people_i_know: viewer doit être auth.uid()';
  end if;

  -- Source 1 (toujours) : follows directs.
  v_parts := array_append(v_parts,
    $q$ select followee_id as uid, 'following'::text as relation, 1 as prio
        from public.user_follows where follower_id = $1 $q$);

  -- Source 2 : messagerie (conversations 1:1, mig 038).
  if to_regclass('public.conversations') is not null then
    v_parts := array_append(v_parts,
      $q$ select case when participant_a = $1 then participant_b else participant_a end as uid,
                 'messaged'::text, 2
          from public.conversations
          where $1 in (participant_a, participant_b) $q$);
  end if;

  -- Source 3 : réservations marketplace (l'AUTRE partie). Box / Stage / Course / Transport.
  if to_regclass('public.box_reservations') is not null then
    v_parts := array_append(v_parts,
      $q$ select case when buyer_id = $1 then seller_id else buyer_id end, 'booked'::text, 3
          from public.box_reservations where $1 in (buyer_id, seller_id) $q$);
  end if;
  if to_regclass('public.stage_reservations') is not null then
    v_parts := array_append(v_parts,
      $q$ select case when cavalier_id = $1 then coach_id else cavalier_id end, 'booked'::text, 3
          from public.stage_reservations where $1 in (cavalier_id, coach_id) $q$);
  end if;
  if to_regclass('public.course_demands') is not null then
    v_parts := array_append(v_parts,
      $q$ select case when cavalier_id = $1 then coach_id else cavalier_id end, 'booked'::text, 3
          from public.course_demands where $1 in (cavalier_id, coach_id) $q$);
  end if;
  -- transport_reservations.buyer_id/seller_id → profiles(id) ; même espace UUID que users(id).
  if to_regclass('public.transport_reservations') is not null then
    v_parts := array_append(v_parts,
      $q$ select case when buyer_id = $1 then seller_id else buyer_id end, 'booked'::text, 3
          from public.transport_reservations where $1 in (buyer_id, seller_id) $q$);
  end if;

  -- Source 4 (gardée) : même club. users.club_name ABSENT aujourd'hui → ignorée.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'club_name'
  ) then
    v_parts := array_append(v_parts,
      $q$ select u2.id, 'club'::text, 4
          from public.users u1
          join public.users u2
            on u1.club_name is not null and u1.club_name = u2.club_name and u2.id <> u1.id
          where u1.id = $1 $q$);
  end if;

  v_sql :=
    'select distinct on (uid) uid::uuid as user_id, relation::text as relation '
    || 'from ( ' || array_to_string(v_parts, ' union all ') || ' ) src '
    || 'where uid is not null and uid <> $1 '
    || 'order by uid, prio';

  return query execute v_sql using viewer;
end;
$fn$;

comment on function public.fn_people_i_know(uuid) is
  '088 PR1 — graphe "personnes que je connais" (IDs + relation). UNION robuste : '
  'follows ∪ messagerie ∪ réservations (box/stage/course/transport) ∪ club(si présent). '
  'Ne lit jamais payments. Anti-énumération : viewer = auth.uid() (sauf admin).';

grant execute on function public.fn_people_i_know(uuid) to authenticated;

commit;

-- ============================================================================
-- NOTE : compteurs followers/following se lisent par COUNT(*) sur user_follows
-- (lecture authenticated autorisée, IDs uniquement). Pas de colonne dénormalisée
-- (volume faible attendu ; on évite un trigger de plus). Source 'club' = DETTE :
-- ajouter users.club_name (ou table clubs normalisée) dans un lot futur.
-- ============================================================================
