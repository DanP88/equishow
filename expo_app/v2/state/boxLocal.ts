// ─────────────────────────────────────────────────────────────────────────────
// v2/state/boxLocal — BOX V2, actions LOCALES (F6, front-only).
//
// Toutes les actions Box nouvelles de la V2 vivent ici (AsyncStorage `v2:box`).
// AUCUNE écriture dans les annonces / réservations Box PROD. Les annonces
// réelles sont lues ailleurs (v2/adapters/box, read-only).
//
//   searches : « recherches » de box publiées (future logique de demande Box)
//   offers   : « propositions » de box publiées (future annonce Box)
//   bookings : réservations SIMULÉES (aucun Stripe, aucun paiement)
//
// Singleton + useSyncExternalStore (pattern useAuth / v2/capabilities).
// Miroir strict de v2/state/transportLocal (F5).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from '../lib/persist';

const KEY = 'box';

export interface BoxSearch {
  id: string;
  concoursId?: string;
  concoursNom?: string;
  chevalId?: string;
  lieu: string;             // secteur / proximité souhaitée
  dateDebut?: string;       // 'YYYY-MM-DD'
  dateFin?: string;
  nbBox: number;
  litiereIncluse: boolean;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface BoxOffer {
  id: string;
  concoursId?: string;
  concoursNom?: string;
  lieu: string;
  adresse?: string;
  dateDebut?: string;
  dateFin?: string;
  nbBox: number;
  prixNuit: number;         // € par box et par nuit (simulation)
  litiereIncluse: boolean;
  equipements?: string;
  description?: string;
  createdAt: string;
}

export interface BoxBooking {
  id: string;
  src: 'real' | 'demo' | 'local';
  refId: string;
  concoursId?: string;
  concoursNom?: string;
  chevalId?: string;
  /** F16 — tous les chevaux couverts par cette demande. */
  chevalIds?: string[];
  lieu: string;             // « Écurie du Golfe · La Baule »
  dateDebut?: string;
  dateFin?: string;
  nbNuits: number;
  nbBox: number;
  prixNuit: number;
  prix: number;             // total payé (simulation, commission incluse)
  hote: string;
  /** 'pending' = demande envoyée, vendeur pas encore validé ; 'confirmed' = validée. */
  status?: 'pending' | 'confirmed';
  createdAt: string;
}

interface Store {
  searches: BoxSearch[];
  offers: BoxOffer[];
  bookings: BoxBooking[];
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
export function publishSearch(s: Omit<BoxSearch, 'id' | 'status' | 'createdAt'>): BoxSearch {
  const rec: BoxSearch = { ...s, id: uid('v2bs-'), status: 'open', createdAt: new Date().toISOString() };
  set({ searches: [rec, ...state.searches] });
  return rec;
}
export function updateSearch(id: string, patch: Partial<BoxSearch>) {
  set({ searches: state.searches.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
}
export function removeSearch(id: string) {
  set({ searches: state.searches.filter((s) => s.id !== id) });
}

export function publishOffer(o: Omit<BoxOffer, 'id' | 'createdAt'>): BoxOffer {
  const rec: BoxOffer = { ...o, id: uid('v2bo-'), createdAt: new Date().toISOString() };
  set({ offers: [rec, ...state.offers] });
  return rec;
}
export function updateOffer(id: string, patch: Partial<BoxOffer>) {
  set({ offers: state.offers.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
}
export function removeOffer(id: string) {
  set({ offers: state.offers.filter((o) => o.id !== id) });
}

export function book(b: Omit<BoxBooking, 'id' | 'createdAt'>): BoxBooking {
  const rec: BoxBooking = { ...b, id: uid('v2bb-'), createdAt: new Date().toISOString() };
  set({ bookings: [rec, ...state.bookings] });
  return rec;
}
export function updateBooking(id: string, patch: Partial<BoxBooking>) {
  set({ bookings: state.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
}
export function cancelBooking(id: string) {
  set({ bookings: state.bookings.filter((b) => b.id !== id) });
}

/** Efface toutes les données box locales (debug). */
export function clearBoxLocal() {
  set({ searches: [], offers: [], bookings: [] });
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useBoxLocal(concoursId?: string) {
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
    book, updateBooking, cancelBooking,
  };
}
