// ─────────────────────────────────────────────────────────────────────────────
// useOrgRadar — LOT Organisateur P0 (mig 076).
// Appelle la fonction SECURITY DEFINER `fn_org_concours_radar` qui renvoie des
// AGRÉGATS RÉELS (vues, followers, affluence, funnel) pour UN concours, après
// contrôle d'ownership (claim approuvé) côté serveur. Masquage RGPD < 5 inclus.
// Aucune donnée nominative n'est jamais exposée.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface OrgRadar {
  days: number;
  visibility: {
    views: number;
    views_prev: number;
    unique_visitors: number | null;
    unique_visitors_masked: boolean;
    ffe_clicks: number;
  };
  interest: {
    followers: number;
    followers_new: number;
    followers_masked: boolean;
  };
  engagement: {
    cavaliers_engaged: number | null;
    masked: boolean;
  };
  funnel: {
    views: number;
    followers: number;
    reservations: number;
    views_to_followers: number | null;
    followers_to_reservations: number | null;
    views_to_reservations: number | null;
  };
}

// ── Mode démonstration (LOCAL UNIQUEMENT) ────────────────────────────────────
// Permet de visualiser le rendu complet du Radar AVANT toute application DB
// (mig 076 non déployée). Données d'exemple réalistes, jamais affichées en prod
// sur un vrai concours : no-fake-KPI préservé (cf. déclenchement plus bas).
export const DEMO_CONCOURS_ID = 'demo';

const DEMO_RADAR: OrgRadar = {
  days: 30,
  visibility: {
    views: 247,
    views_prev: 180,
    unique_visitors: 96,
    unique_visitors_masked: false,
    ffe_clicks: 18,
  },
  interest: { followers: 38, followers_new: 12, followers_masked: false },
  engagement: { cavaliers_engaged: 7, masked: false },
  funnel: {
    views: 247,
    followers: 38,
    reservations: 7,
    views_to_followers: 38 / 247,
    followers_to_reservations: 7 / 38,
    views_to_reservations: 7 / 247,
  },
};

// La fonction/table 076 n'existe pas encore → la RPC renvoie une erreur
// « does not exist » (PGRST202 fonction absente, 42883, 42P01, PGRST205…).
const isMissingRpc = (msg: string) =>
  /does not exist|could not find|PGRST202|PGRST205|42883|42P01|schema cache/i.test(msg);

export function useOrgRadar(concoursId?: string, days = 30) {
  const [radar, setRadar] = useState<OrgRadar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const load = useCallback(async () => {
    if (!concoursId) { setRadar(null); setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);

    // Démo explicite (bouton « Voir un exemple », local seulement) → mock direct.
    if (concoursId === DEMO_CONCOURS_ID) {
      setRadar(DEMO_RADAR); setIsDemo(true); setIsLoading(false);
      return;
    }

    setIsDemo(false);
    const { data, error } = await supabase.rpc('fn_org_concours_radar', {
      p_concours_id: concoursId,
      p_days: days,
    });
    if (error) {
      // 42501 = not_authorized (pas propriétaire du concours) → toujours respecté.
      if (/not_authorized|42501/i.test(error.message)) {
        setError('not_authorized'); setRadar(null);
      } else if (__DEV__ && isMissingRpc(error.message)) {
        // DEV uniquement : 076 pas appliquée → fallback démo pour visualiser le rendu.
        // En prod (__DEV__=false) on ne fabrique JAMAIS de KPI : vraie erreur affichée.
        setRadar(DEMO_RADAR); setIsDemo(true);
      } else {
        setError(error.message); setRadar(null);
      }
    } else {
      setRadar(data as OrgRadar);
    }
    setIsLoading(false);
  }, [concoursId, days]);

  useEffect(() => { load(); }, [load]);
  return { radar, isLoading, error, isDemo, reload: load };
}
