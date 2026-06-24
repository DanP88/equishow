// ─────────────────────────────────────────────────────────────────────────────
// SEED DEV — offres d'exemple (box + coaching) rattachées au concours « CSO de
// Saumur », pour tester l'atterrissage depuis l'accueil (Trouver un box / un coach)
// SANS écrire en base. Garde __DEV__ (jamais actif dans le build prod Vercel).
// Pour désactiver : SERVICES_DEV_SEED = false (ou supprimer le fichier + son import
// dans app/(tabs)/services.tsx). Le nom de concours DOIT matcher hero.concoursNom.
// ─────────────────────────────────────────────────────────────────────────────
import type { BoxAnnonce, CoachAnnonce } from '../types/service';

// ⚠️ DEV ONLY — false par défaut (aucun mock par accident). Mettre true EN LOCAL
// uniquement. L'écran gate déjà avec __DEV__ ; ce défaut false est une 2e barrière.
// Ne PAS commit ce flag à true.
export const SERVICES_DEV_SEED = false;

const CONCOURS = 'CSO de Saumur';
const d = (n: number): Date => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + n); return x; };

// Location de box pour le CSO de Saumur
export const MOCK_BOX_ANNONCES: BoxAnnonce[] = [
  {
    id: 'mock-box-1', auteurId: 'mock-seller-ep', auteurNom: 'Écurie du Parquet',
    auteurPseudo: 'ecurie-parquet', auteurInitiales: 'ÉP', auteurCouleur: '#C0A04B',
    lieu: 'Saumur (49)', dateDebut: d(11), dateFin: d(14), nbBoxes: 6, nbBoxesDisponibles: 6,
    prixNuitHT: 55, concours: CONCOURS,
    description: "Boxes paillés 3×3, accès van, point d'eau. À 5 min du terrain.",
  },
  {
    id: 'mock-box-2', auteurId: 'mock-seller-hc', auteurNom: 'Haras de la Cavalerie',
    auteurPseudo: 'haras-cavalerie', auteurInitiales: 'HC', auteurCouleur: '#2F7D52',
    lieu: 'Saumur (49)', dateDebut: d(11), dateFin: d(14), nbBoxes: 4, nbBoxesDisponibles: 2,
    prixNuitHT: 70, concours: CONCOURS,
    description: 'Boxes en dur, copeaux, douche chevaux, gardiennage de nuit.',
  },
];

// 2 coachings pour le CSO de Saumur
export const MOCK_COACH_ANNONCES: CoachAnnonce[] = [
  {
    id: 'mock-coach-1', auteurId: 'mock-coach-el', auteurNom: 'Émilie Laurent',
    auteurPseudo: 'emilie-laurent', auteurInitiales: 'EL', auteurCouleur: '#7C3AED',
    titre: 'Coaching CSO sur le concours', description: "Détente + tour, réglages d'abords. Niveau Amateur/Pro.",
    type: 'concours', discipline: 'CSO', niveau: 'Amateur', dateDebut: d(12), dateFin: d(13),
    prixHeure: 60, places: 5, placesDisponibles: 4, concours: CONCOURS, region: 'Pays de la Loire',
  },
  {
    id: 'mock-coach-2', auteurId: 'mock-coach-tb', auteurNom: 'Thomas Bert',
    auteurPseudo: 'thomas-bert', auteurInitiales: 'TB', auteurCouleur: '#0D9488',
    titre: 'Préparation & coaching paddock', description: 'Accompagnement détente, gestion du stress, plan de tour. Club à Amateur.',
    type: 'concours', discipline: 'CSO', niveau: 'Club', dateDebut: d(12), dateFin: d(13),
    prixHeure: 45, places: 6, placesDisponibles: 6, concours: CONCOURS, region: 'Pays de la Loire',
  },
];
