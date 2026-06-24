// ─────────────────────────────────────────────────────────────────────────────
// SEED DEV — données d'exemple pour tester visuellement l'onglet Accueil cavalier
// SANS écrire en base. Garde __DEV__ (jamais actif dans le build prod Vercel).
// Pour revenir aux vraies données : mettre ACCUEIL_DEV_SEED = false (ou supprimer
// ce fichier + son import dans app/(tabs)/accueil.tsx).
// ─────────────────────────────────────────────────────────────────────────────
import type { ChevalConcours } from '../hooks/useChevalReservations';
import type { ResaSummaryItem } from '../hooks/useMyReservationsSummary';

// ⚠️ DEV ONLY — false par défaut (aucun mock par accident). Mettre true EN LOCAL
// uniquement pour tester visuellement l'accueil. L'écran gate déjà avec __DEV__ ;
// ce défaut false est une 2e barrière. Ne PAS commit ce flag à true.
export const ACCUEIL_DEV_SEED = false;

const addDays = (n: number): Date => {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d;
};
const iso = (d: Date): string => d.toISOString().slice(0, 10);

export const MOCK_ACCUEIL: {
  concours: ChevalConcours[];
  resa: ResaSummaryItem[];
  heldCount: number;
} = {
  concours: [
    {
      key: 'mock-saumur', concoursId: 'mock-saumur', concoursNom: 'CSO de Saumur',
      dateFin: iso(addDays(12)), past: false, lieu: 'Saumur', departement: '49',
      // P6 : 2/3 prêt (box + transport réservés) → seul le Coach « À réserver ».
      reserved: [
        { module: 'box', label: 'Box', icon: '📦', status: 'paid' },
        { module: 'transport', label: 'Transport', icon: '🚐', status: 'paid' },
      ],
      available: { box: 6, transport: 2, coach: 4, stage: 1 },
      availableFrom: { box: 55, transport: 80, coach: 45, stage: null },
    },
    {
      key: 'mock-fontainebleau', concoursId: 'mock-fontainebleau', concoursNom: 'Jumping de Fontainebleau',
      dateFin: iso(addDays(34)), past: false, lieu: 'Fontainebleau', departement: '77',
      reserved: [], available: { box: 5, transport: 3, coach: 2, stage: 0 },
      availableFrom: { box: 60, transport: 90, coach: 50, stage: null },
    },
  ],
  // Cohérent avec le hero (seul le transport est réservé) : transport payé, et une
  // demande de coach en attente. Box + coach « à réserver » côté hero.
  resa: [
    { id: 'mock-resa-box', module: 'box', titre: 'Box CSO de Saumur', vendeur: 'Écurie du Parquet', montant: 165, statut: 'paid', needsPayment: false, dateDebut: addDays(11) },
    { id: 'mock-resa-transport', module: 'transport', titre: 'Lyon → Saumur', vendeur: 'Camille T.', montant: 98, statut: 'paid', needsPayment: false, dateDebut: addDays(10) },
  ],
  heldCount: 2,
};
