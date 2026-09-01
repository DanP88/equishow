// ─────────────────────────────────────────────────────────────────────────────
// Snapshot du « prochain concours » de l'accueil — lecture SYNCHRONE au 1er
// rendu pour éliminer le flash d'un frame (carte « on s'occupe de tout » qui
// apparaît puis bascule sur la carte concours).
//
// Pourquoi : sur le web, chaque refresh = cold start. Au 1er rendu de l'accueil,
// aucune donnée utilisateur n'est disponible de façon synchrone (chevaux =
// réseau, profil = handshake auth). Sans dernier état connu, l'accueil doit
// afficher un état par défaut puis se corriger → flash.
//
//  - Web   : window.localStorage, lecture ET écriture synchrones.
//  - Natif : cache module hydraté une fois via AsyncStorage (best-effort) au
//            chargement du module + écriture AsyncStorage.
//
// Clé unique (dernier utilisateur gagne — appareil mono-compte en pratique).
// On mémorise l'userId : si le compte courant diffère, le snapshot est ignoré.
// ─────────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChevalConcours } from '../hooks/useChevalReservations';

const KEY = 'equishow_hero_snapshot_v1';

interface HeroSnapshot {
  userId: string;
  items: ChevalConcours[];
  at: number;
}

const isWeb = Platform.OS === 'web';
const hasLocalStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

let _mem: HeroSnapshot | null = null;

// Hydratation module (natif) : best-effort, ne bloque rien.
if (!isWeb) {
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw && !_mem) {
        try { _mem = JSON.parse(raw) as HeroSnapshot; } catch { /* ignore */ }
      }
    })
    .catch(() => { /* stockage indisponible */ });
}

/**
 * Dernier récap concours connu pour `userId`, ou `null`.
 * `userId` vide/inconnu → on renvoie le snapshot quand même (cold start : le
 * profil n'est pas encore résolu, mais l'appareil est mono-compte).
 */
export function getHeroSnapshot(userId: string | null | undefined): ChevalConcours[] | null {
  let snap = _mem;
  if (!snap && isWeb && hasLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) { snap = JSON.parse(raw) as HeroSnapshot; _mem = snap; }
    } catch { /* ignore */ }
  }
  if (!snap || !Array.isArray(snap.items)) return null;
  if (userId && snap.userId && snap.userId !== userId) return null;
  return snap.items;
}

/** Mémorise le récap concours résolu (aucun effet si `userId` absent). */
export function setHeroSnapshot(userId: string | null | undefined, items: ChevalConcours[]): void {
  if (!userId) return;
  const snap: HeroSnapshot = { userId, items, at: Date.now() };
  _mem = snap;
  const raw = JSON.stringify(snap);
  if (isWeb) {
    if (hasLocalStorage()) {
      try { window.localStorage.setItem(KEY, raw); } catch { /* quota / privé */ }
    }
    return;
  }
  AsyncStorage.setItem(KEY, raw).catch(() => { /* ignore */ });
}
