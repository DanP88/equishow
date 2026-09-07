// ─────────────────────────────────────────────────────────────────────────────
// v2/adapters/todo — « À traiter » de l'Accueil (F12).
//
// Agrège en LECTURE SEULE ce qui appelle une action, à partir de ce que la V2
// connaît déjà : demandes de coaching reçues, concours en brouillon, concours
// « J'y serai » à préparer. Repli démo (MOCK_ACTIONS) si non connecté.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useConcoursList } from '../../hooks/useConcours';
import { useCapabilities } from '../capabilities';
import { useConcoursLocal, getConcoursEntry, prepScore } from '../state/concoursLocal';
import { useV2CoachDemands } from './coach';
import { useV2OrgSpace } from './org';
import { MOCK_ACTIONS } from '../mocks/f2';

export interface V2TodoItem { id: string; icon: string; label: string; target: string }

export function useV2Todo(): { items: V2TodoItem[]; demo: boolean } {
  const { isSignedIn } = useAuth();
  const caps = useCapabilities();
  const cl = useConcoursLocal();
  const { concours } = useConcoursList();
  const kDemands = useV2CoachDemands();
  const org = useV2OrgSpace();

  return useMemo(() => {
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

    if (items.length > 0) return { items, demo: false };

    if (!isSignedIn) {
      return {
        items: MOCK_ACTIONS.filter((a) => caps.has(a.cap)).map((a) => ({ id: a.id, icon: a.icon, label: a.label, target: a.target })),
        demo: true,
      };
    }
    return { items: [], demo: false };
  }, [isSignedIn, caps, cl.goingIds, concours, kDemands, org]);
}
