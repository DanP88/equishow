import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Résout en lot une liste d'UUID chevaux vers leur nom (078).
 * Calqué sur useUsersByIds. RLS chevaux : SELECT USING(true) → tout authentifié
 * (dont le vendeur d'une prestation) peut lire le nom d'un cheval d'acheteur.
 *
 * Usage :
 *   const chevauxById = useChevauxByIds([r.chevalId, ...]);
 *   const nom = r.chevalId ? chevauxById.get(r.chevalId) : null;
 */
export function useChevauxByIds(ids: (string | null | undefined)[]): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(new Map());

  const key = Array.from(new Set(ids.filter((x): x is string => !!x))).sort().join(',');

  useEffect(() => {
    if (!key) { setMap(new Map()); return; }
    let cancelled = false;
    const idArr = key.split(',');
    (async () => {
      const { data, error } = await supabase
        .from('chevaux')
        .select('id, nom')
        .in('id', idArr);
      if (cancelled || error || !data) return;
      const m = new Map<string, string>();
      for (const c of data as { id: string; nom: string }[]) m.set(c.id, c.nom);
      setMap(m);
    })();
    return () => { cancelled = true; };
  }, [key]);

  return map;
}
