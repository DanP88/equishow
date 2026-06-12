// ─────────────────────────────────────────────────────────────────────────────
// Lot 3 — Funnel de conversion. Lecture seule des vues mig 071
// (v_funnel_overview + v_funnel_by_module), security_invoker → RLS admin.
// Le front filtre par module côté client depuis byModule (pas de refetch).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface FunnelStep {
  ord: number;
  step: string;
  volume: number;
  passage_rate: number | null;
  drop_off: number | null;
  payment_error_count: number;
}
export interface FunnelByModuleRow extends FunnelStep {
  module: string;
}

export function useFunnelAnalytics() {
  const [overview, setOverview] = useState<FunnelStep[]>([]);
  const [byModule, setByModule] = useState<FunnelByModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [ov, bm] = await Promise.all([
        supabase.from('v_funnel_overview').select('*').order('ord'),
        supabase.from('v_funnel_by_module').select('*').order('ord'),
      ]);
      if (ov.error) throw ov.error;
      if (bm.error) throw bm.error;
      setOverview((ov.data ?? []) as FunnelStep[]);
      setByModule((bm.data ?? []) as FunnelByModuleRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement funnel');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { overview, byModule, loading, error, refresh };
}
