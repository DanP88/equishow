-- ─────────────────────────────────────────────────────────────────────────────
-- Equishow — Seed (développement local uniquement)
-- ─────────────────────────────────────────────────────────────────────────────

-- Les rôles sont insérés dans 001_init_schema.sql via ON CONFLICT DO NOTHING.

-- Exemple : profil de test (à décommenter après création du user via Supabase Auth)
-- insert into public.profiles (id, full_name, phone, club_name, ffe_number, role_id)
-- values (
--   'YOUR_TEST_USER_UUID',
--   'Sophie Martin',
--   '06 98 76 54 32',
--   'Ecurie du Lac',
--   'FFE-123456',
--   (select id from public.roles where name = 'cavalier')
-- );
