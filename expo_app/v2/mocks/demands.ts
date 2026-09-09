// ─────────────────────────────────────────────────────────────────────────────
// v2/mocks/demands — DEMANDES EN COURS (cavaliers cherchant transport / box /
// coach pour un concours). SIMULATION FRONT-ONLY.
//
// Le ticket veut : « 3 cavaliers cherchent actuellement un transport vers ce
// concours », visible par ceux qui proposent. Ça demande une table partagée
// (Phase 2). En attendant, on affiche un jeu d'exemples PAR CONCOURS + les
// recherches que l'utilisateur a lui-même publiées (state `v2:*` local).
//
// Ces exemples s'affichent pour TOUT LE MONDE (connecté ou non) — c'est le but :
// montrer à quoi ressemble « la demande des autres ».
// ─────────────────────────────────────────────────────────────────────────────

export interface DemoDemand {
  id: string;
  nom: string;
  initiales: string;
  cheval?: string;
  detail: string;       // « depuis Poitiers (86) » · « 3 nuits » · « CSO Amateur »
}

interface ConcoursDemands {
  transport: DemoDemand[];
  box: DemoDemand[];
  coach: DemoDemand[];
}

/** Clé = id du concours. Concours absent → aucune demande d'exemple. */
export const DEMO_CONCOURS_DEMANDS: Record<string, ConcoursDemands> = {
  // Jumping de La Baule (12-14 sept 2026)
  'ce500000-0000-0000-0000-0000000000a3': {
    transport: [
      { id: 'dd-t1', nom: 'Camille Roux',   initiales: 'CR', cheval: 'Isis',   detail: 'depuis Poitiers (86) · 1 cheval · aller-retour' },
      { id: 'dd-t2', nom: 'Léa Fontaine',   initiales: 'LF', cheval: 'Django', detail: 'depuis Le Mans (72) · 1 cheval · aller le 12' },
      { id: 'dd-t3', nom: 'Hugo Bertrand',  initiales: 'HB', cheval: 'Maya',   detail: 'depuis Cholet (49) · 2 chevaux · flexible' },
    ],
    box: [
      { id: 'dd-b1', nom: 'Camille Roux',   initiales: 'CR', cheval: 'Isis',   detail: '2 boxes · 11 → 15 sept · litière copeaux' },
      { id: 'dd-b2', nom: 'Marie Lemoine',  initiales: 'ML', cheval: 'Utah',   detail: '1 box · 12 → 14 sept' },
    ],
    coach: [
      { id: 'dd-c1', nom: 'Léa Fontaine',   initiales: 'LF', cheval: 'Django', detail: 'CSO · Amateur · 1 séance le samedi' },
    ],
  },
  // HARAS PARTOUCHE test (18-26 oct 2026)
  '47405410-6198-4fff-aafb-01af24e37bc9': {
    transport: [
      { id: 'dd-t9', nom: 'Nina Petit',     initiales: 'NP', cheval: 'Ficelle', detail: 'depuis Tours (37) · 1 cheval' },
    ],
    box: [],
    coach: [],
  },
};

export function demoDemandsFor(concoursId?: string): ConcoursDemands {
  return (concoursId && DEMO_CONCOURS_DEMANDS[concoursId]) || { transport: [], box: [], coach: [] };
}
