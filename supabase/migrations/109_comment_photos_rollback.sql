-- ============================================================================
-- 109 rollback — retire les photos de commentaires (colonnes + contraintes).
-- Le bucket community-photos et ses policies storage restent en place (posés
-- par 108, encore utilisés par les photos de POSTS) — ne pas les toucher ici.
-- ============================================================================

begin;

-- Contraintes
alter table public.com_posts_community    drop constraint if exists com_posts_community_image_urls_ck;
alter table public.com_posts_coach        drop constraint if exists com_posts_coach_image_urls_ck;
alter table public.com_posts_organisateur drop constraint if exists com_posts_organisateur_image_urls_ck;

-- Colonnes (les grants colonne disparaissent avec la colonne)
alter table public.com_posts_community    drop column if exists image_urls;
alter table public.com_posts_coach        drop column if exists image_urls;
alter table public.com_posts_organisateur drop column if exists image_urls;

commit;
