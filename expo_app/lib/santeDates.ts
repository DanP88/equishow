// ─────────────────────────────────────────────────────────────────────────────
// Révision des dates du suivi santé d'un cheval.
//
// `chevaux.sante` / `chevaux.gestion` sont des colonnes JSONB : à la relecture,
// Supabase renvoie les dates en **string ISO**, jamais en objet `Date`. Or le
// type `SuiviSante` les déclare `Date` et des composants (ex. DatePickerModal)
// appellent directement des méthodes de `Date` dessus (`getFullYear`, …) →
// « undefined is not a function » si on leur passe une string.
//
// On reconstruit donc les `Date` au moment où la ligne DB devient un `Cheval`.
// ─────────────────────────────────────────────────────────────────────────────
import type { SuiviSante } from '../types/cheval';

export const SANTE_DATE_KEYS = [
  'dateVaccinGrippe',
  'dateVaccinRhino',
  'dateVermifuge',
  'dateMarechal',
  'dateDentiste',
  'dateOsteo',
] as const;

/** string | number | Date | null → Date valide, ou `undefined`. */
export function toDateOrUndefined(v: unknown): Date | undefined {
  if (v == null) return undefined;
  const d = v instanceof Date ? v : new Date(v as string | number);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Renvoie une copie de `sante` où chaque champ date est un `Date` (ou absent si
 * invalide). Ne touche pas aux autres champs (antécédents, allergies…).
 */
export function reviveSanteDates(sante: unknown): SuiviSante {
  const src = (sante && typeof sante === 'object') ? (sante as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...src };
  for (const key of SANTE_DATE_KEYS) {
    if (key in out) {
      const revived = toDateOrUndefined(out[key]);
      if (revived) out[key] = revived;
      else delete out[key];
    }
  }
  return out as SuiviSante;
}
