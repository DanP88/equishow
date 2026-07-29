-- ─────────────────────────────────────────────────────────────────────────────
-- Harness 103 — Suppression de profiles / roles + intégrité globale
--
-- Usage (après application de mig 103 en production) :
--   supabase db query --linked -f supabase/tests/103_drop_profiles_roles/harness.sql
--
-- Résultat attendu : toutes les lignes = PASS (13 tests)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── H1 : public.profiles absente de pg_class ─────────────────────────────────
select
  'H1' as test,
  'public.profiles supprimée (absente de pg_class)' as description,
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL — profiles toujours présente dans pg_class : ' || count(*)::text || ' entrée(s)'
  end as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'profiles' and c.relkind = 'r'

union all

-- ── H2 : public.roles absente de pg_class ────────────────────────────────────
select
  'H2',
  'public.roles supprimée (absente de pg_class)',
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL — roles toujours présente dans pg_class : ' || count(*)::text || ' entrée(s)'
  end
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'roles' and c.relkind = 'r'

union all

-- ── H3 : 0 policy résiduelle sur profiles ou roles ───────────────────────────
select
  'H3',
  '0 policy résiduelle sur profiles / roles',
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL — ' || count(*)::text || ' policy(ies) résiduelles'
  end
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('profiles', 'roles')

union all

-- ── H4 : 0 vue référençant profiles ou roles ─────────────────────────────────
select
  'H4',
  '0 vue référençant profiles ou roles',
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL — ' || count(*)::text || ' vue(s) référencent encore profiles/roles'
  end
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('v', 'm') and n.nspname = 'public'
  and (
    replace(pg_get_viewdef(c.oid), 'coach_profiles', '') ilike '%profiles%'
    or pg_get_viewdef(c.oid) ilike '%public.roles%'
    or pg_get_viewdef(c.oid) ilike '% from roles%'
    or pg_get_viewdef(c.oid) ilike '% join roles%'
  )

union all

-- ── H5 : 0 fonction référençant profiles ou roles ────────────────────────────
select
  'H5',
  '0 fonction référençant profiles ou roles',
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL — ' || count(*)::text || ' fonction(s) référencent encore profiles/roles : '
         || string_agg(p.proname, ', ')
  end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    replace(pg_get_functiondef(p.oid), 'coach_profiles', '') ilike '%profiles%'
    or pg_get_functiondef(p.oid) ilike '%public.roles%'
    or pg_get_functiondef(p.oid) ilike '% from roles%'
    or pg_get_functiondef(p.oid) ilike '% join roles%'
  )

union all

-- ── H6 : is_app_admin() toujours présente ────────────────────────────────────
select
  'H6',
  'is_app_admin() toujours présente',
  case
    when count(*) = 1 then 'PASS'
    else 'FAIL — is_app_admin() absente ou dupliquée : ' || count(*)::text
  end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'is_app_admin'

union all

-- ── H7 : is_app_admin() toujours SECURITY DEFINER ────────────────────────────
select
  'H7',
  'is_app_admin() toujours SECURITY DEFINER',
  case
    when count(*) = 1 then 'PASS'
    else 'FAIL — is_app_admin() non SECURITY DEFINER ou absente'
  end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_app_admin'
  and p.prosecdef = true

union all

-- ── H8 : ≥ 17 policies admin utilisent is_app_admin() ────────────────────────
select
  'H8',
  '≥ 17 policies admin utilisent is_app_admin() (autorisation admin intacte)',
  case
    when count(*) >= 17 then 'PASS'
    else 'FAIL — seulement ' || count(*)::text || ' policies (attendu ≥ 17) : régression admin ?'
  end
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
where pg_get_expr(pol.polqual,      pol.polrelid) ilike '%is_app_admin%'
   or pg_get_expr(pol.polwithcheck, pol.polrelid) ilike '%is_app_admin%'

union all

-- ── H9 : handle_new_user_v2 présente et ne référence pas profiles ─────────────
select
  'H9',
  'handle_new_user_v2 présente et n''insère que dans users (pas profiles)',
  case
    when count(*) = 1
     and (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname='handle_new_user_v2') ilike '%insert into public.users%'
     and (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.proname='handle_new_user_v2') not ilike '%profiles%'
    then 'PASS'
    else 'FAIL — handle_new_user_v2 absente, incorrecte ou référence profiles'
  end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'handle_new_user_v2'

union all

-- ── H10 : public.users toujours présente avec les colonnes critiques ──────────
select
  'H10',
  'public.users présente avec colonnes id / email / role / nom / prenom',
  case
    when count(*) = 5 then 'PASS'
    else 'FAIL — seulement ' || count(*)::text || '/5 colonnes critiques présentes dans users'
  end
from information_schema.columns
where table_schema = 'public'
  and table_name = 'users'
  and column_name in ('id', 'email', 'role', 'nom', 'prenom')

union all

-- ── H11 : transport_annonces.auteur_id toujours → users (pas cassée) ─────────
select
  'H11',
  'transport_annonces.auteur_id → users (FK intacte après drop profiles)',
  case
    when (
      select ccu.table_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = 'public'
        and tc.table_name = 'transport_annonces'
        and kcu.column_name = 'auteur_id'
    ) = 'users'
    then 'PASS'
    else 'FAIL — auteur_id ne pointe plus vers users (régression inattendue)'
  end

union all

-- ── H12 : transport_reservations.seller_id / buyer_id toujours → users ────────
select
  'H12',
  'transport_reservations FK seller_id + buyer_id → users intactes',
  case
    when count(*) = 2 then 'PASS'
    else 'FAIL — seulement ' || count(*)::text || '/2 FK transport_reservations → users'
  end
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name = 'transport_reservations'
  and kcu.column_name in ('seller_id', 'buyer_id')
  and ccu.table_name = 'users'

union all

-- ── H13 : set_updated_at() toujours présente (fonction partagée, pas droppée) ─
select
  'H13',
  'set_updated_at() toujours présente (fonction générique partagée)',
  case
    when count(*) >= 1 then 'PASS'
    else 'FAIL — set_updated_at() a disparu avec le trigger trg_profiles_updated_at'
  end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'set_updated_at'

order by test;
