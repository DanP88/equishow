/**
 * Test Suite: Import concours CSV — non-régression épreuves tronquées.
 *
 * Bug historique : le parseur CSV à 2 passes supprimait les guillemets, puis
 * splittait le champ « Épreuve » sur la virgule interne de « (1,05 m) ». Le champ
 * de 1 714 chars / ~47 épreuves était tronqué à « …au chrono (1 » (53 chars) et
 * stocké comme 1 seule pseudo-épreuve → la fiche affichait « (1) ».
 *
 * Fixture réelle : HARAS DE MADINE — numéro FFE 202655009 (CSV FFE export).
 * Garde-fous :
 *   - 12 colonnes détectées (pas 90)
 *   - champ « Épreuve » complet (~1714 chars)
 *   - > 40 épreuves détectées par le parser d'affichage (lib/epreuves)
 *   - décimales « 1,05 m » préservées (jamais coupées)
 */

import { parseCSV } from '../lib/csv';
import { parseEpreuves } from '../lib/epreuves';

// Champ « Épreuve » réel du concours 202655009 (1 714 chars, ~47 épreuves).
const MADINE_EPREUVES =
  'SO Amateur202655009 : Amateur 2 Spéciale au chrono (1,05 m), Amateur 2 Spéciale au chrono (1,05 m), Amateur 1 Grand Prix (1,15 m), Amateur Elite Grand Prix (1,30 m) SO Pro202655009 : Pro 3 Grand Prix (1,25 m), Pro 3 Grand Prix (1,25 m) SO Préparatoire202655009 : Préparatoire (0,50 m)[P][A][C], Préparatoire (0,60 m)[P][A][C], Préparatoire (0,75 m)[P][A][C], Préparatoire (1,00 m)[P][A][C], Préparatoire GP (1,20 m)[P][A][C], Préparatoire (0,80 m)[P][A][C], Préparatoire (1,05 m)[P][A][C], Préparatoire (1,05 m)[P][A][C], Préparatoire (0,90 m)[P][A][C], Préparatoire GP (1,35 m)[P][A][C], Préparatoire GP (1,30 m)[P][A][C], Préparatoire (0,60 m)[P][A][C], Préparatoire (0,70 m)[P][A][C], Préparatoire (1,15 m)[P][A][C], Préparatoire (0,70 m)[P][A][C], Préparatoire (0,85 m)[P][A][C], Préparatoire (0,95 m)[P][A][C], Préparatoire (0,85 m)[P][A][C], Préparatoire (0,95 m)[P][A][C], Préparatoire (1,10 m)[P][A][C], Préparatoire GP (1,25 m)[P][A][C], Préparatoire (0,60 m)[P][A][C], Préparatoire (1,15 m)[P][A][C] SO Elevage202655009 : SO Cycle Jeunes Poneys 6 ans C[P][A][C], SO Cycle Jeunes Poneys 6 ans D[P][A][C], SO Cycle Libre 1 - 0,95m[P][A], SO Cycle Libre 1 - 0,95m[P][A], SO Cycle Libre 2 - 1,05m[P][A], SO Cycle Libre 2 - 1,05m[P][A], SO Cycle Libre 3 - 1,15m[P][A], SO Cycle Libre 3 - 1,15m[P][A], SO Cycle Jeunes Poneys 4 ans C[P][A][C], SO Cycle Jeunes Poneys 4 ans C[P][A][C], SO Cycle Jeunes Poneys 4 ans D[P][A][C], SO Cycle Jeunes Poneys 4 ans D[P][A][C], SO Cycle Jeunes Poneys 5 ans C[P][A][C], SO Cycle Jeunes Poneys 5 ans C[P][A][C], SO Cycle Jeunes Poneys 5 ans D[P][A][C], SO Cycle Jeunes Poneys 5 ans D[P][A][C], SO Cycle Jeunes Poneys 6 ans C[P][A][C], SO Cycle Jeunes Poneys 6 ans D[P][A][C]';

