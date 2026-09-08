// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/concoursCoaches — « Coachs présents » sur un concours (G1).
//
// SOURCE DE VÉRITÉ (union, dédupliquée par users.id sinon par nom normalisé) :
//   1. annonces de coaching liées au concours  (coach_annonces.concours_id)  → auteur_id
//   2. réservations de coaching SIMULÉES V2 rattachées au concours           → coachUserId / nom
//   3. associations locales  Concours + Cheval + Coach  (v2:concours-cheval-coach)
//   (4. démo : MOCK_COACHES quand aucune session)
//
// FRONT-ONLY · lecture seule des annonces réelles · aucun RPC · 0 écriture.
// Un même coach n'apparaît qu'UNE fois même avec plusieurs chevaux / annonces.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCoachAnnonces } from '../../hooks/useCoachAnnonces';
import { useCoachLocal } from '../state/coachLocal';
import { useConcoursChevalCoach } from '../state/concoursChevalCoach';
import { MOCK_COACHES } from '../mocks/coach';

export interface PresentCoach {
  key: string;
  userId?: string;
  nom: string;
  initiales: string;
  couleur: string;
  note?: number;
  disciplines?: string;
  niveaux?: string;
  /** id de l'annonce de coaching de ce coach POUR CE concours, si elle existe. */
  annonceId?: string;
  sources: Array<'annonce' | 'reservation' | 'association' | 'demo'>;
}

const norm = (s?: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const initialsOf = (nom: string) =>
  nom.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

export function useConcoursCoaches(concoursId?: string) {
  const { isSignedIn } = useAuth();
  const { annonces } = useCoachAnnonces();
  const { bookings } = useCoachLocal();
  const { list: assocs } = useConcoursChevalCoach(concoursId);

  return useMemo(() => {
    const byKey = new Map<string, PresentCoach>();
    const keyFor = (userId?: string, nom?: string) => userId || `n:${norm(nom)}`;

    const merge = (partial: PresentCoach) => {
      const k = partial.key;
      const cur = byKey.get(k);
      if (!cur) { byKey.set(k, partial); return; }
      byKey.set(k, {
        ...cur,
        userId: cur.userId ?? partial.userId,
        note: cur.note ?? partial.note,
        disciplines: cur.disciplines ?? partial.disciplines,
        niveaux: cur.niveaux ?? partial.niveaux,
        annonceId: cur.annonceId ?? partial.annonceId,
        sources: [...new Set([...cur.sources, ...partial.sources])],
      });
    };

    if (concoursId) {
      // ── 1. annonces réelles rattachées au concours ─────────────────────────
      for (const a of annonces ?? []) {
        if (a.concoursId !== concoursId) continue;
        const key = keyFor(a.auteurId, a.auteurNom);
        merge({
          key,
          userId: a.auteurId || undefined,
          nom: a.auteurNom || 'Coach',
          initiales: a.auteurInitiales || initialsOf(a.auteurNom || 'Coach'),
          couleur: a.auteurCouleur || '#7C3AED',
          disciplines: a.discipline || undefined,
          niveaux: a.niveau || undefined,
          annonceId: a.id,
          sources: ['annonce'],
        });
      }

      // ── 2. réservations de coaching SIMULÉES V2 sur ce concours ────────────
      for (const b of bookings ?? []) {
        if (b.concoursId !== concoursId) continue;
        const uid = (b as any).coachUserId as string | undefined;
        const key = keyFor(uid, b.coach);
        merge({
          key,
          userId: uid,
          nom: b.coach || 'Coach',
          initiales: initialsOf(b.coach || 'Coach'),
          couleur: '#7C3AED',
          disciplines: b.discipline || undefined,
          niveaux: b.niveau || undefined,
          annonceId: (b as any).annonceId || undefined,
          sources: ['reservation'],
        });
      }

      // ── 3. associations locales Concours + Cheval + Coach ─────────────────
      for (const { assoc } of assocs) {
        const key = keyFor(assoc.coachUserId, assoc.coachNom);
        merge({
          key,
          userId: assoc.coachUserId,
          nom: assoc.coachNom,
          initiales: assoc.coachInitiales || initialsOf(assoc.coachNom),
          couleur: assoc.coachCouleur || '#7C3AED',
          annonceId: assoc.annonceId,
          sources: ['association'],
        });
      }
    }

    let coaches = [...byKey.values()];

    // ── 4. démo (aucune session) : coachs de démonstration du concours ───────
    // Les mocks ont tous concoursNom = 'Jumping de La Baule' → on ne les montre
    // que si la fiche affichée est bien ce concours (sinon 0 coach démo).
    const demo = !isSignedIn && coaches.length === 0;
    if (demo) {
      coaches = MOCK_COACHES.map((m) => ({
        key: `n:${norm(m.nom)}`,
        userId: m.nom,          // démo : /user-profile/<nom> (profil généré par la route)
        nom: m.nom,
        initiales: m.initiales,
        couleur: m.couleur,
        note: m.note,
        disciplines: m.disciplines,
        niveaux: m.niveaux,
        annonceId: m.id,        // démo : /(v2)/coach/detail?id=<m.id> (résout via MOCK_COACHES)
        sources: ['demo'] as PresentCoach['sources'],
      }));
    }

    // tri : ceux qui ont une annonce d'abord, puis alpha
    coaches.sort((a, b) => {
      const aa = a.annonceId ? 0 : 1;
      const bb = b.annonceId ? 0 : 1;
      return aa - bb || a.nom.localeCompare(b.nom);
    });

    return { coaches, count: coaches.length, demo };
  }, [concoursId, isSignedIn, annonces, bookings, assocs]);
}
