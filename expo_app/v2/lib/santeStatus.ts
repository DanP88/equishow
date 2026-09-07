// ─────────────────────────────────────────────────────────────────────────────
// v2/lib/santeStatus — statut réel d'un rappel de santé (F11).
//
// Corrige, POUR LA V2, l'affichage « Valide » codé en dur de la V1
// (`app/cheval/[id].tsx` SanteVaccinItem). Le statut est calculé à partir de la
// vraie date du dernier rappel. Aucune écriture, aucun backend.
//
// Règle (grippe / rhino, alignée sur l'usage FFE : rappel annuel) :
//   • date future ou invalide      → « Date à vérifier » (gris)
//   • < 11 mois                    → « À jour » (vert)
//   • 11–12 mois                   → « Rappel à prévoir » (orange)
//   • > 12 mois                    → « Rappel dépassé » (rouge)
// ─────────────────────────────────────────────────────────────────────────────
import { Colors } from '../../constants/colors';

export type SanteLevel = 'ok' | 'soon' | 'late' | 'unknown';

export interface SanteStatus {
  level: SanteLevel;
  label: string;
  color: string;
  /** « il y a 8 mois » — pour l'affichage secondaire. */
  ageLabel: string;
}

const MONTH = 30.44 * 24 * 3600 * 1000;

export function vaccinStatus(date?: Date | string | null): SanteStatus {
  const d = date == null ? undefined : (date instanceof Date ? date : new Date(date));
  if (!d || Number.isNaN(d.getTime()) || d.getTime() > Date.now()) {
    return { level: 'unknown', label: 'Date à vérifier', color: Colors.textTertiary, ageLabel: '' };
  }
  const months = (Date.now() - d.getTime()) / MONTH;
  const ageLabel = months < 1
    ? 'ce mois-ci'
    : months < 12
      ? `il y a ${Math.round(months)} mois`
      : `il y a ${Math.floor(months / 12)} an${months >= 24 ? 's' : ''}${Math.round(months % 12) ? ` ${Math.round(months % 12)} mois` : ''}`;

  if (months < 11) return { level: 'ok', label: 'À jour', color: Colors.success, ageLabel };
  if (months <= 12) return { level: 'soon', label: 'Rappel à prévoir', color: Colors.warning, ageLabel };
  return { level: 'late', label: 'Rappel dépassé', color: Colors.urgent, ageLabel };
}

/** Statut « soin » plus lâche (vermifuge, dentiste, ostéo, maréchal). */
export function soinStatus(date?: Date | string | null, maxMonths = 6): SanteStatus {
  const d = date == null ? undefined : (date instanceof Date ? date : new Date(date));
  if (!d || Number.isNaN(d.getTime()) || d.getTime() > Date.now()) {
    return { level: 'unknown', label: 'Date à vérifier', color: Colors.textTertiary, ageLabel: '' };
  }
  const months = (Date.now() - d.getTime()) / MONTH;
  const ageLabel = months < 1 ? 'ce mois-ci' : `il y a ${Math.round(months)} mois`;
  if (months <= maxMonths) return { level: 'ok', label: 'À jour', color: Colors.success, ageLabel };
  if (months <= maxMonths * 1.5) return { level: 'soon', label: 'Bientôt', color: Colors.warning, ageLabel };
  return { level: 'late', label: 'À refaire', color: Colors.urgent, ageLabel };
}
