/**
 * Test Suite: révision des dates du suivi santé cheval
 * Sans dépendances externes (pas de Supabase / React).
 *
 * Régression : fiche cheval → « Modifier » (n'importe quelle section) plantait
 * avec « undefined is not a function » quand une date de `sante` relue depuis
 * le JSONB Supabase était une string ISO (et non un objet Date) : le
 * DatePickerModal appelait `value.getDate()` dessus.
 */
import { reviveSanteDates, toDateOrUndefined, SANTE_DATE_KEYS } from '../lib/santeDates';

describe('toDateOrUndefined', () => {
  it('convertit une string ISO en Date valide', () => {
    const d = toDateOrUndefined('2026-06-02T22:00:00.000Z');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2026);
  });

  it('laisse passer un objet Date', () => {
    const src = new Date('2026-01-01');
    expect(toDateOrUndefined(src)).toBe(src);
  });

  it('renvoie undefined pour null / undefined / string invalide', () => {
    expect(toDateOrUndefined(null)).toBeUndefined();
    expect(toDateOrUndefined(undefined)).toBeUndefined();
    expect(toDateOrUndefined('pas une date')).toBeUndefined();
  });
});

describe('reviveSanteDates', () => {
  it('cheval sans données santé → objet vide, aucune exception', () => {
    expect(reviveSanteDates({})).toEqual({});
    expect(reviveSanteDates(null)).toEqual({});
    expect(reviveSanteDates(undefined)).toEqual({});
  });

  it('reconstruit toutes les dates connues en objets Date', () => {
    const raw: Record<string, string> = {};
    for (const k of SANTE_DATE_KEYS) raw[k] = '2026-06-02T22:00:00.000Z';
    const revived = reviveSanteDates(raw) as Record<string, unknown>;
    for (const k of SANTE_DATE_KEYS) {
      expect(revived[k]).toBeInstanceOf(Date);
      // la Date reconstruite doit exposer les méthodes utilisées par DatePickerModal
      expect(typeof (revived[k] as Date).getDate).toBe('function');
      expect(typeof (revived[k] as Date).getFullYear).toBe('function');
    }
  });

  it('préserve les champs non-date (antécédents, allergies…)', () => {
    const revived = reviveSanteDates({
      dateVaccinGrippe: '2026-06-02T22:00:00.000Z',
      antecedents: 'RAS',
      allergies: 'pollen',
    }) as Record<string, unknown>;
    expect(revived.antecedents).toBe('RAS');
    expect(revived.allergies).toBe('pollen');
    expect(revived.dateVaccinGrippe).toBeInstanceOf(Date);
  });

  it('supprime une date invalide au lieu de la garder en string', () => {
    const revived = reviveSanteDates({ dateVermifuge: 'oops' }) as Record<string, unknown>;
    expect('dateVermifuge' in revived).toBe(false);
  });

  it('scénario crash : la valeur passée au DatePickerModal expose getDate()', () => {
    // Reproduit la chaîne rowToCheval → EditModal state → DatePickerModal.value
    const cheval = { sante: reviveSanteDates({ dateVaccinGrippe: '2026-06-02T22:00:00.000Z' }) };
    const valuePassedToPicker = cheval.sante.dateVaccinGrippe as Date | undefined;
    // Avant le fix : string → .getDate n'existe pas → crash.
    expect(() => (valuePassedToPicker as Date).getDate()).not.toThrow();
  });
});
