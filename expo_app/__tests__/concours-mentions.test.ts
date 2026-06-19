/**
 * Test Suite: mentions de concours (lib/mentions) — fonctions pures.
 *
 * Couvre le format de jeton @[Nom](concours:UUID), la sérialisation des « @Nom »
 * saisis en clair, le parsing en segments pour le rendu, la détection de la
 * requête active d'autocomplétion et le remplacement à la sélection.
 *
 * NB : la suite jest complète est désactivée en CI (Expo SDK 54, issue #3) ;
 * ces tests pures-fonctions (sans import RN) sont aussi rejoués via un script
 * node (cf. PR). Ils s'exécuteront en CI dès restauration de l'infra jest.
 */

import {
  buildConcoursMention,
  parseConcoursMentions,
  serializeConcoursMentions,
  extractConcoursMentionIds,
  activeMentionQuery,
  replaceActiveMention,
} from '../lib/mentions';

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';

describe('buildConcoursMention', () => {
  it('construit un jeton bien formé', () => {
    expect(buildConcoursMention('CSO Deauville', UUID_A)).toBe(`@[CSO Deauville](concours:${UUID_A})`);
  });
  it('nettoie les crochets du libellé', () => {
    expect(buildConcoursMention('CSO [Deauville]', UUID_A)).toBe(`@[CSO Deauville](concours:${UUID_A})`);
  });
});

describe('serializeConcoursMentions', () => {
  it('convertit « @Nom » en jeton', () => {
    const out = serializeConcoursMentions('Je cherche un #transport pour @CSO Deauville', [
      { label: 'CSO Deauville', concoursId: UUID_A },
    ]);
    expect(out).toBe(`Je cherche un #transport pour @[CSO Deauville](concours:${UUID_A})`);
  });
  it('gère les libellés imbriqués (plus long d\'abord, pas de double-encodage)', () => {
    const out = serializeConcoursMentions('@CSO et @CSO Deauville', [
      { label: 'CSO', concoursId: UUID_A },
      { label: 'CSO Deauville', concoursId: UUID_B },
    ]);
    expect(out).toBe(`@[CSO](concours:${UUID_A}) et @[CSO Deauville](concours:${UUID_B})`);
  });
  it('ne touche pas le texte si aucune mention', () => {
    expect(serializeConcoursMentions('bonjour', [])).toBe('bonjour');
  });
});

describe('parseConcoursMentions', () => {
  it('découpe texte + mention + texte', () => {
    const segs = parseConcoursMentions(`avant @[CSO Deauville](concours:${UUID_A}) après`);
    expect(segs).toEqual([
      { type: 'text', value: 'avant ' },
      { type: 'mention', label: 'CSO Deauville', concoursId: UUID_A },
      { type: 'text', value: ' après' },
    ]);
  });
  it('round-trip build→parse', () => {
    const txt = `x ${buildConcoursMention('Jumping Bordeaux', UUID_B)} y`;
    const segs = parseConcoursMentions(txt);
    expect(segs.find((s) => s.type === 'mention')).toMatchObject({ label: 'Jumping Bordeaux', concoursId: UUID_B });
  });
  it('texte sans jeton = un seul segment texte', () => {
    expect(parseConcoursMentions('rien ici')).toEqual([{ type: 'text', value: 'rien ici' }]);
  });
});

describe('extractConcoursMentionIds', () => {
  it('liste les ids uniques mentionnés', () => {
    const txt = `@[A](concours:${UUID_A}) @[B](concours:${UUID_B}) @[A2](concours:${UUID_A})`;
    expect(extractConcoursMentionIds(txt)).toEqual([UUID_A, UUID_B]);
  });
});

describe('activeMentionQuery', () => {
  it('détecte la requête en cours après @', () => {
    expect(activeMentionQuery('je cherche @cso')).toBe('cso');
    expect(activeMentionQuery('@')).toBe('');
  });
  it('null si pas de @ actif en fin', () => {
    expect(activeMentionQuery('je cherche un transport')).toBeNull();
    expect(activeMentionQuery('@cso Deauville ')).toBeNull(); // espace → requête close
  });
});

describe('replaceActiveMention', () => {
  it('remplace la @requête de fin par @Nom (clair) + espace, sépareur préservé', () => {
    expect(replaceActiveMention('je cherche @cso', 'CSO Deauville')).toBe('je cherche @CSO Deauville ');
    expect(replaceActiveMention('@c', 'CSO Deauville')).toBe('@CSO Deauville ');
  });
});
