// ─────────────────────────────────────────────────────────────────────────────
// v2/lib/transportPricing — LOGIQUE TARIF AU KM DU TRANSPORT (reprise V1).
//
// ┌─ V1 (source de vérité, NE PAS réinventer) ─────────────────────────────────┐
// │ Création annonce (app/proposer-transport.tsx) :                            │
// │   • adresse_van / start_lat,start_lng   = point de départ du transporteur  │
// │   • adresse_arrivee / destination_*     = lieu du concours                 │
// │   • price_per_km  (hint UI : « Recommandé : 0,8€/km »)                      │
// │                                                                           │
// │ Réponse du client (app/reserver-transport.tsx) :                           │
// │   • le cavalier saisit son adresse de prise en charge (ou géoloc)          │
// │   • Edge `calculate-route-price` (OpenRouteService, clé serveur, JWT) :    │
// │       distance ROUTIÈRE  départ → prise en charge → concours               │
// │       (+ trajet retour avec ses propres adresses si aller_retour)          │
// │       price_per_km + adresses RECHARGÉS EN DB depuis transportId (anti-    │
// │       fraude — le client ne peut pas injecter un tarif)                    │
// │   • totalPrice = round2( totalDistanceKm × price_per_km )                  │
// │   • à la réservation : × nbPlaces, puis + commission Equishow au checkout  │
// │     (get_commission_rate('trajet')) — AUCUNE TVA.                          │
// └───────────────────────────────────────────────────────────────────────────┘
//
// V2 PHASE 1 (ce fichier) : MÊME FORMULE, distance ESTIMÉE côté front —
//   haversine × facteur routier 1,3, géocodage open-meteo (même provider que la
//   météo concours V2, sans clé). Le prix routier EXACT reste Phase 2 (Edge
//   `calculate-route-price` + annonce réelle en base).
//
// AUCUN Stripe, AUCUN paiement, AUCUNE écriture. Toute valeur est une ESTIMATION
// clairement étiquetée.
// ─────────────────────────────────────────────────────────────────────────────

export const RECOMMENDED_PRICE_PER_KM = 0.8; // V1 : hint « Recommandé : 0,8€/km »
const ROAD_FACTOR = 1.3;                      // détour routier moyen vs distance à vol d'oiseau
const EARTH_KM = 6371;

export interface LatLng {
  lat: number;
  lng: number;
}

const toRad = (d: number) => (d * Math.PI) / 180;

/** Distance à vol d'oiseau (km) entre deux points. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distance ROUTIÈRE estimée (km) le long d'une suite de points
 * (départ → [prise en charge] → concours). Estimation = haversine × 1,3.
 */
export function estimateRouteKm(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]) * ROAD_FACTOR;
  }
  return Math.round(total * 10) / 10;
}

/**
 * Prix transport V1 : `distance_totale_km × price_per_km × nb_places`.
 * (aller-retour = distance déjà doublée en amont, comme l'Edge V1.)
 * Commission Equishow AJOUTÉE au checkout — hors de cette fonction.
 */
export function transportPrice(distanceKm: number, pricePerKm: number, nbPlaces = 1): number {
  const p = distanceKm * Math.max(0, pricePerKm) * Math.max(1, Math.floor(nbPlaces));
  return Math.round(p * 100) / 100;
}

export interface TransportEstimate {
  distanceKm: number;
  pricePerKm: number;
  nbPlaces: number;
  allerRetour: boolean;
  /** Prix estimé HORS commission (= sous-total vendeur). */
  price: number;
  /** Détail des tronçons (pour l'affichage). */
  legs: { from: string; to: string; km: number }[];
  estimated: true;
}

/**
 * Assemble une estimation complète à partir de points déjà géocodés.
 * `pickup` optionnel : absent = estimation « annonce » (départ → concours),
 * présent = estimation « réponse client » (départ → prise en charge → concours).
 */
export function buildEstimate(opts: {
  depart: LatLng & { label: string };
  concours: LatLng & { label: string };
  pickup?: (LatLng & { label: string }) | null;
  pricePerKm: number;
  nbPlaces?: number;
  allerRetour?: boolean;
}): TransportEstimate {
  const chain: (LatLng & { label: string })[] = opts.pickup
    ? [opts.depart, opts.pickup, opts.concours]
    : [opts.depart, opts.concours];

  const legs = chain.slice(1).map((p, i) => ({
    from: chain[i].label,
    to: p.label,
    km: Math.round(haversineKm(chain[i], p) * ROAD_FACTOR * 10) / 10,
  }));

  let distanceKm = legs.reduce((s, l) => s + l.km, 0);
  distanceKm = Math.round(distanceKm * 10) / 10;
  const allerRetour = !!opts.allerRetour;
  const totalKm = Math.round(distanceKm * (allerRetour ? 2 : 1) * 10) / 10;
  const nbPlaces = Math.max(1, Math.floor(opts.nbPlaces ?? 1));

  return {
    distanceKm: totalKm,
    pricePerKm: opts.pricePerKm,
    nbPlaces,
    allerRetour,
    price: transportPrice(totalKm, opts.pricePerKm, nbPlaces),
    legs,
    estimated: true,
  };
}

// ── Géocodage front (Base Adresse Nationale — service public FR, sans clé) ───
// Repli open-meteo (déjà utilisé par la météo concours V2) si BAN indisponible.
const _geoCache = new Map<string, LatLng | null>();

async function geocodeBAN(q: string): Promise<LatLng | null> {
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`);
    if (!res.ok) return null;
    const j = await res.json();
    const c = j?.features?.[0]?.geometry?.coordinates;
    return Array.isArray(c) ? { lat: c[1], lng: c[0] } : null;
  } catch {
    return null;
  }
}

async function geocodeOpenMeteo(q: string): Promise<LatLng | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=fr&format=json`,
    );
    if (!res.ok) return null;
    const j = await res.json();
    const hit = j?.results?.[0];
    return hit ? { lat: hit.latitude as number, lng: hit.longitude as number } : null;
  } catch {
    return null;
  }
}

export async function geocodeFr(query: string): Promise<LatLng | null> {
  const q = query.trim();
  if (!q) return null;
  const key = q.toLowerCase();
  if (_geoCache.has(key)) return _geoCache.get(key) ?? null;
  const out = (await geocodeBAN(q)) ?? (await geocodeOpenMeteo(q));
  _geoCache.set(key, out);
  return out;
}