const HEADER =
  'Date de début,Date de fin,Date de clôture,Organisateur terrain,Organisateur financier,Lieu,Type de concours,Département,CRE,Numéro de concours,Etat,Épreuve';

function buildMadineCsv(opts: { bom?: boolean } = {}): string {
  // Le champ Épreuve est quoté car il contient des virgules.
  const row = [
    '2026-04-28', '2026-05-03', '2026-04-27',
    'HARAS DE MADINE (5521005)', 'HARAS DE MADINE (5521005)', 'HARAS DE MADINE',
    'nan', 'Meuse', 'CRE GRAND EST', '202655009', 'Ouvert aux engagements',
    `"${MADINE_EPREUVES}"`,
  ].join(',');
  const bom = opts.bom ? '﻿' : '';
  return `${bom}${HEADER}\n${row}\n`;
}

describe('parseCSV — HARAS DE MADINE 202655009', () => {
  const { headers, rows } = parseCSV(buildMadineCsv());

  test('12 colonnes détectées (pas 90)', () => {
    expect(headers).toHaveLength(12);
    expect(headers[headers.length - 1]).toBe('Épreuve');
  });

  test('une seule ligne de données', () => {
    expect(rows).toHaveLength(1);
    expect(rows[0]['Numéro de concours']).toBe('202655009');
  });

  test('champ Épreuve complet (~1714 chars, non tronqué)', () => {
    const cell = rows[0]['Épreuve'];
    expect(cell.length).toBeGreaterThan(1700);
    // Le bug tronquait à 53 chars sur « …au chrono (1 ».
    expect(cell.length).not.toBe(53);
    // Décimale interne préservée.
    expect(cell).toContain('(1,05 m)');
    expect(cell).toContain('SO Elevage202655009');
  });

  test('strip BOM : 1er header propre même avec BOM UTF-8', () => {
    const withBom = parseCSV(buildMadineCsv({ bom: true }));
    expect(withBom.headers[0]).toBe('Date de début');
  });
});

describe('parseEpreuves — comptage affiché', () => {
  const cell = parseCSV(buildMadineCsv()).rows[0]['Épreuve'];
  const epreuves = parseEpreuves(cell);

  test('plus de 40 épreuves détectées', () => {
    expect(epreuves.length).toBeGreaterThan(40);
  });

  test('en-têtes catégorie et tags [P][A][C] retirés', () => {
    for (const e of epreuves) {
      expect(e).not.toMatch(/\bSO\s+\S*\d{4,}\s*:/); // pas d'en-tête « SO …202655009 : »
      expect(e).not.toMatch(/\[[A-Za-z]\]/);          // pas de tag [P]/[A]/[C]
    }
  });

  test('décimales préservées (jamais coupées sur la virgule)', () => {
    expect(epreuves).toContain('Amateur 2 Spéciale au chrono (1,05 m)');
    expect(epreuves.some((e) => /\(1,05 m\)/.test(e))).toBe(true);
  });

  test('doublons FFE légitimes conservés (sessions distinctes)', () => {
    const dups = epreuves.filter((e) => e === 'Amateur 2 Spéciale au chrono (1,05 m)');
    expect(dups.length).toBeGreaterThanOrEqual(2);
  });

  test('idempotent : re-parser un tableau déjà découpé ne change rien', () => {
    expect(parseEpreuves(epreuves)).toEqual(epreuves);
  });
});

describe('parseEpreuves — en-tête catégorie multi-discipline (SO/DR/CSO…)', () => {
  test('strip DR (dressage), pas seulement SO', () => {
    const dr = 'DR Pro202618005 : Pro 2 A, As Jeune Elite - Grand Prix, As Jeune Elite - Equipe';
    const e = parseEpreuves(dr);
    expect(e).toEqual(['Pro 2 A', 'As Jeune Elite - Grand Prix', 'As Jeune Elite - Equipe']);
    // Aucune épreuve ne doit garder le numéro de concours ni le « : » d'en-tête.
    for (const lbl of e) expect(lbl).not.toMatch(/\d{4,}\s*:/);
  });
});
