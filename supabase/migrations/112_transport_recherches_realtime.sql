-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 112 — Lot 0 : activer realtime pour les 4 tables "recherches
-- ouvertes" Transport (111)
--
-- Symptôme : les tables créées par la migration 111
-- (transport_recherches, transport_recherche_chevaux,
-- transport_recherche_reponses, transport_reservation_chevaux) ne sont pas
-- dans la publication `supabase_realtime`. Sans ça, le front (hooks
-- `.on('postgres_changes', ...)`) ne reçoit jamais d'event quand un autre
-- compte publie une recherche ou y répond : B ne voit pas la recherche de A
-- tant qu'il ne recharge pas manuellement.
--
-- Même piège déjà rencontré et corrigé 4 fois dans ce projet : mig 028
-- (notifications), 034 (chevaux), 035 (users/coach_profiles), 037
-- (marketplace : stages/box/transport/coach/avis). Ce fichier applique
-- exactement le même correctif, au même format, aux 4 tables de la
-- migration 111.
--
-- REPLICA IDENTITY FULL — pourquoi c'est nécessaire ici (pas juste copié) :
--   Par défaut Postgres n'embarque que les colonnes de la clé primaire dans
--   l'ancien enregistrement ("old record") d'un UPDATE/DELETE répliqué. Or
--   Supabase Realtime évalue les filtres d'abonnement (ex: un hook qui
--   s'abonne avec `filter: recherche_id=eq.<uuid>` sur
--   transport_recherche_chevaux/transport_recherche_reponses, ou
--   `concours_id=eq.<uuid>` sur transport_recherches) CONTRE cet ancien
--   enregistrement pour les DELETE. Avec l'identité par défaut, un DELETE sur
--   une ligne dont la colonne filtrée n'est pas la clé primaire ne matchera
--   JAMAIS le filtre → l'event est silencieusement perdu côté client, même
--   si la table est bien dans la publication. C'est précisément le bug
--   récurrent que 028/034/035/037 ont déjà corrigé ; on applique la même
--   règle par cohérence et pour ne pas le réintroduire une 5e fois.
--   (transport_reservation_chevaux et transport_recherche_chevaux ont une PK
--   composite qui couvre déjà leurs colonnes utiles y compris pour les
--   filtres actuellement prévus — FULL appliqué quand même pour rester sur
--   un seul pattern uniforme et robuste à un futur filtre non-PK, comme fait
--   systématiquement dans ce projet.)
--
-- Périmètre : AUCUNE table Box/Coach touchée — elles n'existent pas encore
--   (schéma "recherches ouvertes" Box/Coach reporté à une migration
--   ultérieure, qui prendra le prochain numéro disponible à ce moment-là).
--   Aucune table V1 modifiée. Aucun impact RLS (la publication logique et
--   REPLICA IDENTITY ne changent ni les policies ni les grants). Aucun
--   impact sur payments/escrow/Stripe.
--
-- Rollback : supabase/rollbacks/112_transport_recherches_realtime_rollback.sql
-- Application prod : supabase db query -f <file> --linked
--   puis supabase migration repair --status applied 112. JAMAIS db push.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
  tables text[] := array[
    'transport_recherches',
    'transport_recherche_chevaux',
    'transport_recherche_reponses',
    'transport_reservation_chevaux'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception '112 requiert la publication supabase_realtime (absente).';
  end if;

  foreach t in array tables loop
    -- Garde-fou idempotent : ne traite que les tables réellement présentes
    -- (permet de rejouer ce fichier sans erreur si déjà appliqué).
    if exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = t
    ) then
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
      execute format('alter table public.%I replica identity full', t);
    else
      raise exception '112 requiert 111 : table public.% absente.', t;
    end if;
  end loop;
end $$;
