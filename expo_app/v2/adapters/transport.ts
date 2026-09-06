// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/transport — résultats de recherche Transport.
//
// LECTURE SEULE des annonces RÉELLES (useTransportAnnonces, V1) filtrées par
// contexte (concours / dates). Repli DÉMO uniquement SANS session réelle.
// Un compte connecté sans résultat réel → liste vide (jamais de mocks).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTransportAnnonces } from '../../hooks/useTransports';
import { getCommission } from '../../types/service';
import { MOCK_TRANSPORTS } from '../mocks/transport';

export interface V2TransportResult {
  src: 'real' | 'demo';
  id: string;
  conducteur: string;
  initiales: string;
  couleur: string;
  note?: number;
  trajets?: number;
  depart: string;
  destination: string;
  date?: string;         // 'YYYY-MM-DD' ou ISO
  heure?: string;
  allerRetour: boolean;
  places: number;
  prix: number;          // € par place (approx pour trajets réels : prix_ht)
  concoursNom?: string;
  concoursId?: string;
  peutTransporterCavalier: boolean;
  description?: string;
}

export interface TransportSearchCtx {
  concoursId?: string;
  destination?: string;
  dateAller?: string; // 'YYYY-MM-DD'
}

const COMMISSION = () => { try { return getCommission('trajet'); } catch { return 0.05; } };

function iso(d: string) { return d.length >= 10 ? d.slice(0, 10) : d; }

export function useV2TransportResults(ctx: TransportSearchCtx) {
  const { isSignedIn } = useAuth();
  const { transports } = useTransportAnnonces();

  return useMemo(() => {
    // ── annonces réelles compatibles (trajets uniquement, places dispo) ──
    const real: V2TransportResult[] = (transports ?? [])
      .filter((t) => (t.typeTransport ?? 'trajet') === 'trajet')
      .filter((t) => (t.nbPlacesDisponibles ?? 0) > 0)
      .filter((t) => (ctx.concoursId ? t.concoursId === ctx.concoursId : true))
      .filter((t) => {
        if (!ctx.dateAller || !t.dateTrajet) return true;
        // fenêtre ± 3 jours autour de la date demandée
        const target = new Date(`${iso(ctx.dateAller)}T00:00:00`).getTime();
        const dt = t.dateTrajet.getTime();
        return Math.abs(dt - target) <= 3 * 86400000;
      })
      .map((t) => ({
        src: 'real' as const,
        id: t.id,
        conducteur: t.auteurNom || t.auteurPseudo || 'Conducteur',
        initiales: t.auteurInitiales || (t.auteurNom || '?').slice(0, 2).toUpperCase(),
        couleur: t.auteurCouleur || '#7C3AED',
        depart: t.villeDepart || t.adresseVan || '—',
        destination: t.villeArrivee || t.adresseArrivee || '—',
        date: t.dateTrajet ? t.dateTrajet.toISOString() : undefined,
        heure: t.heureDepart || undefined,
        allerRetour: !!t.allerRetour,
        places: t.nbPlacesDisponibles ?? 0,
        prix: Math.round(Number(t.prixHT) || 0),
        concoursNom: t.concours || undefined,
        concoursId: t.concoursId || undefined,
        peutTransporterCavalier: false,
        description: t.description || undefined,
      }));

    if (isSignedIn) {
      // Compte réel : jamais de mocks. Zéro résultat = vrai vide.
      return { results: real, demo: false, commission: COMMISSION() };
    }

    // Prototype non connecté : démonstration.
    const demo: V2TransportResult[] = MOCK_TRANSPORTS
      .filter((m) => (ctx.destination ? m.destination.toLowerCase().includes(ctx.destination.toLowerCase()) || !ctx.destination : true))
      .map((m) => ({
        src: 'demo' as const,
        id: m.id, conducteur: m.conducteur, initiales: m.initiales, couleur: m.couleur,
        note: m.note, trajets: m.trajets, depart: m.depart, destination: m.destination,
        date: m.date, heure: m.heure, allerRetour: m.allerRetour, places: m.places,
        prix: m.prix, concoursNom: m.concoursNom, peutTransporterCavalier: m.peutTransporterCavalier,
        description: m.description,
      }));
    return { results: [...real, ...demo], demo: true, commission: COMMISSION() };
  }, [isSignedIn, transports, ctx.concoursId, ctx.destination, ctx.dateAller]);
}

/** Retrouve un résultat (réel ou démo) par id — pour la fiche détail. */
export function findTransportResult(all: V2TransportResult[], id: string) {
  return all.find((r) => r.id === id);
}
