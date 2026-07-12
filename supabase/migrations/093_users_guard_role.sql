-- ============================================================================
-- 093 — SÉCURITÉ · GARDE ANTI AUTO-PROMOTION DE RÔLE (P0)
-- ============================================================================
-- VULNÉRABILITÉ (confirmée) : la policy RLS `users_update_own` (mig 005) autorise
-- l'UPDATE de sa propre ligne (USING id = auth.uid()) SANS `WITH CHECK`. Postgres
-- réutilise alors l'expression USING comme WITH CHECK — mais elle ne porte que sur
-- `id` (inchangé). La colonne `role` n'est donc PAS contrainte. Combiné au GRANT
-- `UPDATE(role)` accordé à `authenticated` et à l'absence de trigger de garde,
-- tout utilisateur authentifié pouvait exécuter :
--     update public.users set role = 'admin' where id = auth.uid();
-- et contourner la RPC `change_user_role` (qui, elle, bloque la promotion admin).
-- Impact : escalade de privilège → admin (process-refund / manage-dispute /
-- release-payment gating sur users.role='admin', + lecture PII de tous les users).
--
-- CORRECTIF (minimal, sûr, 100 % additif, réversible) : trigger BEFORE UPDATE qui
-- NEUTRALISE tout changement de `role` provenant d'une écriture DIRECTE d'un
-- utilisateur authentifié NON admin. Les chemins légitimes restent intacts :
--   • change_user_role (SECURITY DEFINER, owner=postgres) : current_user devient le
--     propriétaire (≠ 'authenticated') → garde inopérante → changement autorisé
--     (la RPC conserve son propre blocage de promotion admin) ;
--   • service_role (Edge / back-office) : current_user='service_role' → autorisé ;
--   • admin : vérif du rôle admin de l'appelant (sur l'ancien état) → autorisé.
-- Seule la tentative de changer `role` est neutralisée : les autres champs de
-- profil (full_name/phone/…) restent modifiables, et l'UPDATE n'échoue pas — le
-- rôle est simplement laissé inchangé (pas de fuite, pas de 4xx bloquant le profil).
--
-- SECURITY INVOKER (défaut) VOLONTAIRE : la garde doit lire `current_user` = le rôle
-- qui exécute réellement l'UPDATE (authenticated pour une écriture directe ; le
-- propriétaire pour un appel SECURITY DEFINER). Un SECURITY DEFINER masquerait ce
-- signal. La vérif admin utilise l'ANCIEN rôle (OLD via la ligne courante) : un
-- attaquant qui met NEW.role='admin' ne passe donc pas la vérif.
--
-- HORS PÉRIMÈTRE (non touché) : Stripe/payments/escrow/webhooks/Resend, RLS des
-- autres tables, `change_user_role` (conservée telle quelle). ⚠️ La faille PARALLÈLE
-- via public.profiles / is_admin() (audit F2) est signalée mais NON traitée ici.
--
-- Application prod (workflow Equishow) :
--   supabase db query -f supabase/migrations/093_users_guard_role.sql --linked
--   supabase migration repair --status applied 093 --linked
--   JAMAIS db push.
-- ============================================================================

begin;

create or replace function public.tg_users_guard_role()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and current_user = 'authenticated'
     and not exists (
       select 1 from public.users u
       where u.id = auth.uid() and u.role = 'admin'
     )
  then
    new.role := old.role;  -- neutralise l'auto-promotion ; le reste de l'update passe
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_guard_role on public.users;
create trigger trg_users_guard_role
  before update on public.users
  for each row
  execute function public.tg_users_guard_role();

commit;
