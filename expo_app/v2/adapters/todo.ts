// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/todo — « À traiter » de l'Accueil (F12).
//
// Agrège en LECTURE SEULE ce qui appelle une action, à partir de ce que la V2
// connaît déjà : demandes de coaching reçues, concours en brouillon, concours
// « J'y serai » à préparer. Repli démo (MOCK_ACTIONS) UNIQUEMENT quand aucune
// session (réelle ou simulée) n'est active.
//
// Anti-flash : tant que la session OU l'état local « Mon concours » n'est pas
// hydraté, on ne renvoie RIEN (ni réel, ni démo) — sinon on afficherait des
// entrées démo 2 s puis on les retirerait à l'hydratation.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useV2Session } from '../auth';
import { useConcoursList } from '../../hooks/useConcours';
import { useCapabilities } from '../capabilities';
import { useConcoursLocal, getConcoursEntry, prepScore } from '../state/concoursLocal';
import { useV2CoachDemands } from './coach';
import { useV2OrgSpace } from './org';
import { MOCK_ACTIONS } from '../mocks/f2';

export interface V2TodoItem { id: string; icon: string; label: string; target: string }

export function useV2Todo(): { items: V2TodoItem[]; demo: boolean; ready: boolean } {
  const session = useV2Session();
  const caps = useCapabilities();
  const cl = useConcoursLocal();
  const { concours } = useConcoursList();
  const kDemands = useV2CoachDemands();
  const org = useV2OrgSpace();

  return useMemo(() => {
    // Rien tant que les sources locales ne sont pas prêtes → évite le
    // clignotement « plusieurs entrées démo puis une seule ».
    if (!session.ready || !cl.ready) return { items: [], demo: false, ready: false };

    const items: V2TodoItem[] = [];

    // Coach : demandes de coaching reçues (réelles).
    if (caps.has('coach') && !kDemands.demo && kDemands.demands.length > 0) {
      const n = kDemands.demands.length;
      items.push({ id: 'coach-demands', icon: 'account-clock-outline', label: `${n} demande${n > 1 ? 's' : ''} de coaching reçue${n > 1 ? 's' : ''}`, target: '/(v2)/coach?face=eleves' });
    }

    // Organisateur : concours en brouillon à publier.
    if (caps.has('organisateur') && !org.demo && org.counts.brouillon > 0) {
      items.push({ id: 'org-drafts', icon: 'file-document-edit-outline', label: `${org.counts.brouillon} concours en brouillon à publier`, target: '/(v2)/organisateur' });
    }

    // Cavalier : concours « J'y serai » dont la préparation est incomplète.
    for (const id of cl.goingIds.slice(0, 3)) {
      const c = concours.find((x) => x.id === id);
      if (c && prepScore(getConcoursEntry(id)) < 5) {
        items.push({ id: `prep-${id}`, icon: 'clipboard-check-outline', label: `Préparer « ${c.nom} »`, target: `/(v2)/concours/${id}/preparer` });
      }
    }

    if (items.length > 0) return { items, demo: false, ready: true };

    // Démo : seulement en navigation SANS session (ni réelle ni simulée).
    if (!session.isSignedIn) {
      return {
        items: MOCK_ACTIONS.filter((a) => caps.has(a.cap)).map((a) => ({ id: a.id, icon: a.icon, label: a.label, target: a.target })),
        demo: true,
        ready: true,
      };
    }
    return { items: [], demo: false, ready: true };
  }, [session.ready, session.isSignedIn, caps, cl.ready, cl.goingIds, concours, kDemands, org]);
}
