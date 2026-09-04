-- ============================================================================
-- 108 — Photos dans les posts communauté (3 fils) + bucket Storage dédié
-- ============================================================================
-- CONTEXTE
--   Les 3 fils communautaires (posts_community / posts_coach /
--   posts_organisateur) ne permettaient que du texte (`contenu`). On ajoute la
--   possibilité de joindre 0 à 10 photos par publication.
--
-- CE QUE FAIT LA MIGRATION
--   1. Colonne `image_urls text[] NOT NULL DEFAULT '{}'` sur les 3 tables.
--      → contient les CHEMINS Storage (pas les URLs publiques), dans l'ordre
--        d'affichage. Ex: '<user_id>/<group_uuid>/<image_uuid>.jpg'.
--      → tous les posts existants reçoivent '{}' : rétro-compat totale.
--   2. CHECK par table : au plus 10 éléments, aucun élément NULL
--      (garde-fou serveur ; le client bloque déjà à 10 et n'insère que des
--       chemins d'uploads réussis → pas de post « incomplet » silencieux).
--   3. Grants colonne explicites (les 3 tables ont des grants PAR COLONNE,
--      un ADD COLUMN n'est donc PAS couvert automatiquement).
--   4. Bucket Storage public `community-photos` (5 Mo, jpeg/png/webp) +
--      4 policies calquées sur `chevaux-photos` : lecture publique ;
--      insert/update/delete uniquement dans son propre dossier
--      (split_part(name,'/',1) = auth.uid()).
--
-- IMPACT PROD
--   RLS posts : INCHANGÉE — `image_urls` est un champ d'une ligne déjà
--     gouvernée par posts_*_insert_self / _update_self / _select_* / _delete_self
--     (with_check `auteur_id = auth.uid()`).
--   Realtime : ajout de colonne, aucun changement de replica identity requis
--     (le hook refetch sur événement, ne lit pas le payload).
--   Aucun impact payments / escrow / reservations / triggers.
--   Réversible : voir 108_community_post_images_rollback.sql.
--
-- Application : supabase db query -f supabase/migrations/108_community_post_images.sql --linked
--               puis  supabase migration repair --status applied 108
--               puis  vérifier le bucket + les policies (cf. bloc de contrôle en pied).
--               JAMAIS db push.
-- ============================================================================

begin;

-- ── 1. Colonne image_urls (3 fils) ──────────────────────────────────────────
alter table public.posts_community
  add column if not exists image_urls text[] not null default '{}';
alter table public.posts_coach
  add column if not exists image_urls text[] not null default '{}';
alter table public.posts_organisateur
  add column if not exists image_urls text[] not null default '{}';

comment on column public.posts_community.image_urls is
  '108 — chemins Storage (bucket community-photos) des photos du post, dans l''ordre d''affichage. 0 à 10. Rétro-compat : ''{}'' pour les posts sans photo.';
comment on column public.posts_coach.image_urls is
  '108 — idem posts_community, fil coach.';
comment on column public.posts_organisateur.image_urls is
  '108 — idem posts_community, fil organisateur.';

-- ── 2. Garde-fou serveur : 0..10 éléments, aucun NULL ───────────────────────
-- array_remove(arr, null) retire les NULL (sémantique IS NOT DISTINCT FROM) ;
-- si le cardinal est inchangé, il n'y avait pas de NULL.
-- (drop-then-add → migration ré-exécutable sans erreur, comme les policies plus bas)
alter table public.posts_community    drop constraint if exists posts_community_image_urls_ck;
alter table public.posts_coach        drop constraint if exists posts_coach_image_urls_ck;
alter table public.posts_organisateur drop constraint if exists posts_organisateur_image_urls_ck;

alter table public.posts_community
  add constraint posts_community_image_urls_ck check (
    cardinality(image_urls) <= 10
    and cardinality(image_urls) = cardinality(array_remove(image_urls, null))
  );
alter table public.posts_coach
  add constraint posts_coach_image_urls_ck check (
    cardinality(image_urls) <= 10
    and cardinality(image_urls) = cardinality(array_remove(image_urls, null))
  );
alter table public.posts_organisateur
  add constraint posts_organisateur_image_urls_ck check (
    cardinality(image_urls) <= 10
    and cardinality(image_urls) = cardinality(array_remove(image_urls, null))
  );

-- ── 3. Grants colonne (les 3 tables ont des grants PAR COLONNE) ─────────────
grant select (image_urls) on public.posts_community    to anon, authenticated;
grant select (image_urls) on public.posts_coach        to anon, authenticated;
grant select (image_urls) on public.posts_organisateur to anon, authenticated;

grant insert (image_urls) on public.posts_community    to authenticated;
grant insert (image_urls) on public.posts_coach        to authenticated;
grant insert (image_urls) on public.posts_organisateur to authenticated;

grant update (image_urls) on public.posts_community    to authenticated;
grant update (image_urls) on public.posts_coach        to authenticated;
grant update (image_urls) on public.posts_organisateur to authenticated;

-- ── 4. Bucket Storage `community-photos` ────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-photos',
  'community-photos',
  true,                                            -- lecture publique (CDN, feed)
  5 * 1024 * 1024,                                  -- 5 Mo max par fichier
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 5. Policies storage.objects (calquées sur chevaux_photos_*) ─────────────
-- Path : `<user_id>/<group_uuid>/<image_uuid>.<ext>` → 1er segment = auth.uid().

drop policy if exists "community_photos_select_all" on storage.objects;
create policy "community_photos_select_all"
  on storage.objects for select
  using (bucket_id = 'community-photos');

drop policy if exists "community_photos_insert_own" on storage.objects;
create policy "community_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "community_photos_update_own" on storage.objects;
create policy "community_photos_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'community-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "community_photos_delete_own" on storage.objects;
create policy "community_photos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

commit;

-- ── Contrôle post-application (à lancer manuellement, hors transaction) ──────
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema='public' and column_name='image_urls'
--    and table_name in ('posts_community','posts_coach','posts_organisateur');
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conname like 'posts_%_image_urls_ck';
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id='community-photos';
-- select policyname, cmd from pg_policies
--  where schemaname='storage' and policyname like 'community_photos_%';
