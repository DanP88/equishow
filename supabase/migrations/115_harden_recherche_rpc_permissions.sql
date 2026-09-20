-- ============================================================================
-- 115 — DURCISSEMENT PERMISSIONS RPC « recherches ouvertes » (Transport + Box)
-- ============================================================================
-- Constat (audit post-114, 2026-09-20) : les 2 RPC ci-dessous ont EXECUTE
-- accordé à PUBLIC en plus de anon/authenticated/service_role. Audit de
-- l'ACL brute (pg_proc.proacl) avant ce lot :
--   {=X/postgres, postgres=X/postgres, anon=X/postgres,
--    authenticated=X/postgres, service_role=X/postgres}
-- `=X/postgres` (rôle vide) = PUBLIC, accordé par défaut à la création d'une
-- fonction (comportement standard Postgres, jamais révoqué par 111 ni 114).
-- anon/authenticated/service_role ont chacun leur PROPRE entrée EXPLICITE
-- (défaut Supabase : `alter default privileges ... grant execute on
-- functions to anon, authenticated, service_role`), indépendante de PUBLIC —
-- confirmé en lisant l'ACL brute avant d'écrire cette migration, pas supposé.
--
--   accept_transport_recherche_response(uuid, uuid[])  — mig 111
--   accept_box_recherche_response(uuid, uuid[])         — mig 114
--
-- Audit d'usage préalable (lecture seule, 2026-09-20) :
--   - Aucune Edge Function n'appelle ces RPC (grep supabase/functions : 0 hit).
--   - Seul appelant front : v2/adapters/transportRecherches.ts
--     (useAcceptTransportRechercheResponse → supabase.rpc(...), client partagé
--     app-wide, toujours en session utilisateur connecté — ces écrans sont
--     inaccessibles sans authentification). accept_box_recherche_response n'a
--     encore AUCUN appelant front (Box-1 non commencé).
--   - Le parcours démo (utilisateur non connecté) n'appelle JAMAIS ces RPC :
--     il reste 100% local (bl.book()/tl.book(), cf. v2/adapters/box.ts et
--     transport.ts — confirmé dans le code, "jamais de mocks pour un compte
--     connecté" / jamais d'appel réel pour un visiteur non connecté).
--   - Aucune dépendance légitime à `anon` identifiée.
--
-- Risque résiduel AVANT ce lot : théorique, pas exploitable (les 2 fonctions
-- commencent par `if auth.uid() is null then raise exception`, donc un appel
-- anon échoue déjà fonctionnellement) — mais le grant au niveau permission
-- reste plus large que nécessaire (défense en profondeur manquante).
--
-- Portée de cette migration : GRANT/REVOKE uniquement. AUCUNE modification de
-- la définition des 2 fonctions (CREATE OR REPLACE absent), AUCUNE RLS,
-- AUCUN trigger, AUCUNE policy touchée. Ne touche PAS aux migrations 111/114
-- déjà appliquées (fichiers non modifiés). N'affecte AUCUN autre rôle
-- (authenticated et service_role conservent leurs droits existants — REVOKE
-- FROM PUBLIC n'affecte pas les grants explicites déjà accordés séparément
-- à authenticated dans 111/114).
--
-- Application : supabase db query -f <file> --linked
--   puis supabase migration repair --status applied 115. JAMAIS db push.
-- Rollback : supabase/rollbacks/115_harden_recherche_rpc_permissions_rollback.sql
-- ============================================================================

begin;

do $$
begin
  if to_regprocedure('public.accept_transport_recherche_response(uuid, uuid[])') is null then
    raise exception '115 requiert 111 : fonction accept_transport_recherche_response absente.';
  end if;
  if to_regprocedure('public.accept_box_recherche_response(uuid, uuid[])') is null then
    raise exception '115 requiert 114 : fonction accept_box_recherche_response absente.';
  end if;
end $$;

revoke execute on function public.accept_transport_recherche_response(uuid, uuid[]) from public;
revoke execute on function public.accept_transport_recherche_response(uuid, uuid[]) from anon;

revoke execute on function public.accept_box_recherche_response(uuid, uuid[]) from public;
revoke execute on function public.accept_box_recherche_response(uuid, uuid[]) from anon;

-- Ré-affirmation explicite (idempotent, sans effet si déjà présent) : la seule
-- garantie qui compte pour l'usage réel de l'application. service_role a déjà
-- un grant EXPLICITE indépendant en prod (défaut Supabase, cf. proacl audité
-- avant application : `service_role=X/postgres`, jamais dérivé de PUBLIC) —
-- ré-affirmé ici quand même pour rendre l'intention durable et indépendante
-- de ce détail d'implémentation Supabase.
grant execute on function public.accept_transport_recherche_response(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.accept_box_recherche_response(uuid, uuid[]) to authenticated, service_role;

commit;
