-- ============================================================================
-- 116 — PUBLICATION ATOMIQUE D'UNE RECHERCHE BOX (RPC create_box_recherche)
-- ============================================================================
-- Constat (retour Dan post-Box-1, 2026-09-20) : v2/adapters/boxRecherches.ts
-- publiait une recherche via 2 appels REST séquentiels (INSERT box_recherches
-- puis INSERT box_recherche_chevaux) avec rollback CLIENT si le 2ᵉ échouait.
-- Résiduel non couvert par ce rollback client : une coupure réseau ou un
-- crash de l'app strictement ENTRE les 2 appels laisse une box_recherches
-- 'open' à 0 cheval, sans que le rollback ne s'exécute jamais. Consigne Box-1
-- explicite : ce cas doit être couvert, pas seulement documenté comme
-- résiduel accepté (contrairement à Transport 111/Lot 1, qui reste tel quel
-- — CE lot ne le retouche pas, périmètre strictement Box).
--
-- Solution : RPC SECURITY DEFINER unique, transaction Postgres unique (une
-- fonction PL/pgSQL = la transaction du caller ; toute exception à n'importe
-- quelle étape annule TOUT — aucune ligne partielle ne peut survivre, y
-- compris en cas de coupure réseau APRÈS l'appel réseau unique : soit la
-- transaction a committé en entier côté serveur, soit elle n'a rien laissé).
--
-- SECURITY DEFINER bypasse RLS pour les 2 INSERT internes → les contrôles de
-- 114 (ownership cheval, cohérence concours, anti-doublon) sont donc
-- RÉ-IMPLÉMENTÉS EXPLICITEMENT dans la fonction (même logique que la RLS
-- box_recherche_chevaux_insert_own de 114, jamais dupliquée en esprit — juste
-- déplacée côté fonction puisque RLS ne s'applique pas aux écritures internes
-- d'une fonction SECURITY DEFINER). RLS elle-même reste intacte et continue
-- de protéger tout accès direct hors RPC (aucune policy modifiée par ce lot).
--
-- Portée : AJOUTE uniquement la fonction create_box_recherche + son GRANT.
-- Ne modifie NI 114 NI 115 (fichiers non touchés). Ne crée aucune table,
-- aucun trigger, aucune policy, aucune colonne. Ne touche à AUCUNE
-- réservation, AUCUN paiement, AUCUN objet Transport.
--
-- Permissions (leçon de 115, appliquée ICI dès la création — pas de fenêtre
-- où PUBLIC/anon auraient EXECUTE) : REVOKE explicite de PUBLIC et anon juste
-- après CREATE FUNCTION (les deux reçoivent EXECUTE par défaut : PUBLIC via
-- le comportement standard Postgres, anon via `alter default privileges`
-- Supabase — cf. audit 115). Seul `authenticated` reçoit EXECUTE. Pas de
-- grant service_role : aucun appelant (Edge Function/cron) identifié, comme
-- pour 111/114 — à ajouter explicitement le jour où un besoin réel apparaît,
-- jamais par défaut.
--
-- Application : supabase db query -f <file> --linked
--   puis supabase migration repair --status applied 116. JAMAIS db push.
-- Rollback : supabase/rollbacks/116_create_box_recherche_atomic_rollback.sql
-- Tests : supabase/tests/116_create_box_recherche_atomic/harness.sql
-- ============================================================================

begin;

-- ── 0. Pré-conditions ────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.box_recherches') is null then
    raise exception '116 requiert 114 : table public.box_recherches absente.';
  end if;
  if to_regclass('public.box_recherche_chevaux') is null then
    raise exception '116 requiert 114 : table public.box_recherche_chevaux absente.';
  end if;
  if to_regclass('public.concours_presence_chevaux') is null then
    raise exception '116 requiert 110 : table public.concours_presence_chevaux absente.';
  end if;
end $$;

-- ── 1. RPC create_box_recherche ─────────────────────────────────────────────
-- p_cheval_ids : 1..N chevaux, tous réellement possédés par l'appelant, sans
-- doublon, tous engagés sur p_concours_id si celui-ci est non-null (110,
-- concours_presence_chevaux — réutilisée telle quelle, aucun mécanisme
-- parallèle). Retourne l'id de la recherche créée. Ne crée AUCUNE ligne
-- box_reservations, n'appelle AUCUNE logique Stripe/escrow.
create or replace function public.create_box_recherche(
  p_concours_id     uuid,
  p_lieu            text,
  p_date_debut      date,
  p_date_fin        date,
  p_litiere_incluse boolean,
  p_cheval_ids      uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_demandeur_id   uuid;
  v_recherche_id   uuid;
  v_nb_chevaux     integer;
  v_distinct_count integer;
  v_owned_count    integer;
  v_engaged_count  integer;
begin
  -- auth.uid() = SEULE source du demandeur — jamais un paramètre client.
  v_demandeur_id := auth.uid();
  if v_demandeur_id is null then
    raise exception 'create_box_recherche: authentification requise';
  end if;

  if p_cheval_ids is null or array_length(p_cheval_ids, 1) is null or array_length(p_cheval_ids, 1) < 1 then
    raise exception 'au moins un cheval doit être sélectionné';
  end if;
  v_nb_chevaux := array_length(p_cheval_ids, 1);

  -- Anti-doublon : un même cheval ne peut apparaître deux fois dans l'appel.
  select count(*) into v_distinct_count from (select distinct unnest(p_cheval_ids)) u;
  if v_distinct_count <> v_nb_chevaux then
    raise exception 'un cheval ne peut pas être sélectionné deux fois';
  end if;

  -- Ownership (équivalent de la RLS box_recherche_chevaux_insert_own §6/114,
  -- ré-implémenté ici car SECURITY DEFINER bypasse RLS sur les INSERT internes).
  -- Couvre aussi le cas d'un cheval_id inexistant (le count ne matchera pas).
  select count(*) into v_owned_count
    from public.chevaux c
   where c.id = any(p_cheval_ids) and c.proprietaire_id = v_demandeur_id;
  if v_owned_count <> v_nb_chevaux then
    raise exception 'un ou plusieurs chevaux ne t''appartiennent pas';
  end if;

  -- Cohérence concours (même règle que 114 §6) : si la recherche est liée à
  -- un concours, chaque cheval doit y être engagé (concours_presence_chevaux).
  if p_concours_id is not null then
    select count(*) into v_engaged_count
      from public.concours_presence_chevaux cpc
     where cpc.concours_id = p_concours_id
       and cpc.user_id = v_demandeur_id
       and cpc.cheval_id = any(p_cheval_ids);
    if v_engaged_count <> v_nb_chevaux then
      raise exception 'un ou plusieurs chevaux ne sont pas engagés sur ce concours';
    end if;
  end if;

  -- Toutes les validations sont passées AVANT le moindre INSERT : aucune
  -- ligne partielle ne peut exister à ce stade, quel que soit le point de
  -- rejet ci-dessus.
  insert into public.box_recherches (demandeur_id, concours_id, lieu, date_debut, date_fin, litiere_incluse)
    values (v_demandeur_id, p_concours_id, p_lieu, p_date_debut, p_date_fin, coalesce(p_litiere_incluse, true))
    returning id into v_recherche_id;

  -- Déclenche trg_zz_sync_box_recherche_chevaux (114) normalement — SECURITY
  -- DEFINER ne désactive AUCUN trigger, seulement les vérifications RLS.
  insert into public.box_recherche_chevaux (recherche_id, cheval_id)
    select v_recherche_id, x from unnest(p_cheval_ids) as x;

  return v_recherche_id;
end;
$fn$;

comment on function public.create_box_recherche(uuid, text, date, date, boolean, uuid[]) is
  '116 — publication atomique d''une recherche box (box_recherches + '
  'box_recherche_chevaux en une seule transaction). demandeur_id = auth.uid() '
  'exclusivement. Revalide ownership cheval + cohérence concours (même règles '
  'que la RLS 114, ré-implémentées car SECURITY DEFINER bypasse RLS sur les '
  'INSERT internes). Ne crée aucune box_reservations, aucun impact paiement.';

-- ── 2. Permissions — durcies DÈS la création (leçon de 115) ────────────────
revoke execute on function public.create_box_recherche(uuid, text, date, date, boolean, uuid[]) from public;
revoke execute on function public.create_box_recherche(uuid, text, date, date, boolean, uuid[]) from anon;
grant execute on function public.create_box_recherche(uuid, text, date, date, boolean, uuid[]) to authenticated;

commit;
