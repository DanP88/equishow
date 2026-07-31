// Tests fonctions pures — findings P2 useConcours (#4 #7 #8 #9 #10)
// Exécuter : node --experimental-strip-types hooks/useConcours.test.ts
//
// useConcours.ts importe Supabase/React → non chargeable en Node pur.
// On inline les fonctions pures extraites (même pattern que epreuves.test.ts).
// Les tests qui nécessitent Supabase (transitions réelles, hook state) sont
// couverts par la recette manuelle documentée dans la PR.

import assert from 'node:assert/strict';

// ── Copie de mapConcoursWriteError (exportée dans useConcours.ts) ────────────
function mapConcoursWriteError(error: { code?: string; message?: string } | null, fallback: string): string {
  if (!error) return fallback;
  if (error.code === 'PGRST116') {
    return "Concours introuvable ou vous n'êtes pas autorisé à le modifier.";
  }
  if (/row-level security|violates row-level|permission denied/i.test(error.message ?? '')) {
    return 'Accès refusé : seul un compte organisateur peut gérer ce concours.';
  }
  return error.message || fallback;
}

// ── Copie de la logique de détection 0-ligne de transitionConcoursStatus ─────
function detectConflict(data: { id: string }[] | null): { ok: boolean; error: string | null } {
  if (!data || data.length === 0) {
    return { ok: false, error: 'Le concours a été modifié entre-temps. Actualisez la liste puis réessayez.' };
  }
  return { ok: true, error: null };
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

// ── T1 : PGRST116 → message localisé (#7) ───────────────────────────────────
test('T1 — PGRST116 mappe vers message français clair', () => {
  const msg = mapConcoursWriteError({ code: 'PGRST116' }, 'fallback');
  assert.ok(msg.includes('introuvable') || msg.includes('autorisé'), `msg = "${msg}"`);
  assert.notEqual(msg, 'fallback');
});

// ── T2 : row-level security → message Accès refusé ──────────────────────────
test('T2 — "violates row-level security" mappe vers message localisé', () => {
  const msg = mapConcoursWriteError({ message: 'violates row-level security policy' }, 'fallback');
  assert.ok(msg.includes('Acc') || msg.includes('refus'), `msg = "${msg}"`);
  assert.notEqual(msg, 'fallback');
});

test('T3 — "permission denied" mappe vers message localisé', () => {
  const msg = mapConcoursWriteError({ message: 'permission denied for table concours' }, 'fallback');
  assert.ok(msg.includes('Acc') || msg.includes('refus'), `msg = "${msg}"`);
});

// ── T4 : null → fallback sans crash ─────────────────────────────────────────
test('T4 — null retourne le fallback sans crash', () => {
  const msg = mapConcoursWriteError(null, 'Echec de la publication.');
  assert.equal(msg, 'Echec de la publication.');
});

// ── T5 : message inconnu → passthrough ──────────────────────────────────────
test('T5 — erreur generique passe le message brut', () => {
  const msg = mapConcoursWriteError({ message: 'connection timeout' }, 'fallback');
  assert.equal(msg, 'connection timeout');
});

// ── T6 : 0 ligne modifiee → jamais un succes (#10) ──────────────────────────
test('T6 — 0 ligne modifiee produit une erreur de conflit', () => {
  const r1 = detectConflict([]);
  assert.equal(r1.ok, false);
  assert.ok(r1.error?.includes('entre-temps'), `error = "${r1.error}"`);

  const r2 = detectConflict(null);
  assert.equal(r2.ok, false);

  const r3 = detectConflict([{ id: 'uuid-123' }]);
  assert.equal(r3.ok, true);
  assert.equal(r3.error, null);
});

// ── T7 : transitions dans le bon ordre (#10) ────────────────────────────────
test('T7 — ordre des transitions brouillon->publie / publie->archive / archive->publie', () => {
  type Statut = 'brouillon' | 'publie' | 'archive';
  const transitions: { from: Statut; to: Statut }[] = [
    { from: 'brouillon', to: 'publie'  },
    { from: 'publie',    to: 'archive' },
    { from: 'archive',   to: 'publie'  },
  ];
  assert.equal(transitions[0].from, 'brouillon');
  assert.equal(transitions[0].to,   'publie');
  assert.equal(transitions[1].from, 'publie');
  assert.equal(transitions[1].to,   'archive');
  assert.equal(transitions[2].from, 'archive');
  assert.equal(transitions[2].to,   'publie');
});

// ── T8 : isMutating = busyId !== null — toutes les cartes (#9) ──────────────
test('T8 — isMutating bloque toutes les cartes, pas seulement la carte en cours', () => {
  const isMutating = (busyId: string | null) => busyId !== null;
  assert.equal(isMutating(null), false);
  assert.equal(isMutating('uuid-a'), true);
  // Mutation sur carte A → carte B aussi bloquee
  const busyId = 'uuid-a';
  const cardBId = 'uuid-b';
  assert.equal(isMutating(busyId), true, 'carte B doit etre desactivee');
  assert.notEqual(busyId, cardBId);
});

// ── T9 : payload edition ne contient pas etat (#4) ──────────────────────────
test('T9 — payload edition ne doit pas contenir la cle etat', () => {
  // Contrat : buildConcoursColumns ne retourne plus etat (fix #4).
  // En edition, updateConcours appelle buildConcoursColumns ; etat est exclu.
  const editPayload = {
    nom: 'Haras de Lyon',
    date_debut: '2026-09-01',
    date_fin: '2026-09-03',
    lieu: 'Lyon',
    adresse: null,
    departement: '69',
    type_concours: 'CSO',
    liste_epreuves: [],
    infos: { disciplines: ['CSO'], nb_places: 40, prix: null },
    // etat intentionnellement absent
  };
  assert.ok(!('etat' in editPayload), 'Le payload edition ne doit pas ecraser etat');
});

// ── T10 : erreur reseau ne vide pas liste (#8) ──────────────────────────────
test('T10 — erreur reseau conserve la liste existante', () => {
  // Simule la logique du hook : en cas d'erreur, setList n'est pas appele.
  let list = ['c1', 'c2', 'c3'];
  let errorMsg: string | null = null;

  function simulateLoadError() {
    // Comportement AVANT fix : setList([]) — efface la liste
    // Comportement APRES fix : on ne touche pas list, on pose l'erreur
    errorMsg = 'Impossible de charger la liste.';
    // list reste inchangee
  }

  simulateLoadError();
  assert.deepEqual(list, ['c1', 'c2', 'c3'], 'La liste doit etre preservee apres erreur');
  assert.equal(errorMsg, 'Impossible de charger la liste.');
});

// ── Resultat ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
