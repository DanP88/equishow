import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface UserPublicInfo {
  id: string;
  prenom: string;
  nom: string;
  pseudo: string;
  initiales: string;
  avatar_color: string;
  role: string;
}

/**
 * Résout en lot une liste d'UUID utilisateurs vers leurs infos publiques.
 * Remplace `getUserById` du mock pour les vrais utilisateurs Supabase.
 *
 * RLS users_public : tout authentifié peut lire les profils publics.
 *
 * Usage :
 *   const usersById = useUsersByIds([sellerId, buyerId, ...]);
 *   const u = usersById.get(someId); // u?.prenom, u?.nom, etc.
 */
export function useUsersByIds(ids: (string | null | undefined)[]): Map<string, UserPublicInfo> {
  const [map, setMap] = useState<Map<string, UserPublicInfo>>(new Map());

  const key = Array.from(new Set(ids.filter((x): x is string => !!x))).sort().join(',');

  useEffect(() => {
    if (!key) { setMap(new Map()); return; }
    let cancelled = false;
    const idArr = key.split(',');
    (async () => {
      const { data, error } = await supabase
        .from('users_public')
        .select('id, prenom, nom, pseudo, initiales, avatar_color, role')
        .in('id', idArr);
      if (cancelled || error || !data) return;
      const m = new Map<string, UserPublicInfo>();
      for (const u of data as UserPublicInfo[]) m.set(u.id, u);
      setMap(m);
    })();
    return () => { cancelled = true; };
  }, [key]);

  return map;
}
