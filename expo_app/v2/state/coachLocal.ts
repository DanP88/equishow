// ─────────────────────────────────────────────────────────────────────────────
// v2/state/coachLocal — COACH V2, actions LOCALES (F7, front-only).
//
// AsyncStorage `v2:coach`. AUCUNE écriture dans coach_annonces / course_demands
// PROD. Les annonces réelles sont lues ailleurs (v2/adapters/coach, read-only).
//
//   searches : « demandes de coaching » publiées (future course_demands)
//   offers   : « annonces de coaching » publiées (future coach_annonces)
//   bookings : séances réservées SIMULÉES (aucun Stripe, aucun paiement)
//
// Singleton + useSyncExternalStore. Miroir strict de transportLocal / boxLocal.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from '../lib/persist';

const KEY = 'coach';

export interface CoachSearch {
  id: string;
  concoursId?: string;
  concoursNom?: string;
  chevalId?: string;
  type: 'concours' | 'regulier';
  discipline: string;
  niveau: string;
  dateSouhaitee?: string;   // 'YYYY-MM-DD' (facultatif, surtout « régulier »)
  nbSeances: number;
  lieu?: string;            // lieu du coaching — pré-rempli depuis le concours si lié
  message?: string;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface CoachOffer {
  id: string;
  concoursId?: string;
  concoursNom?: string;
  type: 'concours' | 'regulier';
  discipline: string;
  niveaux: string[];
  dateDebut?: string;
  dateFin?: string;
  prixSeance: number;       // € par séance (simulation)
  places: number;
  lieu?: string;            // lieu / zone du coaching — pré-rempli depuis le concours si lié
  description?: string;
  createdAt: string;
}

export interface CoachBooking {
  id: string;
  src: 'real' | 'demo' | 'local';
  refId: string;
  concoursId?: string;
  concoursNom?: string;
  chevalId?: string;
  coach: string;
  /** vrai users.id du coach si connu (annonce réelle) — pour « Coachs présents ». */
  coachUserId?: string;
  /** id de l'annonce de coaching (= refId pour src='real') — pour « voir l'annonce ». */
  annonceId?: string;
  /**
   * 'pending'   = demande envoyée, le coach n'a pas encore accepté / pas payé.
   * 'confirmed' = coach a accepté + paiement (séquestre) effectué → « coach prévu ».
   * (Phase 2 : dérivé du statut réel course_demands + payment.)
   */
  status?: 'pending' | 'confirmed';
  discipline: string;
  niveau: string;
  nbSeances: number;
  prixSeance: number;
  prix: number;             // total payé (simulation, commission incluse)
  date?: string;
  createdAt: string;
}

interface Store {
  searches: CoachSearch[];
  offers: CoachOffer[];
  bookings: CoachBooking[];
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
    state = { searches: d.searches ?? [], offers: d.offers ?? [], bookings: d.bookings ?? [], hydrated: true };
    emit();
  })();
}
initOnce();

const uid = (p: string) => `${p}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// ── Actions (FRONT-ONLY) ────────────────────────────────────────────────────
export function publishSearch(s: Omit<CoachSearch, 'id' | 'status' | 'createdAt'>): CoachSearch {
  const rec: CoachSearch = { ...s, id: uid('v2cs-'), status: 'open', createdAt: new Date().toISOString() };
  set({ searches: [rec, ...state.searches] });
  return rec;
}
export function updateSearch(id: string, patch: Partial<CoachSearch>) {
  set({ searches: state.searches.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
}
export function removeSearch(id: string) {
  set({ searches: state.searches.filter((s) => s.id !== id) });
}

export function publishOffer(o: Omit<CoachOffer, 'id' | 'createdAt'>): CoachOffer {
  const rec: CoachOffer = { ...o, id: uid('v2co-'), createdAt: new Date().toISOString() };
  set({ offers: [rec, ...state.offers] });
  return rec;
}
export function updateOffer(id: string, patch: Partial<CoachOffer>) {
  set({ offers: state.offers.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
}
export function removeOffer(id: string) {
  set({ offers: state.offers.filter((o) => o.id !== id) });
}

export function book(b: Omit<CoachBooking, 'id' | 'createdAt'>): CoachBooking {
  const rec: CoachBooking = { ...b, id: uid('v2cb-'), createdAt: new Date().toISOString() };
  set({ bookings: [rec, ...state.bookings] });
  return rec;
}
export function updateBooking(id: string, patch: Partial<CoachBooking>) {
  set({ bookings: state.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
}
export function cancelBooking(id: string) {
  set({ bookings: state.bookings.filter((b) => b.id !== id) });
}

/** Efface toutes les données coach locales (debug). */
export function clearCoachLocal() {
  set({ searches: [], offers: [], bookings: [] });
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useCoachLocal(concoursId?: string) {
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
