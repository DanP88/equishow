-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 045 — Fix P0 signup orphans (auth.users sans row public.users).
--
-- Contexte :
-- - Mig 001 avait un trigger `on_auth_user_created` qui INSERTait dans la table
--   legacy `public.profiles`. Crashait `auth.admin.createUser()` (gotrue 500
--   "Database error checking email") → drop par mig 018.
-- - Depuis mig 018, le provisioning du profil se fait côté front-end dans
--   `lib/supabase.ts:signUp` : auth.signUp() PUIS insert public.users. 2 ops
--   séparées sans transaction → si le 2e échoue (RLS / réseau / autre), l'auth
--   user existe mais sans row public.users → orpheline silencieuse.
-- - Audit 2026-05-29 : 7/12 auth users orphelins, dont 1 vrai signup du jour
--   (audit.test.0529@gmail.com). Bug ACTIF.
--
-- Solution v2 :
-- 1. Backfill idempotent des orphelins existants depuis auth.raw_user_meta_data.
-- 2. Nouveau trigger handle_new_user_v2 :
--    - SECURITY DEFINER (bypass RLS) + search_path explicite (CVE-style hardening).
--    - INSERT minimal : id, email, prenom, nom (4 NOT NULL sans default).
--    - Les autres colonnes prennent leurs defaults (role='cavalier', plan='Gratuit',
--      disciplines='{}', points=0, level='debutant', etc.).
--    - ON CONFLICT DO NOTHING : idempotent si trigger refire ou si client a déjà
--      inséré.
--    - EXCEPTION WHEN OTHERS : on ne crash JAMAIS auth.users INSERT. Log warning.
-- 3. Le client signUp() peut continuer à appeler `from('users').upsert(...)` pour
--    renseigner prenom/nom/role saisis par l'utilisateur — le trigger garantit
--    juste qu'une ligne minimale existe AVANT que le front fasse son upsert.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) Backfill orphelins existants ─────────────────────────────────────────
-- Insert idempotent depuis auth.users → public.users. Pour les valeurs métier
-- (prenom, nom, role) on extrait raw_user_meta_data si dispo, sinon defaults
-- sûrs ('Utilisateur' / '' / 'cavalier') que le user pourra modifier dans son
-- profil ensuite.

-- NB : on whitelist le rôle au signup. 'admin' ne peut JAMAIS être set via
-- raw_user_meta_data (sinon n'importe quel signup pourrait s'élever admin en
-- craftant le payload côté front). Pour les seeds admin existants, le metadata
-- 'admin' déjà présent reste tel-quel à cause de cette restriction → ils seront
-- backfillés en 'cavalier'. On les fixera manuellement par UPDATE direct
-- (service_role) si nécessaire.

insert into public.users (id, email, prenom, nom, role)
select
  au.id,
  au.email,
  coalesce(nullif(trim(au.raw_user_meta_data->>'prenom'), ''), 'Utilisateur'),
  coalesce(nullif(trim(au.raw_user_meta_data->>'nom'), ''), ''),
  case when au.raw_user_meta_data->>'role' in ('cavalier','coach','organisateur')
       then au.raw_user_meta_data->>'role'
       else 'cavalier'
  end
from auth.users au
where not exists (
  select 1 from public.users pu where pu.id = au.id
)
on conflict (id) do nothing;

-- ── 2) Trigger v2 ───────────────────────────────────────────────────────────
-- IMPORTANT : SECURITY DEFINER + search_path explicite pour éviter les
-- search_path hijacking sur fonctions definer (recommandation Supabase).

create or replace function public.handle_new_user_v2()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.users (id, email, prenom, nom, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'prenom'), ''), 'Utilisateur'),
    coalesce(nullif(trim(new.raw_user_meta_data->>'nom'), ''), ''),
    -- Whitelist rôle (cf. note backfill ci-dessus). Bloque l'auto-élévation
    -- admin via raw_user_meta_data crafté.
    case when new.raw_user_meta_data->>'role' in ('cavalier','coach','organisateur')
         then new.raw_user_meta_data->>'role'
         else 'cavalier'
    end
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Le trigger ne doit JAMAIS faire échouer auth.users INSERT (sinon signup
  -- entier KO côté gotrue). On log un warning et on laisse passer ; le client
  -- pourra re-tenter un upsert.
  raise warning 'handle_new_user_v2 failed for user % (%): %', new.id, new.email, sqlerrm;
  return new;
end;
$$;

-- Drop l'ancien trigger s'il subsiste (idempotence pour re-run), puis créer.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user_v2();

-- ── 3) Verification block (non bloquant) ────────────────────────────────────
do $$
declare
  v_orphans integer;
  v_trigger_exists integer;
begin
  -- Plus aucun orphelin après backfill ?
  select count(*) into v_orphans
  from auth.users au
  where not exists (select 1 from public.users pu where pu.id = au.id);

  if v_orphans = 0 then
    raise notice 'P0 #3 backfill: 0 orphan remaining ✓';
  else
    raise warning 'P0 #3 backfill: % orphan(s) still present', v_orphans;
  end if;

  -- Trigger v2 bien en place ?
  select count(*) into v_trigger_exists
  from pg_trigger
  where tgname = 'on_auth_user_created' and not tgisinternal;

  if v_trigger_exists = 1 then
    raise notice 'P0 #3 trigger handle_new_user_v2 installed ✓';
  else
    raise warning 'P0 #3 trigger not found after migration';
  end if;
end$$;
