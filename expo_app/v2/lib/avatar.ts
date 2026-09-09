// ─────────────────────────────────────────────────────────────────────────────
// v2/lib/avatar — changement de photo de profil utilisateur.
//
// Réutilise l'infra V1 : pickImageFromLibrary + uploadUserAvatar (bucket
// `chevaux-photos`, path `<uid>/avatar.<ext>`) puis UPDATE users.avatar_url.
// Écriture Supabase RÉELLE, uniquement session réelle. Backend ownership : SHARED.
// ─────────────────────────────────────────────────────────────────────────────
import { pickImageFromLibrary, uploadUserAvatar } from '../../lib/photoUpload';
import { updateUserProfile } from '../../lib/supabase';

export async function changeMyAvatar(
  userId: string,
): Promise<{ url: string | null; error: string | null; canceled?: boolean }> {
  const picked = await pickImageFromLibrary();
  if ('canceled' in picked) return { url: null, error: null, canceled: true };
  if ('error' in picked) return { url: null, error: picked.error };

  const up = await uploadUserAvatar({ userId, pick: picked.result });
  if (up.error || !up.url) return { url: null, error: up.error ?? 'Upload échoué.' };

  // On stocke l'URL publique (avec cache-buster) dans users.avatar_url.
  const { error } = await updateUserProfile(userId, { avatar_url: up.url } as any);
  if (error) return { url: null, error: (error as any)?.message ?? 'Enregistrement échoué.' };

  return { url: up.url, error: null };
}
