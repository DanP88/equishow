/**
 * Test Suite — décodage robuste des imports (lib/encoding).
 * Couvre : UTF-8 propre inchangé, Windows-1252/Latin-1 réparé, double-encodage réparé,
 * non-régression (pas de faux positif sur du texte FR correct).
 */
import { decodeImportedText, hasMojibakeMarkers } from '../lib/encoding';

const enc = (s: string, encoding: 'utf8' | 'latin1') =>
  Uint8Array.from(Buffer.from(s, encoding)).buffer;

describe('decodeImportedText', () => {
  test('UTF-8 propre → inchangé (accents corrects préservés)', () => {
    const src = 'Préparatoire, Annulé, Région, Élevage';
    expect(decodeImportedText(enc(src, 'utf8'))).toBe(src);
  });

  test('Windows-1252 / Latin-1 → accents réparés', () => {
    // « é » = octet 0xE9 en Latin-1 (octet invalide en UTF-8)
    const out = decodeImportedText(enc('Préparatoire Annulé', 'latin1'));
    expect(out).toBe('Préparatoire Annulé');
    expect(out).not.toContain('�');
  });

  test('double-encodé (« PrÃ©paratoire ») → réparé', () => {
    // simulate : octets UTF-8 réinterprétés en Latin-1 puis ré-encodés UTF-8
    const doubled = Buffer.from(Buffer.from('Préparatoire Annulé', 'utf8').toString('latin1'), 'utf8');
    expect(doubled.toString('utf8')).toContain('Ã©'); // bien double-encodé
    const out = decodeImportedText(Uint8Array.from(doubled).buffer);
    expect(out).toBe('Préparatoire Annulé');
    expect(hasMojibakeMarkers(out)).toBe(false);
  });

  test('pas de faux positif : texte ASCII/CSV intact', () => {
    const csv = 'Club 2 Circuit Dpt, Poney Elite, As Poney 1';
    expect(decodeImportedText(enc(csv, 'utf8'))).toBe(csv);
    expect(hasMojibakeMarkers(csv)).toBe(false);
  });
});
