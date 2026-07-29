-- ─────────────────────────────────────────────────────────────────────────────
-- Harness 101 — Suppression de is_admin() + intégrité is_app_admin()
--
-- Usage (inline CLI, pas de \echo) :
--   supabase db query --linked -f supabase/tests/101_drop_is_admin/harness.sql
--
-- Résultat attendu : toutes les lignes = PASS
-- ─────────────────────────────────────────────────────────────────────────────

select * from (

  -- H1 : is_admin() n'existe plus dans pg_proc
  select
    'H1' as test,
    'is_admin() supprimée de pg_proc' as description,
    case
      when count(*) = 0 then 'PASS'
      else 'FAIL — is_admin() toujours présente dans pg_proc : ' || count(*)::text || ' occurrence(s)'
    end as result
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'is_admin'

  union all

  -- H2 : is_app_admin() existe toujours
  select
    'H2',
    'is_app_admin() toujours présente dans pg_proc',
    case
      when count(*) = 1 then 'PASS'
      else 'FAIL — is_app_admin() absente ou dupliquée : ' || count(*)::text || ' occurrence(s)'
    end
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'is_app_admin'

  union all

  -- H3 : is_app_admin() est SECURITY DEFINER
  select
    'H3',
    'is_app_admin() est SECURITY DEFINER',
    case
      when count(*) = 1 then 'PASS'
      else 'FAIL — is_app_admin() non SECURITY DEFINER'
    end
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'is_app_admin'
    and p.prosecdef = true

  union all

  -- H4 : is_app_admin() lit users.role (pas profiles)
  -- Vérifie que le corps de la fonction contient 'users' et 'role' mais pas 'profiles'
  select
    'H4',
    'is_app_admin() lit users.role (corps sans profiles)',
    case
      when count(*) = 1
       and pg_get_functiondef(p.oid) ilike '%users%'
       and pg_get_functiondef(p.oid) ilike '%role%'
       and pg_get_functiondef(p.oid) not ilike '%profiles%'
      then 'PASS'
      else 'FAIL — corps inattendu : ' || coalesce(left(pg_get_functiondef(p.oid), 120), 'absent')
    end
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'is_app_admin'

  union all

  -- H5 : is_app_admin() avec auth.uid()=NULL → false
  -- En contexte service_role, auth.uid() est NULL → aucune ligne users.id=NULL → false
  select
    'H5',
    'is_app_admin() retourne false quand auth.uid() est NULL (contexte service_role)',
    case
      when public.is_app_admin() = false then 'PASS'
      else 'FAIL — is_app_admin() retourne true avec auth.uid()=NULL'
    end

  union all

  -- H6 : 0 policy live référençant is_admin
  select
    'H6',
    '0 policy live référençant is_admin()',
    case
      when count(*) = 0 then 'PASS'
      else 'FAIL — ' || count(*)::text || ' policy/policies références à is_admin() : '
           || string_agg(pol.polname, ', ')
    end
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  where pg_get_expr(pol.polqual,      pol.polrelid) ilike '%is_admin%'
     or pg_get_expr(pol.polwithcheck, pol.polrelid) ilike '%is_admin%'

  union all

  -- H7 : 0 fonction live appelant is_admin (hors is_admin elle-même)
  select
    'H7',
    '0 fonction live appelant is_admin()',
    case
      when count(*) = 0 then 'PASS'
      else 'FAIL — ' || count(*)::text || ' fonction(s) appellent encore is_admin() : '
           || string_agg(p.proname, ', ')
    end
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname <> 'is_admin'
    and pg_get_functiondef(p.oid) ilike '%is_admin%'

  union all

  -- H8 : 0 vue live référençant is_admin
  select
    'H8',
    '0 vue live référençant is_admin()',
    case
      when count(*) = 0 then 'PASS'
      else 'FAIL — ' || count(*)::text || ' vue(s) référencent is_admin() : '
           || string_agg(c.relname, ', ')
    end
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and pg_get_viewdef(c.oid) ilike '%is_admin%'

  union all

  -- H9 : is_app_admin() toujours utilisée par au moins 1 policy admin critique
  -- Vérifie que la migration n'a pas cassé les policies existantes qui la consomment
  select
    'H9',
    'is_app_admin() référencée par au moins 1 policy admin critique (audit_logs, payments…)',
    case
      when count(*) >= 1 then 'PASS'
      else 'FAIL — aucune policy ne référence is_app_admin() (régression inattendue)'
    end
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  where pg_get_expr(pol.polqual,      pol.polrelid) ilike '%is_app_admin%'
     or pg_get_expr(pol.polwithcheck, pol.polrelid) ilike '%is_app_admin%'

) t
order by test;
