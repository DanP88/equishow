// ─────────────────────────────────────────────────────────────────────────────
// v2/state/transportLocal — TRANSPORT V2, actions LOCALES (F5, front-only).
//
// Toutes les actions Transport nouvelles de la V2 vivent ici (AsyncStorage
// `v2:transport`). AUCUNE écriture dans les annonces / réservations Transport
// PROD. Les annonces réelles sont lues ailleurs (v2/adapters/transport, read-only).
//
//   searches  : « recherches » publiées (future logique de demande Transport)
//   offers    : « propositions » publiées (future annonce Transport)
//   bookings  : réservations SIMULÉES (aucun Stripe, aucun paiement)
//
// Singleton + useSyncExternalStore (pattern useAuth / v2/capabilities).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from '../lib/persist';

const KEY = 'transport';

export interface TransportSearch {
  id: string;
  concoursId?: string;
  concoursNom?: string;
  chevalId?: string;
  depart: string;
  destination: string;
  dateAller?: string;      // 'YYYY-MM-DD'
  dateRetour?: string;
  nbChevaux: number;
  avecCavalier: boolean;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface TransportOffer {
  id: string;
  concoursId?: string;
  concoursNom?: string;
  depart: string;
  destination: string;
  date?: string;
  heure?: string;
  places: number;
  prix: number;             // € par place (simulation)
  peutTransporterCavalier: boolean;
  description?: string;
  createdAt: string;
}

export interface TransportBooking {
  id: string;
  src: 'real' | 'demo' | 'local';
  refId: string;
  concoursId?: string;
  concoursNom?: string;
  chevalId?: string;
  trajet: string;           // « Nantes → La Baule »
  date?: string;
  heure?: string;
  prix: number;
  conducteur: string;
  places: number;
  createdAt: string;
}

interface Store {
  searches: TransportSearch[];
  offers: TransportOffer[];
  bookings: TransportBooking[];
  hydrated: boolean;
}
let state: Store = { searches: [], offers: [], bookings: [], hydrated: false };

const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const getSnapshot = () => state;

function persist() {
  void saveJSON(KEY, { searches: state.searches, offers: state.offers, bookings: state.bookings });
}
function set(patch: Partial<Store>) { state = { ...state, ...patch }; emit(); persist(); }

let initialized = false;
function initOnce() {
  if (initialized) return;
  initialized = true;
  void (async () => {
    const d = await loadJSON<Partial<Store>>(KEY, {});
    state = {
      searches: d.searches ?? [], offers: d.offers ?? [], bookings: d.bookings ?? [], hydrated: true,
    };
    emit();
  })();
}
initOnce();

const uid = (p: string) => `${p}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// ── Actions (FRONT-ONLY) ────────────────────────────────────────────────────
export function publishSearch(s: Omit<TransportSearch, 'id' | 'status' | 'createdAt'>): TransportSearch {
  const rec: TransportSearch = { ...s, id: uid('v2s-'), status: 'open', createdAt: new Date().toISOString() };
  set({ searches: [rec, ...state.searches] });
  return rec;
}
export function updateSearch(id: string, patch: Partial<TransportSearch>) {
  set({ searches: state.searches.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
}
export function removeSearch(id: string) {
  set({ searches: state.searches.filter((s) => s.id !== id) });
}

export function publishOffer(o: Omit<TransportOffer, 'id' | 'createdAt'>): TransportOffer {
  const rec: TransportOffer = { ...o, id: uid('v2o-'), createdAt: new Date().toISOString() };
  set({ offers: [rec, ...state.offers] });
  return rec;
}
export function updateOffer(id: string, patch: Partial<TransportOffer>) {
  set({ offers: state.offers.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
}
export function removeOffer(id: string) {
  set({ offers: state.offers.filter((o) => o.id !== id) });
}

export function book(b: Omit<TransportBooking, 'id' | 'createdAt'>): TransportBooking {
  const rec: TransportBooking = { ...b, id: uid('v2b-'), createdAt: new Date().toISOString() };
  set({ bookings: [rec, ...state.bookings] });
  return rec;
}
export function cancelBooking(id: string) {
  set({ bookings: state.bookings.filter((b) => b.id !== id) });
}

/** Efface toutes les données transport locales (debug). */
export function clearTransportLocal() {
  set({ searches: [], offers: [], bookings: [] });
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useTransportLocal(concoursId?: string) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const forConcours = useCallback((id?: string) => ({
    search: id ? s.searches.find((x) => x.concoursId === id && x.status === 'open') : undefined,
    offer: id ? s.offers.find((x) => x.concoursId === id) : undefined,
    booking: id ? s.bookings.find((x) => x.concoursId === id) : undefined,
  }), [s]);

  return {
    ready: s.hydrated,
    searches: s.searches,
    offers: s.offers,
    bookings: s.bookings,
    context: forConcours(concoursId),
    forConcours,
    publishSearch, updateSearch, removeSearch,
    publishOffer, updateOffer, removeOffer,
    book, cancelBooking,
  };
}
