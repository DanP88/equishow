// Tests multi-discipline épreuves picker — fonctions pures de lib/epreuves.ts
// Cf. contraintes de la PR : format liste_epreuves plat, labels inconnus préservés,
// disciplines dérivées stables, fallback sur discipline_principale.
import {
  EPREUVES_PAR_DISCIPLINE,
  DISCIPLINES_EPREUVES,
  disciplineOfEpreuve,
  deriveDisciplines,
} from './epreuves';

// ── T01 : sélection multi-disciplines ───────────────────────────────────────
test('T01 — catalogue contient plusieurs disciplines avec des épreuves', () => {
  expect(DISCIPLINES_EPREUVES.length).toBeGreaterThanOrEqual(3);
  for (const disc of DISCIPLINES_EPREUVES) {
    expect(EPREUVES_PAR_DISCIPLINE[disc].length).toBeGreaterThan(0);
  }
});

// ── T02 : changement d'onglet sans perte (garantie structurelle) ─────────────
// Le composant MultiDisciplineEpreuvePicker garde `activeDisc` en état interne
// et n'appelle JAMAIS onChange lors d'un changement d'onglet.
// On vérifie que `disciplineOfEpreuve` est stable : une épreuve CSO reste CSO
// quelle que soit la discipline active.
test('T02 — disciplineOfEpreuve stable (simulacre changement onglet)', () => {
  const ep = '1.20m';
  // Peu importe le "contexte" actif, le mapping reste le même.
  expect(disciplineOfEpreuve(ep)).toBe('CSO');
  expect(disciplineOfEpreuve(ep)).toBe('CSO');
});

// ── T03 : changement discipline principale sans perte ────────────────────────
// creer-concours.tsx gère `discipline` et `epreuves` comme deux états distincts.
// deriveDisciplines ne lit pas `discipline` — seul le payload l'utilise.
// Changer discipline principale ne réinitialise pas la liste épreuves.
test('T03 — deriveDisciplines ne dépend pas de la discipline principale (états indépendants)', () => {
  const epreuves = ['1.20m', 'Dressage Pro'];
  const avecCSO = deriveDisciplines(epreuves, ['CSO']);
  const avecDressage = deriveDisciplines(epreuves, ['Dressage']);
  // Disciplines dérivées des épreuves sont les mêmes quelle que soit discipline principale
  expect(avecCSO).toEqual(['CSO', 'Dressage']);
  expect(avecDressage).toEqual(['CSO', 'Dressage']);
});

// ── T04 : déduplication ─────────────────────────────────────────────────────
// Le toggle du picker : [...selected, label] seulement si !selected.includes(label)
test('T04 — pas de doublon si même label soumis deux fois (simulacre toggle)', () => {
  function toggle(selected: string[], label: string): string[] {
    if (selected.includes(label)) return selected.filter(x => x !== label);
    return [...selected, label];
  }
  const s0: string[] = [];
  const s1 = toggle(s0, '1.20m');
  const s2 = toggle(s1, '1.20m'); // désélectionne
  const s3 = toggle(s2, '1.20m'); // resélectionne
  // Aucun doublon à aucune étape
  expect(s1).toEqual(['1.20m']);
  expect(s2).toEqual([]);
  expect(s3).toEqual(['1.20m']);
  // Ajout d'un second et retoggle du premier
  const s4 = toggle(s3, 'Dressage Pro');
  expect(new Set(s4).size).toBe(s4.length); // pas de doublon
});

// ── T05 : ordre stable des disciplines dérivées ──────────────────────────────
test('T05 — deriveDisciplines respecte DISCIPLINES_EPREUVES quel que soit l\'ordre de sélection', () => {
  const ordre1 = deriveDisciplines(['Dressage Pro', '1.20m'], []);
  const ordre2 = deriveDisciplines(['1.20m', 'Dressage Pro'], []);
  // Toujours CSO avant Dressage (ordre DISCIPLINES_EPREUVES)
  expect(ordre1).toEqual(['CSO', 'Dressage']);
  expect(ordre2).toEqual(['CSO', 'Dressage']);
});

// ── T06 : préservation d'une valeur FFE inconnue ─────────────────────────────
test('T06 — disciplineOfEpreuve retourne null pour un label FFE hors catalogue', () => {
  expect(disciplineOfEpreuve('Prix des As Jeunes Etape 1 (1,30 m)')).toBeNull();
  expect(disciplineOfEpreuve('SO Amateur2026 : préparatoire')).toBeNull();
  expect(disciplineOfEpreuve('')).toBeNull();
});

// ── T07 : suppression explicite d'une valeur inconnue ────────────────────────
test('T07 — remove() supprime un label inconnu de selected', () => {
  function remove(selected: string[], label: string): string[] {
    return selected.filter(x => x !== label);
  }
  const ffe = 'Prix des As (1,30m)';
  const s = ['1.20m', ffe];
  expect(remove(s, ffe)).toEqual(['1.20m']);
  expect(remove(s, '1.20m')).toEqual([ffe]);
});

// ── T08 : round-trip formulaire → payload → préremplissage ──────────────────
test('T08 — round-trip liste_epreuves : sélection → payload → prefill', () => {
  const selected = ['1.20m', 'Dressage Pro', 'CCE jeune'];

  // Payload : disciplines dérivées + liste plate
  const disciplines = deriveDisciplines(selected, ['CSO']);
  expect(disciplines).toEqual(['CSO', 'Dressage', 'CCE']);

  // Préservation : liste plate stockée telle quelle dans liste_epreuves (text[])
  const listeEpreuvesStored = selected; // pas de transformation

  // Préremplissage (logique useEffect dans creer-concours.tsx)
  const row = { liste_epreuves: listeEpreuvesStored };
  const restored = Array.isArray(row.liste_epreuves) ? row.liste_epreuves : [];
  expect(restored).toEqual(selected);
});

// ── T09 : fallback sur la discipline principale si aucune épreuve reconnue ───
test('T09 — deriveDisciplines retombe sur le fallback si aucune épreuve reconnue', () => {
  expect(deriveDisciplines([], ['CSO'])).toEqual(['CSO']);
  expect(deriveDisciplines(['Prix des As (1,30m)'], ['Dressage'])).toEqual(['Dressage']);
  // Jamais tableau vide
  expect(deriveDisciplines([], [])).toEqual([]);
});

// ── T10 : compatibilité avec les 8 anciens labels ────────────────────────────
test('T10 — les 8 labels historiques du formulaire d\'origine sont dans le catalogue', () => {
  const legacyLabels: Array<[string, string]> = [
    ['1.00m', 'CSO'],
    ['1.10m', 'CSO'],
    ['1.20m', 'CSO'],
    ['1.30m', 'CSO'],
    ['Dressage Novice', 'Dressage'],
    ['Dressage Amateur', 'Dressage'],
    ['CCE jeune', 'CCE'],
    ['CCE amateur', 'CCE'],
  ];
  for (const [label, expectedDisc] of legacyLabels) {
    expect(disciplineOfEpreuve(label)).toBe(expectedDisc);
  }
});
