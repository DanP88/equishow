-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 020 — Storage bucket `chevaux-photos` + policies RLS.
--
-- Permet aux cavaliers d'uploader une photo de leur cheval, stockée dans
-- Supabase Storage et exposée via une URL publique.
--
-- Convention path : `<auteur_id>/<cheval_id>.<ext>` — l'auteur_id en premier
-- segment permet d'appliquer une policy "le user ne peut écrire que dans son
-- propre dossier" (split_part(name, '/', 1) = auth.uid()).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Créer le bucket public ──────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chevaux-photos',
  'chevaux-photos',
  true,                                            -- lectures publiques (CDN)
  5 * 1024 * 1024,                                 -- 5 MB max par fichier
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Policies storage.objects ─────────────────────────────────────────────
-- (RLS storage.objects est déjà ENABLE par défaut côté Supabase.)

-- SELECT : public (bucket public déjà = lecture anonyme via CDN).
drop policy if exists "chevaux_photos_select_all" on storage.objects;
create policy "chevaux_photos_select_all"
  on storage.objects for select
  using (bucket_id = 'chevaux-photos');

-- INSERT : authentifié + le 1er segment du path doit être l'auth.uid() du user.
drop policy if exists "chevaux_photos_insert_own" on storage.objects;
create policy "chevaux_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chevaux-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- UPDATE : pareil — pour remplacer sa propre photo.
drop policy if exists "chevaux_photos_update_own" on storage.objects;
create policy "chevaux_photos_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'chevaux-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- DELETE : pareil.
drop policy if exists "chevaux_photos_delete_own" on storage.objects;
create policy "chevaux_photos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chevaux-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );
