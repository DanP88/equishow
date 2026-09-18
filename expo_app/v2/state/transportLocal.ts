// ─────────────────────────────────────────────────────────────────────────────
// v2/state/transportLocal — TRANSPORT V2, actions LOCALES (F5, front-only).
//
// Toutes les actions Transport nouvelles de la V2 vivent ici (AsyncStorage
// `v2:transport`). AUCUNE écriture dans les annonces / réservations Transport
// PROD. Les annonces réelles sont lues ailleurs (v2/adapters/transport, read-only).
//
//   bookings  : réservations SIMULÉES, uniquement pour le parcours démo
//               (visiteur non connecté, v2/adapters/transport.ts) — aucun
//               Stripe, aucun paiement.
//
// « offers » (propositions Transport simulées) retiré (audit de nettoyage
// 2026-09-18, Lot A) : 0 consommateur depuis que « Je propose » écrit
// réellement dans transport_annonces (Phase 2 pilote).
// « searches » (recherches Transport simulées) retiré (audit de nettoyage
// 2026-09-18, Lot D) : 0 écriture depuis le Lot 1 (les vraies recherches
// sont réelles, transport_recherches, v2/adapters/transportRecherches.ts) ;
// les 2 derniers points de lecture (MesTransportsV2 « Mes recherches » et
// concoursDemands.ts `ownT`) retirés aux Lots B/C.
//
// Singleton + useSyncExternalStore (pattern useAuth / v2/capabilities).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from '../lib/persist';

const KEY = 'transport';

export interface TransportBooking {
  id: string;
  src: 'real' | 'demo' | 'local';
  refId: string;
  concoursId?: string;
  concoursNom?: string;
  chevalId?: string;
  /** F16 — tous les chevaux couverts par cette demande (suivi « en attente » par cheval). */
  chevalIds?: string[];
  trajet: string;           // « Nantes → La Baule »
  date?: string;
  heure?: string;
  prix: number;
  conducteur: string;
  places: number;
  /** 'pending' = demande envoyée, vendeur pas encore validé ; 'confirmed' = validée. */
  status?: 'pending' | 'confirmed';
  createdAt: string;
}

interface Store {
  bookings: TransportBooking[];
  hydrated: boolean;
}
let state: Store = { bookings: [], hydrated: false };

const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const getSnapshot = () => state;

function persist() {
  void saveJSON(KEY, { bookings: state.bookings });
}
function set(patch: Partial<Store>) { state = { ...state, ...patch }; emit(); persist(); }

let initialized = false;
function initOnce() {
  if (initialized) return;
  initialized = true;
  void (async () => {
    const d = await loadJSON<Partial<Store>>(KEY, {});
    state = {
      bookings: d.bookings ?? [], hydrated: true,
    };
    emit();
  })();
}
initOnce();

const uid = (p: string) => `${p}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// ── Actions (FRONT-ONLY) ────────────────────────────────────────────────────
export function book(b: Omit<TransportBooking, 'id' | 'createdAt'>): TransportBooking {
  const rec: TransportBooking = { ...b, id: uid('v2b-'), createdAt: new Date().toISOString() };
  set({ bookings: [rec, ...state.bookings] });
  return rec;
}
export function updateBooking(id: string, patch: Partial<TransportBooking>) {
  set({ bookings: state.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
}
export function cancelBooking(id: string) {
  set({ bookings: state.bookings.filter((b) => b.id !== id) });
}

/** Efface toutes les données transport locales (debug). */
export function clearTransportLocal() {
  set({ bookings: [] });
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useTransportLocal(concoursId?: string) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const forConcours = useCallback((id?: string) => ({
    booking: id ? s.bookings.find((x) => x.concoursId === id) : undefined,
  }), [s]);

  return {
    ready: s.hydrated,
    bookings: s.bookings,
    context: forConcours(concoursId),
    forConcours,
    book, updateBooking, cancelBooking,
  };
}
