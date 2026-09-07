// F15 §1 & §3 — destination auto depuis le concours : ordre de fallback.
import { buildDestination, placeMatches } from '../v2/lib/concoursDestination';

describe('buildDestination — ordre de fallback (F15 §1)', () => {
  test('1. adresse complète (+ CP + ville des infos)', () => {
    const d = buildDestination({
      lieu: 'haras Parouche',
      adresse: '2 rue du clos girard',
      departement: '92',
      ville: 'issy les moulineaux',
      codePostal: '92130',
    });
    expect(d.source).toBe('adresse');
    expect(d.text).toBe('2 rue du clos girard, 92130 issy les moulineaux');
  });

  test('2. lieu + ville quand ce sont deux infos distinctes', () => {
    const d = buildDestination({ lieu: 'Grand Parquet', ville: 'Fontainebleau', departement: '77' });
    expect(d.source).toBe('lieu-ville');
    expect(d.text).toBe('Grand Parquet, Fontainebleau');
  });

  test('3. ville seule (+ CP)', () => {
    const d = buildDestination({ ville: 'Deauville', codePostal: '14800' });
    expect(d.source).toBe('ville');
    expect(d.text).toBe('Deauville (14800)');
  });

  test('4. lieu seul (import FFE : lieu = commune) + département', () => {
    const d = buildDestination({ lieu: 'La Baule', departement: '44' });
    expect(d.source).toBe('lieu');
    expect(d.text).toBe('La Baule (44)');
  });

  test('5. secteur / localisation restante (région · département)', () => {
    const d = buildDestination({ departement: '44', region: 'Pays de la Loire' });
    expect(d.source).toBe('secteur');
    expect(d.text).toBe('Pays de la Loire · 44');
  });

  test('rien d’exploitable → destination vide (on n’invente jamais)', () => {
    expect(buildDestination(null).source).toBe('none');
    expect(buildDestination({}).text).toBe('');
    expect(buildDestination({ lieu: 'nan', adresse: '—' }).text).toBe('');
  });

  test('lieu == ville → pas de doublon « La Baule, La Baule »', () => {
    const d = buildDestination({ lieu: 'La Baule', ville: 'la baule' });
    expect(d.text).not.toMatch(/,/);
  });
});

describe('placeMatches — rapprochement souple (recherche démo)', () => {
  test('« La Baule » ↔ « La Baule (44) »', () => {
    expect(placeMatches('La Baule', 'La Baule (44)')).toBe(true);
    expect(placeMatches('La Baule (44)', 'La Baule')).toBe(true);
  });
  test('« Grand Parquet, Fontainebleau » ↔ « Grand Parquet »', () => {
    expect(placeMatches('Grand Parquet, Fontainebleau', 'Grand Parquet')).toBe(true);
  });
  test('needle vide → pas de filtre', () => {
    expect(placeMatches('La Baule', '')).toBe(true);
    expect(placeMatches('La Baule', null)).toBe(true);
  });
  test('lieux différents → pas de match', () => {
    expect(placeMatches('La Baule', 'Deauville')).toBe(false);
  });
});
