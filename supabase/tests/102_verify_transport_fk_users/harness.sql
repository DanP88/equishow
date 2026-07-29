-- ─────────────────────────────────────────────────────────────────────────────
-- Harness 102 — FK Transport → users + intégrité module Transport
--
-- Usage (inline CLI) :
--   supabase db query --linked -f supabase/tests/102_verify_transport_fk_users/harness.sql
--
-- Résultat attendu : toutes les lignes = PASS
-- ─────────────────────────────────────────────────────────────────────────────

-- ── H1 : transport_annonces.auteur_id → users (pas profiles) ─────────────────
select
  'H1' as test,
  'transport_annonces.auteur_id pointe vers users' as description,
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
    else 'FAIL — auteur_id ne pointe pas vers users'
  end as result

union all

-- ── H2 : transport_reservations.seller_id → users ───────────────────────────
select
  'H2',
  'transport_reservations.seller_id pointe vers users',
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
        and tc.table_name = 'transport_reservations'
        and kcu.column_name = 'seller_id'
    ) = 'users'
    then 'PASS'
    else 'FAIL — seller_id ne pointe pas vers users'
  end

union all

-- ── H3 : transport_reservations.buyer_id → users ────────────────────────────
select
  'H3',
  'transport_reservations.buyer_id pointe vers users',
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
        and tc.table_name = 'transport_reservations'
        and kcu.column_name = 'buyer_id'
    ) = 'users'
    then 'PASS'
    else 'FAIL — buyer_id ne pointe pas vers users'
  end

union all

-- ── H4 : 0 FK Transport référençant profiles ────────────────────────────────
select
  'H4',
  '0 FK transport_* référençant profiles',
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL — ' || count(*)::text || ' FK Transport pointent encore vers profiles'
  end
from pg_constraint c
join pg_class rel on rel.oid = c.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where c.contype = 'f'
  and n.nspname = 'public'
  and rel.relname like 'transport%'
  and c.confrelid = 'public.profiles'::regclass

union all

-- ── H5 : ON DELETE CASCADE confirmé sur les 3 FK Transport → users ──────────
select
  'H5',
  'ON DELETE CASCADE sur auteur_id / seller_id / buyer_id',
  case
    when count(*) = 3 then 'PASS'
    else 'FAIL — seulement ' || count(*)::text || '/3 FK ont ON DELETE CASCADE'
  end
from pg_constraint c
join pg_class rel on rel.oid = c.conrelid
join pg_class ref on ref.oid = c.confrelid
join pg_namespace n on n.oid = rel.relnamespace
where c.contype = 'f'
  and n.nspname = 'public'
  and rel.relname in ('transport_annonces', 'transport_reservations')
  and ref.relname = 'users'
  and (select attname from pg_attribute where attrelid=c.conrelid and attnum=c.conkey[1])
      in ('auteur_id', 'seller_id', 'buyer_id')
  and c.confdeltype = 'c'

union all

-- ── H6 : 0 ligne orpheline transport_annonces.auteur_id ─────────────────────
select
  'H6',
  '0 orphelin dans transport_annonces.auteur_id',
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL — ' || count(*)::text || ' ligne(s) orpheline(s) (auteur_id sans users)'
  end
from public.transport_annonces ta
left join public.users u on u.id = ta.auteur_id
where ta.auteur_id is not null and u.id is null

union all

-- ── H7 : 0 ligne orpheline transport_reservations seller_id / buyer_id ───────
select
  'H7',
  '0 orphelin dans transport_reservations (seller_id / buyer_id)',
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL — ' || count(*)::text || ' ligne(s) orpheline(s) (seller/buyer sans users)'
  end
from public.transport_reservations tr
left join public.users us on us.id = tr.seller_id
left join public.users ub on ub.id = tr.buyer_id
where (tr.seller_id is not null and us.id is null)
   or (tr.buyer_id  is not null and ub.id is null)

union all

-- ── H8 : contraintes FK valides (pg_constraint convalidated=true) ────────────
select
  'H8',
  'Contraintes FK Transport → users validées (non-NOT VALID)',
  case
    when count(*) = 3 then 'PASS'
    else 'FAIL — seulement ' || count(*)::text || '/3 FK sont validated'
  end
from pg_constraint c
join pg_class rel on rel.oid = c.conrelid
join pg_class ref on ref.oid = c.confrelid
join pg_namespace n on n.oid = rel.relnamespace
where c.contype = 'f'
  and n.nspname = 'public'
  and rel.relname in ('transport_annonces', 'transport_reservations')
  and ref.relname = 'users'
  and (select attname from pg_attribute where attrelid=c.conrelid and attnum=c.conkey[1])
      in ('auteur_id', 'seller_id', 'buyer_id')
  and c.convalidated = true

union all

-- ── H9 : policies RLS Transport non impactées (auteur_id, seller_id, buyer_id
--         restent les mêmes colonnes dans les expressions policy)
select
  'H9',
  'Policies RLS Transport toujours actives (≥ 3 policies sur transport_annonces)',
  case
    when count(*) >= 3 then 'PASS'
    else 'FAIL — moins de 3 policies sur transport_annonces (regression RLS ?)'
  end
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'transport_annonces'

union all

-- ── H10 : is_app_admin() toujours présente et intacte ───────────────────────
select
  'H10',
  'is_app_admin() toujours présente et SECURITY DEFINER',
  case
    when count(*) = 1 then 'PASS'
    else 'FAIL — is_app_admin() absente ou dupliquée : ' || count(*)::text
  end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_app_admin'
  and p.prosecdef = true

order by test;
