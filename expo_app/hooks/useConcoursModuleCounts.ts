// ─────────────────────────────────────────────────────────────────────────────
// useConcoursModuleCounts — comptes box / transport / coach par concours, en BATCH.
//
// La fiche utilise useConcoursCounts (3 requêtes pour UN concours). Pour la liste
// de découverte (~300 concours) on ne peut pas faire du N+1 → on charge en 3
// requêtes globales les annonces rattachées à un concours (concours_id non nul,
// dispo > 0 pour box/transport) et on agrège côté client en Map<concours_id, …>.
// Volume d'annonces faible → coût négligeable. Tolère l'absence de colonne/table.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ModuleCounts { box: number; transport: number; coach: number }
export type ModuleCountsMap = Record<string, ModuleCounts>;

function add(map: ModuleCountsMap, id: string | null, key: keyof ModuleCounts) {
  if (!id) return;
  (map[id] ??= { box: 0, transport: 0, coach: 0 })[key] += 1;
}

export function useConcoursModuleCounts() {
  const [counts, setCounts] = useState<ModuleCountsMap>({});
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const map: ModuleCountsMap = {};
    const [box, transport, coach] = await Promise.all([
      supabase.from('box_annonces').select('concours_id').not('concours_id', 'is', null).gt('nb_boxes_disponibles', 0),
      supabase.from('transport_annonces').select('concours_id').not('concours_id', 'is', null).gt('nb_places_disponibles', 0),
      supabase.from('coach_annonces').select('concours_id').not('concours_id', 'is', null),
    ]);
    (box.data ?? []).forEach((r: any) => add(map, r.concours_id, 'box'));
    (transport.data ?? []).forEach((r: any) => add(map, r.concours_id, 'transport'));
    (coach.data ?? []).forEach((r: any) => add(map, r.concours_id, 'coach'));
    setCounts(map);
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { counts, isLoading, reload: load };
}
