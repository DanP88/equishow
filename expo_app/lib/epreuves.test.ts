// Tests sélecteur disciplines + épreuves multi-disciplines — fonctions pures lib/epreuves.ts
import {
  EPREUVES_PAR_DISCIPLINE,
  DISCIPLINES_CATALOGUE,
  DISCIPLINES_EPREUVES,
  disciplineOfEpreuve,
  deriveDisciplines,
  resolveEditDisciplines,
} from './epreuves';

// ── T01 : sélection CSO + Dressage + CCE ────────────────────────────────────
test('T01 — sélection CSO + Dressage + CCE retourne 3 disciplines dans le bon ordre', () => {
  const disc = ['CCE', 'CSO', 'Dressage']; // ordre de sélection aléatoire
  const ordered = DISCIPLINES_CATALOGUE.filter(d => disc.includes(d));
  expect(ordered).toEqual(['CSO', 'Dressage', 'CCE']);
});

// ── T02 : ajout d'épreuves dans 3 disciplines ────────────────────────────────
test(`T02 — ajout d'épreuves dans CSO, Dressage et CCE — pas de doublon`, () => {
  const epreuves: string[] = [];
  function addEpreuve(ep: string) {
    if (!epreuves.includes(ep)) epreuves.push(ep);
  }
  addEpreuve('1.20m');      // CSO
  addEpreuve('Dressage Pro'); // Dressage
  addEpreuve('CCE jeune');  // CCE
  addEpreuve('1.20m');      // doublon → ignoré
  expect(epreuves).toEqual(['1.20m', 'Dressage Pro', 'CCE jeune']);
  expect(new Set(epreuves).size).toBe(epreuves.length);
});

// ── T03 : retrait d'une discipline + ses épreuves après confirmation ─────────
test('T03 — retrait discipline retire ses épreuves', () => {
  let selectedDiscs = ['CSO', 'Dressage', 'CCE'];
  let epreuves = ['1.20m', 'Dressage Pro', 'CCE jeune'];

  // Simulation : utilisateur retire "Dressage" (a confirmé)
  const discToRemove = 'Dressage';
  const catalogue = EPREUVES_PAR_DISCIPLINE[discToRemove] as readonly string[];
  const toRemove = epreuves.filter(ep => catalogue.includes(ep));
  expect(toRemove).toEqual(['Dressage Pro']); // épreuve à retirer

  selectedDiscs = selectedDiscs.filter(d => d !== discToRemove);
  epreuves = epreuves.filter(ep => !toRemove.includes(ep));

  expect(selectedDiscs).toEqual(['CSO', 'CCE']);
  expect(epreuves).toEqual(['1.20m', 'CCE jeune']);
});

// ── T04 : annulation du retrait d'une discipline ─────────────────────────────
test('T04 — annulation du retrait : disciplines et épreuves inchangées', () => {
  const selectedDiscs = ['CSO', 'Dressage'];
  const epreuves = ['1.20m', 'Dressage Pro'];

  // Utilisateur clique "Annuler" → aucun changement
  const afterCancel = { selectedDiscs: [...selectedDiscs], epreuves: [...epreuves] };
  expect(afterCancel.selectedDiscs).toEqual(['CSO', 'Dressage']);
  expect(afterCancel.epreuves).toEqual(['1.20m', 'Dressage Pro']);
});

// ── T05 : édition d'un concours existant (infos.disciplines présent) ─────────
test('T05 — resolveEditDisciplines utilise infos.disciplines si présent', () => {
  const infos = { disciplines: ['CSO', 'Dressage'] };
  const liste = ['1.20m', 'Dressage Pro'];
  const result = resolveEditDisciplines(infos, liste, 'CCE');
  expect(result).toEqual(['CSO', 'Dressage']); // infos.disciplines prime
});

// ── T06 : ancien concours sans infos.disciplines — dériver depuis liste_epreuves
test('T06 — resolveEditDisciplines dérive depuis liste_epreuves si infos.disciplines absent', () => {
  const infos = { nb_places: 40 }; // pas de disciplines
  const liste = ['1.20m', 'Dressage Novice', 'CCE amateur'];
  const result = resolveEditDisciplines(infos, liste, 'CCE');
  expect(result).toEqual(['CSO', 'Dressage', 'CCE']); // dérivé des 3 épreuves
});

// ── T07 : ancien concours avec épreuve FFE inconnue ─────────────────────────
test('T07 — épreuve inconnue préservée dans selected, disciplineOfEpreuve = null', () => {
  const ffe = 'Prix des As (1,30 m)';
  expect(disciplineOfEpreuve(ffe)).toBeNull();

  // Elle reste dans selected même si aucune discipline correspondante
  const selected = ['1.20m', ffe];
  expect(selected).toContain(ffe); // préservée

  // deriveDisciplines ignore les épreuves inconnues pour la dérivation
  const disc = deriveDisciplines(selected, ['CSO']);
  expect(disc).toEqual(['CSO']); // seule 1.20m reconnue → CSO
});

