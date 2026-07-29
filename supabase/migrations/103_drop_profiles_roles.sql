-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 103 — Suppression des tables legacy public.profiles et public.roles
--
-- Contexte :
--   Ces deux tables sont les vestiges de la première architecture d'Equishow.
--   Depuis, users.role / is_app_admin() est la source de vérité unique.
--
--   Audit prod 2026-07-29 :
--     • 0 FK externe sur profiles ou roles depuis d'autres tables
--     • 0 vue, fonction, policy (hors propres tables) en dépendance
--     • 6 lignes dans profiles — toutes colonnes métier NULL
--     • 4 lignes dans roles  — UUIDs de référence non utilisés
--     • 0 code actif (expo_app/, supabase/functions/) ne lit ces tables
--     • is_app_admin() lit users.role ; is_admin() supprimée (mig 101)
--     • FK Transport → users confirmées (mig 102)
--
-- Périmètre :
--   8 gardes DO EXCEPTION → DROP TABLE profiles → DROP TABLE roles
--   Aucun DROP ... CASCADE. Si une dépendance existe, la migration ÉCHOUE.
--
-- Rollback : 103_drop_profiles_roles_rollback.sql
--   Recrée roles (structure + 4 lignes de référence) puis profiles
--   (toutes colonnes, FK auth.users + roles, RLS, trigger, grants).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Étape 0 : corriger le commentaire obsolète dans fn_people_i_know ─────────
-- La fonction contient un commentaire "→ profiles(id)" (faux positif dans la garde G4
-- ci-dessous). Il s'agit d'une référence historique incorrecte : mig 102 a confirmé
-- que transport_reservations.buyer_id/seller_id pointent vers users(id) depuis mig 021.
-- On remplace le corps de la fonction avec UNIQUEMENT le commentaire corrigé.
create or replace function public.fn_people_i_know(viewer uuid)
 returns table(user_id uuid, relation text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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
  -- transport_reservations.buyer_id/seller_id → users(id) ON DELETE CASCADE (repointé mig 021).
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
$function$;

-- ── Garde 1 : 0 FK externe pointant vers profiles ────────────────────────────
-- Vérifie qu'aucune table autre que profiles elle-même ne référence profiles.
-- (profiles.id → auth.users et profiles.role_id → roles sont des FK SORTANTES
--  de profiles, non concernées ici.)
do $$
declare
  v_count int;
  v_list  text;
begin
  select count(*),
    string_agg(conrelid::regclass::text || '.' ||
      (select attname from pg_attribute where attrelid=c.conrelid and attnum=c.conkey[1]), ', ')
  into v_count, v_list
  from pg_constraint c
  where c.contype = 'f'
    and c.confrelid = 'public.profiles'::regclass;

  if v_count > 0 then
    raise exception
      '103-GUARD-1 : % FK externe(s) pointent encore vers public.profiles : %. '
      'DROP TABLE annulé.',
      v_count, v_list;
  end if;
end $$;

-- ── Garde 2 : 0 FK externe pointant vers roles (hors profiles.role_id) ───────
-- profiles.role_id → roles sera supprimée automatiquement avec DROP TABLE profiles.
-- On vérifie qu'aucune AUTRE table ne pointe vers roles.
do $$
declare
  v_count int;
  v_list  text;
begin
  select count(*),
    string_agg(conrelid::regclass::text || '.' ||
      (select attname from pg_attribute where attrelid=c.conrelid and attnum=c.conkey[1]), ', ')
  into v_count, v_list
  from pg_constraint c
  where c.contype = 'f'
    and c.confrelid = 'public.roles'::regclass
    and c.conrelid  <> 'public.profiles'::regclass;  -- exclut profiles.role_id (attendu)

  if v_count > 0 then
    raise exception
      '103-GUARD-2 : % FK externe(s) pointent encore vers public.roles (hors profiles.role_id) : %. '
      'DROP TABLE annulé.',
      v_count, v_list;
  end if;
end $$;

-- ── Garde 3 : 0 vue référençant réellement public.profiles ou public.roles ───
-- Utilise replace() pour écarter le faux positif "coach_profiles" (connu, audit 2026-07-29).
-- Vérifie également public.roles via des patterns de jointure SQL stricts.
do $$
declare
  v_count int;
  v_list  text;
begin
  select count(*),
    string_agg(c.relname, ', ')
  into v_count, v_list
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('v', 'm')
    and n.nspname = 'public'
    and (
      -- profiles : strip 'coach_profiles' pour éviter le faux positif connu
      replace(pg_get_viewdef(c.oid), 'coach_profiles', '') ilike '%profiles%'
      -- roles : patterns SQL stricts
      or pg_get_viewdef(c.oid) ilike '%public.roles%'
      or pg_get_viewdef(c.oid) ilike '% from roles%'
      or pg_get_viewdef(c.oid) ilike '% join roles%'
      or pg_get_viewdef(c.oid) like '%' || chr(10) || '%from roles%'
      or pg_get_viewdef(c.oid) like '%' || chr(10) || '%join roles%'
    );

  if v_count > 0 then
    raise exception
      '103-GUARD-3 : % vue(s) référencent encore profiles ou roles : %. '
      'Corriger avant DROP TABLE.',
      v_count, v_list;
  end if;
end $$;

-- ── Garde 4 : 0 fonction référençant réellement public.profiles ou public.roles
do $$
declare
  v_count int;
  v_list  text;
begin
  select count(*),
    string_agg(p.proname, ', ')
  into v_count, v_list
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (
      replace(pg_get_functiondef(p.oid), 'coach_profiles', '') ilike '%profiles%'
      or pg_get_functiondef(p.oid) ilike '%public.roles%'
      or pg_get_functiondef(p.oid) ilike '% from roles%'
      or pg_get_functiondef(p.oid) ilike '% join roles%'
    );

  if v_count > 0 then
    raise exception
      '103-GUARD-4 : % fonction(s) référencent encore profiles ou roles : %. '
      'Corriger avant DROP TABLE.',
      v_count, v_list;
  end if;
end $$;

-- ── Garde 5 : 0 policy RLS (sur d'autres tables) référençant profiles ou roles
do $$
declare
  v_count int;
  v_list  text;
begin
  select count(*),
    string_agg(pol.polname || ' ON ' || c.relname, ', ')
  into v_count, v_list
  from pg_policy pol
  join pg_class c  on c.oid  = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname not in ('profiles', 'roles')  -- exclut les policies propres aux tables
    and (
      coalesce(pg_get_expr(pol.polqual,      pol.polrelid), '') ilike '%profiles%'
      or coalesce(pg_get_expr(pol.polqual,   pol.polrelid), '') ilike '%roles%'
      or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ilike '%profiles%'
      or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ilike '%roles%'
    );

  if v_count > 0 then
    raise exception
      '103-GUARD-5 : % policy/policies d''autres tables référencent encore profiles ou roles : %. '
      'Corriger avant DROP TABLE.',
      v_count, v_list;
  end if;
end $$;

-- ── Garde 6 : is_app_admin() existe toujours ─────────────────────────────────
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'is_app_admin';

  if v_count = 0 then
    raise exception
      '103-GUARD-6 : is_app_admin() absente — état inattendu, DROP annulé.';
  end if;
end $$;

-- ── Garde 7 : is_app_admin() est SECURITY DEFINER ────────────────────────────
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'is_app_admin'
    and p.prosecdef = true;

  if v_count = 0 then
    raise exception
      '103-GUARD-7 : is_app_admin() n''est pas SECURITY DEFINER — régression inattendue, DROP annulé.';
  end if;
end $$;

-- ── Garde 8 : migrations 101 et 102 enregistrées comme appliquées ────────────
do $$
begin
  if not exists (
    select 1 from supabase_migrations.schema_migrations where version = '101'
  ) then
    raise exception
      '103-GUARD-8 : migration 101 (drop is_admin) non enregistrée — appliquer 101 avant 103.';
  end if;

  if not exists (
    select 1 from supabase_migrations.schema_migrations where version = '102'
  ) then
    raise exception
      '103-GUARD-8 : migration 102 (FK Transport assertion) non enregistrée — appliquer 102 avant 103.';
  end if;
end $$;

-- ── Suppression — sans CASCADE ────────────────────────────────────────────────
-- Ordre : profiles en premier (supprime automatiquement la FK profiles.role_id → roles,
-- le trigger trg_profiles_updated_at et les 3 policies own-row).
-- roles ensuite (plus aucune FK entrante, supprime la policy roles_select_authenticated).
--
-- Si PostgreSQL signale une dépendance restante, la migration ÉCHOUE.
-- NE PAS ajouter CASCADE pour contourner : diagnostiquer la dépendance.

drop table public.profiles;

drop table public.roles;
