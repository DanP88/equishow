// ─────────────────────────────────────────────────────────────────────────────
// v2/lib/persist — persistance FRONT-ONLY simulée (PHASE 1).
//
// Fine surcouche typée d'AsyncStorage. TOUTES les clés sont préfixées `v2:` pour
// isoler la V2 du stockage V1 et rendre la simulation triviale à effacer.
//
// ⚠️ Rien de ce qui passe ici n'atteint la PROD / Supabase. C'est du localStorage
//    (web) / AsyncStorage (natif), propre à l'appareil, temporaire.
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'v2:';

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // best-effort : une écriture locale ratée ne doit jamais casser l'UI
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}
