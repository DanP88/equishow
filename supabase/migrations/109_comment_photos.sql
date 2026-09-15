-- ============================================================================
-- 109 — Photos dans les commentaires communauté (3 fils)
-- ============================================================================
-- CONTEXTE
--   Suite à 108 (photos sur les POSTS), les commentaires (com_posts_community /
--   com_posts_coach / com_posts_organisateur) ne supportent que du texte.
--   Demande V2 : pouvoir joindre 0 à 5 photos à un commentaire.
--
-- CE QUE FAIT LA MIGRATION
--   1. Colonne `image_urls text[] NOT NULL DEFAULT '{}'` sur les 3 tables de
--      commentaires. Même sémantique que 108 : CHEMINS Storage (bucket
--      `community-photos`, déjà créé par 108 — AUCUN nouveau bucket/policy
--      storage requis ici, le chemin `<user_id>/<group_uuid>/<image_uuid>.ext`
--      est déjà couvert par les policies community_photos_* de 108).
--      Tous les commentaires existants reçoivent '{}' : rétro-compat totale.
--   2. CHECK par table : au plus 5 éléments (≠ 10 pour les posts — demande
--      explicite « 5 max » sur les commentaires), aucun élément NULL.
--   3. Grants colonne explicites (mêmes tables à grants PAR COLONNE que 108).
--
-- IMPACT PROD
--   RLS commentaires : INCHANGÉE — `image_urls` est un champ d'une ligne déjà
--     gouvernée par les policies existantes com_posts_*_insert_self /
--     _select_* / _delete_self (with_check auteur_id = auth.uid()).
--   Storage : 0 changement (bucket + policies déjà posés par 108).
--   Realtime : ajout de colonne, aucun changement de replica identity requis.
--   Aucun impact payments / escrow / reservations / triggers.
--   Réversible : voir 109_comment_photos_rollback.sql.
--
-- Application : supabase db query -f supabase/migrations/109_comment_photos.sql --linked
--               puis  supabase migration repair --status applied 109
-- ============================================================================

begin;

-- ── 1. Colonne image_urls (3 fils de commentaires) ──────────────────────────
alter table public.com_posts_community
  add column if not exists image_urls text[] not null default '{}';
alter table public.com_posts_coach
  add column if not exists image_urls text[] not null default '{}';
alter table public.com_posts_organisateur
  add column if not exists image_urls text[] not null default '{}';

comment on column public.com_posts_community.image_urls is
  '109 — chemins Storage (bucket community-photos, cf. 108) des photos du commentaire, dans l''ordre d''affichage. 0 à 5. Rétro-compat : ''{}'' pour les commentaires sans photo.';
comment on column public.com_posts_coach.image_urls is
  '109 — idem com_posts_community, fil coach.';
comment on column public.com_posts_organisateur.image_urls is
  '109 — idem com_posts_community, fil organisateur.';

-- ── 2. Garde-fou serveur : 0..5 éléments, aucun NULL ─────────────────────────
alter table public.com_posts_community    drop constraint if exists com_posts_community_image_urls_ck;
alter table public.com_posts_coach        drop constraint if exists com_posts_coach_image_urls_ck;
alter table public.com_posts_organisateur drop constraint if exists com_posts_organisateur_image_urls_ck;

alter table public.com_posts_community
  add constraint com_posts_community_image_urls_ck check (
    cardinality(image_urls) <= 5
    and cardinality(image_urls) = cardinality(array_remove(image_urls, null))
  );
alter table public.com_posts_coach
  add constraint com_posts_coach_image_urls_ck check (
    cardinality(image_urls) <= 5
    and cardinality(image_urls) = cardinality(array_remove(image_urls, null))
  );
alter table public.com_posts_organisateur
  add constraint com_posts_organisateur_image_urls_ck check (
    cardinality(image_urls) <= 5
    and cardinality(image_urls) = cardinality(array_remove(image_urls, null))
  );

-- ── 3. Grants colonne (mêmes tables à grants PAR COLONNE que 108) ───────────
grant select (image_urls) on public.com_posts_community    to anon, authenticated;
grant select (image_urls) on public.com_posts_coach        to anon, authenticated;
grant select (image_urls) on public.com_posts_organisateur to anon, authenticated;

grant insert (image_urls) on public.com_posts_community    to authenticated;
grant insert (image_urls) on public.com_posts_coach        to authenticated;
grant insert (image_urls) on public.com_posts_organisateur to authenticated;

commit;

-- ── Contrôle post-application (à lancer manuellement, hors transaction) ──────
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema='public' and column_name='image_urls'
--    and table_name in ('com_posts_community','com_posts_coach','com_posts_organisateur');
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conname like 'com_posts_%_image_urls_ck';
