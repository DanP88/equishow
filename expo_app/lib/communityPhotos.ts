// ─────────────────────────────────────────────────────────────────────────────
// Photos des posts communauté (3 fils) — sélection multiple, compression légère,
// upload sécurisé vers le bucket `community-photos` et nettoyage anti-orphelins.
//
// Path Storage : `<user_id>/<group_uuid>/<image_uuid>.<ext>`
//   → 1er segment = user_id → policies `community_photos_*_own`
//     (split_part(name,'/',1) = auth.uid()).
//
// Migration 108 : bucket public 5 Mo (jpeg/png/webp) + colonne
//   posts_*.image_urls text[] (CHECK <= 10, aucun NULL). On stocke les CHEMINS,
//   pas les URLs publiques (dérivées à l'affichage via publicUrl()).
// ─────────────────────────────────────────────────────────────────────────────

import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export const COMMUNITY_BUCKET = 'community-photos';
export const MAX_POST_PHOTOS = 10;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // aligné sur file_size_limit du bucket

export interface PickedPhoto {
  uri: string;
  mimeType: string;
  ext: 'jpg' | 'png' | 'webp';
  bytes?: number;
}

// UUID : crypto.randomUUID sur web moderne + Hermes récent, fallback sinon.
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function extFromMime(mime: string): PickedPhoto['ext'] {
  const m = mime.toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  return 'jpg';
}

/**
 * Ouvre la galerie en sélection multiple (max `remaining`, plafonné à 10 au total).
 * `quality: 0.6` ré-encode les JPEG à la prise → évite d'envoyer des fichiers
 * proches de 5 Mo sans dépendance supplémentaire. Sur web, compression via canvas
 * (cf. compressForWeb) car `quality` y est ignoré.
 */
export async function pickPostPhotos(
  remaining: number,
): Promise<{ photos: PickedPhoto[] } | { error: string } | { canceled: true }> {
  const limit = Math.max(0, Math.min(remaining, MAX_POST_PHOTOS));
  if (limit === 0) return { photos: [] };

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { error: "Accès à la galerie refusé." };

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit, // iOS 14+ ; ignoré ailleurs → on retronque plus bas
    quality: 0.6,
    base64: false,
  });
  if (picked.canceled || !picked.assets?.length) return { canceled: true };

  const assets = picked.assets.slice(0, limit);
  const photos: PickedPhoto[] = [];
  for (const a of assets) {
    let mimeType = (a.mimeType ?? 'image/jpeg').toLowerCase();
    let uri = a.uri;
    let bytes = a.fileSize;
    if (Platform.OS === 'web') {
      const c = await compressForWeb(a.uri, mimeType);
      uri = c.uri;
      bytes = c.bytes;
      mimeType = c.mime;
    }
    photos.push({ uri, mimeType, ext: extFromMime(mimeType), bytes });
  }
  return { photos };
}

/**
 * Web uniquement : redimensionne (max 1600 px) + ré-encode JPEG 0.7 si le fichier
 * dépasse 1,5 Mo. Aucune dépendance (canvas natif du navigateur).
 */
async function compressForWeb(
  uri: string,
  mime: string,
): Promise<{ uri: string; bytes: number; mime: string }> {
  try {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    if (blob.size <= 1.5 * 1024 * 1024) return { uri, bytes: blob.size, mime };
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { uri, bytes: blob.size, mime };
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    const bytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);
    return { uri: dataUrl, bytes, mime: 'image/jpeg' };
  } catch {
    return { uri, bytes: 0, mime };
  }
}

/**
 * Upload de N photos pour un post. Génère un `groupId`, uploade toutes les
 * images sous `<userId>/<groupId>/…`. En cas d'échec d'UNE image : supprime
 * celles déjà uploadées et renvoie une erreur (aucun post ne doit être créé).
 */
export async function uploadPostPhotos(params: {
  userId: string;
  photos: PickedPhoto[];
}): Promise<{ paths: string[]; error: string | null }> {
  const { userId, photos } = params;
  if (!userId) return { paths: [], error: 'Non authentifié' };
  if (photos.length === 0) return { paths: [], error: null };
  if (photos.length > MAX_POST_PHOTOS) return { paths: [], error: `Maximum ${MAX_POST_PHOTOS} photos.` };

  const groupId = uuid();
  const uploaded: string[] = [];

  for (const photo of photos) {
    try {
      const resp = await fetch(photo.uri);
      const blob = await resp.blob();
      if (blob.size > MAX_UPLOAD_BYTES) {
        await cleanup(uploaded);
        return { paths: [], error: 'Une photo dépasse 5 Mo même après compression.' };
      }
      const path = `${userId}/${groupId}/${uuid()}.${photo.ext}`;
      const { error } = await supabase.storage
        .from(COMMUNITY_BUCKET)
        .upload(path, blob, { contentType: photo.mimeType, upsert: false, cacheControl: '3600' });
      if (error) {
        await cleanup(uploaded);
        return { paths: [], error: `Échec de l'envoi d'une photo : ${error.message}` };
      }
      uploaded.push(path);
    } catch (e) {
      await cleanup(uploaded);
      return { paths: [], error: e instanceof Error ? e.message : "Échec de l'envoi d'une photo." };
    }
  }
  return { paths: uploaded, error: null };
}

/** Supprime des fichiers du bucket (best-effort, tolérant). */
export async function cleanupPostPhotos(paths: string[]): Promise<void> {
  await cleanup(paths);
}

async function cleanup(paths: string[]): Promise<void> {
  if (!paths.length) return;
  try {
    await supabase.storage.from(COMMUNITY_BUCKET).remove(paths);
  } catch {
    /* best-effort : un échec de nettoyage ne doit rien bloquer */
  }
}

/** Chemin Storage → URL publique (bucket public). */
export function communityPhotoUrl(path: string): string {
  if (!path) return '';
  if (/^https?:|^data:/.test(path)) return path; // déjà une URL (robustesse)
  return supabase.storage.from(COMMUNITY_BUCKET).getPublicUrl(path).data.publicUrl;
}
