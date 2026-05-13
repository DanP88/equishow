// Helper d'upload de photo cheval vers Supabase Storage.
// Path convention : `<auteur_id>/<cheval_id>.<ext>` (policy storage RLS).

import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

const BUCKET = 'chevaux-photos';

export interface PickResult {
  uri: string;
  mimeType: string;
  ext: 'jpg' | 'png' | 'webp';
}

/**
 * Demande accès à la galerie et retourne l'image choisie (ou null si annulé).
 * Si la permission est refusée, on retourne `{ error }`.
 */
export async function pickImageFromLibrary(): Promise<
  { result: PickResult } | { error: string } | { canceled: true }
> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return { error: 'Accès à la galerie refusé.' };
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    base64: false,
  });
  if (picked.canceled || !picked.assets?.[0]) {
    return { canceled: true };
  }
  const asset = picked.assets[0];
  const mimeType = (asset.mimeType ?? 'image/jpeg').toLowerCase();
  const ext: PickResult['ext'] =
    mimeType.includes('png') ? 'png' :
    mimeType.includes('webp') ? 'webp' : 'jpg';
  return {
    result: {
      uri: asset.uri,
      mimeType,
      ext,
    },
  };
}

/**
 * Upload une image dans le bucket chevaux-photos et retourne l'URL publique.
 * Le path est `<auteurId>/<chevalId>.<ext>` — `upsert: true` permet de
 * remplacer la photo existante. Le contenu est lu via fetch+blob (compat web+RN).
 */
export async function uploadChevalPhoto(params: {
  auteurId: string;
  chevalId: string;
  pick: PickResult;
}): Promise<{ url: string | null; error: string | null }> {
  const { auteurId, chevalId, pick } = params;
  try {
    const path = `${auteurId}/${chevalId}.${pick.ext}`;

    // fetch local URI → blob (works on web et React Native).
    const fileResp = await fetch(pick.uri);
    const blob = await fileResp.blob();

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: pick.mimeType,
        upsert: true,
        cacheControl: '3600',
      });

    if (upErr) {
      return { url: null, error: upErr.message };
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    // Cache-buster pour forcer le refresh côté UI après remplacement.
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    return { url, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload échoué.';
    return { url: null, error: msg };
  }
}

/**
 * Supprime la photo cheval du bucket. Tolérant si le fichier n'existe pas.
 */
export async function deleteChevalPhoto(params: {
  auteurId: string;
  chevalId: string;
  ext: 'jpg' | 'png' | 'webp';
}): Promise<{ error: string | null }> {
  const { auteurId, chevalId, ext } = params;
  const path = `${auteurId}/${chevalId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  return { error: error?.message ?? null };
}
