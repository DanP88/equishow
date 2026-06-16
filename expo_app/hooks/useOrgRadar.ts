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

export function useOrgRadar(concoursId?: string, days = 30) {
  const [radar, setRadar] = useState<OrgRadar | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!concoursId) { setRadar(null); setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('fn_org_concours_radar', {
      p_concours_id: concoursId,
      p_days: days,
    });
    if (error) {
      // 42501 = not_authorized (pas propriétaire du concours)
      setError(/not_authorized|42501/i.test(error.message) ? 'not_authorized' : error.message);
      setRadar(null);
    } else {
      setRadar(data as OrgRadar);
    }
    setIsLoading(false);
  }, [concoursId, days]);

  useEffect(() => { load(); }, [load]);
  return { radar, isLoading, error, reload: load };
}
