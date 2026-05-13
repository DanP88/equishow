-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 018 — Drop le trigger legacy `on_auth_user_created` sur auth.users.
--
-- Le trigger (créé en mig 001) insère dans `public.profiles` à chaque création
-- d'utilisateur. `public.profiles` est la table LEGACY — depuis mig 005,
-- `public.users` est la source de vérité métier et la création de profil se fait
-- côté front (`signUp` dans `lib/supabase.ts`).
--
-- Symptôme constaté : tous les `auth.admin.createUser()` retournent
-- "Database error checking email" (500) — le trigger crash dans une partie de
-- la transaction de création, ce qui fait remonter une erreur générique côté
-- gotrue avant même l'INSERT final.
--
-- Rollback : DROP TRIGGER + DROP FUNCTION (ne sont plus utilisés nulle part).
-- ─────────────────────────────────────────────────────────────────────────────

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- ── Vérification (non bloquante, juste pour les logs) ──────────────────────
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_trigger
  where tgname = 'on_auth_user_created' and not tgisinternal;

  if v_count = 0 then
    raise notice 'P18 cleanup: trigger on_auth_user_created dropped ✓';
  else
    raise warning 'P18 cleanup: trigger on_auth_user_created encore présent (%)', v_count;
  end if;
end$$;
