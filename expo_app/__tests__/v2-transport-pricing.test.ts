// F15 §2 — logique tarif au km du transport (reprise V1), partie pure.
import {
  RECOMMENDED_PRICE_PER_KM,
  haversineKm,
  estimateRouteKm,
  transportPrice,
  buildEstimate,
} from '../v2/lib/transportPricing';

const NANTES = { lat: 47.2184, lng: -1.5536 };
const LA_BAULE = { lat: 47.2861, lng: -2.3908 };
const RENNES = { lat: 48.1173, lng: -1.6778 };

describe('transportPricing — formule V1', () => {
  test('tarif recommandé = 0,8 €/km (hint V1)', () => {
    expect(RECOMMENDED_PRICE_PER_KM).toBe(0.8);
  });

  test('haversine Nantes → La Baule ≈ 63 km à vol d’oiseau', () => {
    const d = haversineKm(NANTES, LA_BAULE);
    expect(d).toBeGreaterThan(55);
    expect(d).toBeLessThan(70);
  });

  test('estimateRouteKm applique le facteur routier 1,3', () => {
    const straight = haversineKm(NANTES, LA_BAULE);
    const road = estimateRouteKm([NANTES, LA_BAULE]);
    expect(road).toBeCloseTo(Math.round(straight * 1.3 * 10) / 10, 1);
  });

  test('transportPrice = distance × price_per_km × nb_places', () => {
    expect(transportPrice(100, 0.8, 1)).toBe(80);
    expect(transportPrice(100, 0.8, 2)).toBe(160);
    expect(transportPrice(63.4, 0.8, 1)).toBe(50.72);
  });

  test('transportPrice borne nb_places ≥ 1 et price_per_km ≥ 0', () => {
    expect(transportPrice(100, 0.8, 0)).toBe(80);
    expect(transportPrice(100, -5, 1)).toBe(0);
  });

  test('buildEstimate — départ → prise en charge → concours (logique V1)', () => {
    const e = buildEstimate({
      depart: { ...NANTES, label: 'Nantes' },
      pickup: { ...RENNES, label: 'Rennes' },
      concours: { ...LA_BAULE, label: 'La Baule' },
      pricePerKm: 0.8,
      nbPlaces: 1,
      allerRetour: false,
    });
    expect(e.legs).toHaveLength(2);
    expect(e.legs[0].from).toBe('Nantes');
    expect(e.legs[1].to).toBe('La Baule');
    expect(e.distanceKm).toBeCloseTo(e.legs[0].km + e.legs[1].km, 1);
    expect(e.price).toBe(transportPrice(e.distanceKm, 0.8, 1));
    expect(e.estimated).toBe(true);
  });

  test('buildEstimate — aller-retour double la distance (comme l’Edge V1)', () => {
    const base = {
      depart: { ...NANTES, label: 'Nantes' },
      pickup: { ...RENNES, label: 'Rennes' },
      concours: { ...LA_BAULE, label: 'La Baule' },
      pricePerKm: 0.8,
      nbPlaces: 1,
    };
    const one = buildEstimate({ ...base, allerRetour: false });
    const ar = buildEstimate({ ...base, allerRetour: true });
    expect(ar.distanceKm).toBeCloseTo(one.distanceKm * 2, 1);
    expect(ar.price).toBeCloseTo(one.price * 2, 0);
  });

  test('buildEstimate sans prise en charge — annonce : départ → concours seul', () => {
    const e = buildEstimate({
      depart: { ...NANTES, label: 'Nantes' },
      concours: { ...LA_BAULE, label: 'La Baule' },
      pricePerKm: 0.8,
    });
    expect(e.legs).toHaveLength(1);
  });
});