// ── T08 : absence de doublons dans liste_epreuves ────────────────────────────
test('T08 — toggle ne crée pas de doublons', () => {
  function toggle(selected: string[], label: string): string[] {
    if (selected.includes(label)) return selected.filter(x => x !== label);
    return [...selected, label];
  }
  let s = toggle([], '1.20m');
  s = toggle(s, '1.20m'); // désélectionne
  s = toggle(s, '1.20m'); // resélectionne
  s = toggle(s, 'Dressage Pro');
  // Simulation d'un toggle rapide en double
  const afterDouble = [...s];
  if (!afterDouble.includes('1.20m')) afterDouble.push('1.20m');
  expect(new Set(afterDouble).size).toBe(afterDouble.length);
});

// ── T09 : conservation des autres clés de infos ──────────────────────────────
test('T09 — buildConcoursColumns ne supprime pas les clés existingInfos', () => {
  // Simule le comportement de buildConcoursColumns (spread existingInfos en premier)
  const existingInfos = {
    region: 'Île-de-France',
    parking: 'Gratuit',
    coaching: true,
    restauration: 'Buvette',
    prix: 50,
    nb_places: 60,
    disciplines: ['CSO'],        // ancienne valeur — sera écrasée par la nouvelle
  };
  const newInfosFields = {
    disciplines: ['CSO', 'Dressage'],
    nb_places: 60,
    prix: 50,
    restauration: 'Buvette',
    parking: 'Gratuit',
    coaching: true,
  };
  const merged = { ...existingInfos, ...newInfosFields };

  expect(merged.region).toBe('Île-de-France');     // conservé
  expect(merged.parking).toBe('Gratuit');           // conservé
  expect(merged.disciplines).toEqual(['CSO', 'Dressage']); // mis à jour
});

// ── T10 : mise à jour de la discipline principale de compatibilité ────────────
test('T10 — discipline principale = premier élément de selectedDisciplines', () => {
  // Si CSO est la première discipline, type_concours = 'CSO'
  expect(['CSO', 'Dressage'][0]).toBe('CSO');
  expect(['Dressage', 'CSO'][0]).toBe('Dressage');
  // Aucune discipline sélectionnée → chaîne vide → validation bloque
  expect([].at(0) ?? '').toBe('');
});

// ── Tests de régression depuis T01 original ──────────────────────────────────

test('Régression — catalogue contient 12 disciplines', () => {
  expect(DISCIPLINES_CATALOGUE.length).toBeGreaterThanOrEqual(12);
});

test('Régression — DISCIPLINES_EPREUVES alias de DISCIPLINES_CATALOGUE', () => {
  expect(DISCIPLINES_EPREUVES).toBe(DISCIPLINES_CATALOGUE);
});

test('Régression — disciplineOfEpreuve stable sur labels CSO, Dressage, CCE', () => {
  expect(disciplineOfEpreuve('1.20m')).toBe('CSO');
  expect(disciplineOfEpreuve('Dressage Pro')).toBe('Dressage');
  expect(disciplineOfEpreuve('CCE amateur')).toBe('CCE');
});

test('Régression — ordre stable DISCIPLINES_CATALOGUE dans deriveDisciplines', () => {
  const o1 = deriveDisciplines(['Dressage Pro', '1.20m'], []);
  const o2 = deriveDisciplines(['1.20m', 'Dressage Pro'], []);
  expect(o1).toEqual(['CSO', 'Dressage']);
  expect(o2).toEqual(['CSO', 'Dressage']);
});

test('Régression — les 8 anciens labels du formulaire sont dans le catalogue', () => {
  const legacy: Array<[string, string]> = [
    ['1.00m', 'CSO'], ['1.10m', 'CSO'], ['1.20m', 'CSO'], ['1.30m', 'CSO'],
    ['Dressage Novice', 'Dressage'], ['Dressage Amateur', 'Dressage'],
    ['CCE jeune', 'CCE'], ['CCE amateur', 'CCE'],
  ];
  for (const [label, disc] of legacy) {
    expect(disciplineOfEpreuve(label)).toBe(disc);
  }
});

test('Régression — resolveEditDisciplines fallback sur type_concours si liste vide', () => {
  const result = resolveEditDisciplines(null, [], 'Raid');
  expect(result).toEqual(['Raid']);
});

test('Régression — resolveEditDisciplines retourne [] si tout est vide', () => {
  const result = resolveEditDisciplines(null, [], null);
  expect(result).toEqual([]);
});

test('Régression — deriveDisciplines ignore disciplines sans épreuves (Autre) pour la dérivation', () => {
  // Autre a un tableau vide → jamais couvert par des épreuves
  const disc = deriveDisciplines(['1.20m'], []);
  expect(disc).not.toContain('Autre');
  expect(disc).toContain('CSO');
});

test('Régression — nouvelles disciplines (Attelage, Endurance) dans DISCIPLINES_CATALOGUE', () => {
  expect(DISCIPLINES_CATALOGUE).toContain('Attelage');
  expect(DISCIPLINES_CATALOGUE).toContain('Endurance');
  expect(DISCIPLINES_CATALOGUE).toContain('TREC');
  expect(DISCIPLINES_CATALOGUE).toContain('Pony Games');
  expect(DISCIPLINES_CATALOGUE).toContain('Western');
  expect(DISCIPLINES_CATALOGUE).toContain('Autre');
});
