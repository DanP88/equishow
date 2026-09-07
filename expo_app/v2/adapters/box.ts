// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/box — résultats de recherche Box.
//
// LECTURE SEULE des annonces RÉELLES (useBoxAnnonces, V1) filtrées par contexte
// (concours / période). Repli DÉMO uniquement SANS session réelle.
// Un compte connecté sans résultat réel → liste vide (jamais de mocks).
// Miroir strict de v2/adapters/transport (F5).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBoxAnnonces } from '../../hooks/useBoxes';
import { getCommission } from '../../types/service';
import { MOCK_BOXES } from '../mocks/box';
import { placeMatches } from '../lib/concoursDestination';

export interface V2BoxResult {
  src: 'real' | 'demo';
  id: string;
  hote: string;
  initiales: string;
  couleur: string;
  note?: number;
  distanceKm?: number;
  lieu: string;
  dateDebut?: string;    // ISO
  dateFin?: string;      // ISO
  nbBox: number;         // boxes disponibles
  prixNuit: number;      // € par box et par nuit
  litiereIncluse: boolean;
  equipements?: string;
  concoursNom?: string;
  concoursId?: string;
  description?: string;
}

export interface BoxSearchCtx {
  concoursId?: string;
  lieu?: string;
  dateDebut?: string; // 'YYYY-MM-DD'
  dateFin?: string;
}

const COMMISSION = () => { try { return getCommission('box'); } catch { return 0.09; } };

function iso(d: string) { return d.length >= 10 ? d.slice(0, 10) : d; }
function ts(d?: string) { return d ? new Date(`${iso(d)}T00:00:00`).getTime() : NaN; }

/** [a1,a2] chevauche [b1,b2] ? (bornes ouvertes tolérées) */
function overlaps(a1: number, a2: number, b1: number, b2: number) {
  const lo1 = isNaN(a1) ? -Infinity : a1;
  const hi1 = isNaN(a2) ? Infinity : a2;
  const lo2 = isNaN(b1) ? -Infinity : b1;
  const hi2 = isNaN(b2) ? Infinity : b2;
  return lo1 <= hi2 && lo2 <= hi1;
}

export function useV2BoxResults(ctx: BoxSearchCtx) {
  const { isSignedIn } = useAuth();
  const { boxes } = useBoxAnnonces();

  return useMemo(() => {
    const wantLo = ts(ctx.dateDebut);
    const wantHi = ts(ctx.dateFin) || wantLo;

    // ── annonces réelles compatibles (boxes dispo, concours, période) ──
    const real: V2BoxResult[] = (boxes ?? [])
      .filter((b) => (b.nbBoxesDisponibles ?? 0) > 0)
      .filter((b) => (ctx.concoursId ? b.concoursId === ctx.concoursId : true))
      .filter((b) => {
        if (ctx.concoursId) return true; // le concours suffit
        if (isNaN(wantLo)) return true;
        const bl = b.dateDebut instanceof Date ? b.dateDebut.getTime() : NaN;
        const bh = b.dateFin instanceof Date ? b.dateFin.getTime() : NaN;
        return overlaps(wantLo, wantHi, bl, bh);
      })
      .map((b) => ({
        src: 'real' as const,
        id: b.id,
        hote: b.auteurNom || b.auteurPseudo || 'Hôte',
        initiales: b.auteurInitiales || (b.auteurNom || '?').slice(0, 2).toUpperCase(),
        couleur: b.auteurCouleur || '#7C3AED',
        lieu: b.lieu || '—',
        dateDebut: b.dateDebut instanceof Date ? b.dateDebut.toISOString() : undefined,
        dateFin: b.dateFin instanceof Date ? b.dateFin.toISOString() : undefined,
        nbBox: b.nbBoxesDisponibles ?? 0,
        prixNuit: Math.round(Number(b.prixNuitHT) || 0),
        litiereIncluse: false,
        concoursNom: b.concours || undefined,
        concoursId: b.concoursId || undefined,
        description: b.description || undefined,
      }));

    if (isSignedIn) {
      // Compte réel : jamais de mocks. Zéro résultat = vrai vide.
      return { results: real, demo: false, commission: COMMISSION() };
    }

    // Prototype non connecté : démonstration.
    const demo: V2BoxResult[] = MOCK_BOXES
      .filter((m) => placeMatches(m.lieu, ctx.lieu))
      .map((m) => ({
        src: 'demo' as const,
        id: m.id, hote: m.hote, initiales: m.initiales, couleur: m.couleur,
        note: m.note, distanceKm: m.distanceKm, lieu: m.lieu,
        dateDebut: `${m.dateDebut}T00:00:00`, dateFin: `${m.dateFin}T00:00:00`,
        nbBox: m.nbBoxDisponibles, prixNuit: m.prixNuit, litiereIncluse: m.litiereIncluse,
        equipements: m.equipements, concoursNom: m.concoursNom, description: m.description,
      }));
    return { results: [...real, ...demo], demo: true, commission: COMMISSION() };
  }, [isSignedIn, boxes, ctx.concoursId, ctx.lieu, ctx.dateDebut, ctx.dateFin]);
}

/** Nombre de nuits entre deux dates 'YYYY-MM-DD' (min 1). */
export function nightsBetween(d1?: string, d2?: string): number {
  const a = ts(d1); const b = ts(d2);
  if (isNaN(a) || isNaN(b)) return 2;
  return Math.max(1, Math.round((b - a) / 86400000));
}

/** Retrouve un résultat (réel ou démo) par id — pour la fiche détail. */
export function findBoxResult(all: V2BoxResult[], id: string) {
  return all.find((r) => r.id === id);
}
