-- ============================================================================
-- ROLLBACK 108 — retire les photos des posts communauté + le bucket dédié.
--
-- NB : la suppression de la colonne `image_urls` PERD la liste des photos des
--      posts (le texte et le reste du post sont intacts). Les fichiers déjà
--      présents dans le bucket `community-photos` deviennent orphelins ; la
--      suppression du bucket ci-dessous échoue s'il contient encore des objets
--      (contrainte Storage). Vider le bucket d'abord si besoin :
--        delete from storage.objects where bucket_id = 'community-photos';
-- ============================================================================

begin;

-- 5. Policies storage
drop policy if exists "community_photos_select_all" on storage.objects;
drop policy if exists "community_photos_insert_own" on storage.objects;
drop policy if exists "community_photos_update_own" on storage.objects;
drop policy if exists "community_photos_delete_own" on storage.objects;

-- 4. Bucket (échoue si non vide — voir en-tête)
delete from storage.buckets where id = 'community-photos';

-- 2. Contraintes
alter table public.posts_community    drop constraint if exists posts_community_image_urls_ck;
alter table public.posts_coach        drop constraint if exists posts_coach_image_urls_ck;
alter table public.posts_organisateur drop constraint if exists posts_organisateur_image_urls_ck;

-- 1. Colonnes (les grants colonne disparaissent avec la colonne)
alter table public.posts_community    drop column if exists image_urls;
alter table public.posts_coach        drop column if exists image_urls;
alter table public.posts_organisateur drop column if exists image_urls;

commit;
