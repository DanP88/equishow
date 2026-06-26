/**
 * Test Suite — 084 catégories concours.
 *
 * Couvre :
 *   - parseCSV : auto-détection du séparateur « ; » (format fusion canonique)
 *     où la colonne `categories` contient des virgules internes ;
 *   - parseCategories : découpe, trim, dédoublonnage des catégories ;
 *   - non-régression du séparateur « , » historique (FFE standard).
 *
 * Fixture réelle : 1ʳᵉ ligne de concours_fusion_canonique.csv (TOUS EN PISTE).
 */

import { parseCSV } from '../lib/csv';
import { parseCategories } from '../lib/categories';

const FUSION_HEADER =
  'source_type;source_file;discipline;region;departement;lieu;numero_concours;club;num_club;date_cloture;date_debut;date_fin;categories;etat;organisateur_terrain;organisateur_financier;type_concours;epreuves';

// Catégories réelles (séparées par virgules) — DANS un champ délimité par « ; ».
const FUSION_CATS =
  'Club 2 Circuit Dpt, Club 1 Circuit Dpt, Club Elite Circuit Dpt, Poney 3 B Circuit Dpt, Poney 3 Circuit Dpt';

// date_fin est vide dans ce fichier (« 23/08/2026;; ») → 18 champs, categories en 13e.
const FUSION_ROW =
  `CSV;BoCCEclubponey(1).csv;CCE;BOURGOGNE-FRANCHE-COMTE;71;DOMAINE EQUESTRE DE LAIZE;2626732;TOUS EN PISTE;7187001;17/08;23/08/2026;;${FUSION_CATS};;;;;`;

describe('parseCSV — auto-détection séparateur « ; » (fusion canonique)', () => {
  const { headers, rows } = parseCSV(`${FUSION_HEADER}\n${FUSION_ROW}\n`);

  test('18 colonnes détectées (split sur ; pas sur ,)', () => {
    expect(headers).toHaveLength(18);
    expect(headers).toContain('categories');
    expect(headers).toContain('numero_concours');
  });

  test('le champ categories conserve ses virgules internes', () => {
    expect(rows).toHaveLength(1);
    expect(rows[0]['categories']).toBe(FUSION_CATS);
    expect(rows[0]['numero_concours']).toBe('2626732');
  });

  test('séparateur « ; » forçable explicitement', () => {
    const forced = parseCSV(`${FUSION_HEADER}\n${FUSION_ROW}\n`, ';');
    expect(forced.headers).toHaveLength(18);
  });
});

describe('parseCSV — non-régression séparateur « , » (FFE standard)', () => {
  test('un CSV à virgules reste découpé sur la virgule', () => {
    const { headers, rows } = parseCSV('a,b,c\n1,2,3\n');
    expect(headers).toEqual(['a', 'b', 'c']);
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '3' });
  });
});

describe('parseCategories', () => {
  test('découpe la liste réelle en catégories trimées', () => {
    expect(parseCategories(FUSION_CATS)).toEqual([
      'Club 2 Circuit Dpt',
      'Club 1 Circuit Dpt',
      'Club Elite Circuit Dpt',
      'Poney 3 B Circuit Dpt',
      'Poney 3 Circuit Dpt',
    ]);
  });

  test('dédoublonne (insensible casse/espaces), conserve la 1ʳᵉ graphie', () => {
    expect(parseCategories('Club 1, club 1 ,  CLUB 1')).toEqual(['Club 1']);
  });

  test('tolère « ; » et sauts de ligne comme séparateurs', () => {
    expect(parseCategories('Club 1; Club 2\nClub 3')).toEqual(['Club 1', 'Club 2', 'Club 3']);
  });

  test('vide / null / espaces → []', () => {
    expect(parseCategories('')).toEqual([]);
    expect(parseCategories(null)).toEqual([]);
    expect(parseCategories('   ,  , ')).toEqual([]);
  });
});
