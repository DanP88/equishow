import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Recharge les données quand l'écran (re)gagne le focus — MAIS pas plus souvent
 * que `ttlMs` (défaut 15 s) tant que `load` ne change pas d'identité.
 *
 * Pourquoi : le groupe `(tabs)` est un Stack ; les écrans quittés restent
 * montés. Sans garde, chaque aller-retour entre onglets relançait TOUS les
 * fetch de l'écran → lag + spinners qui clignotent. Ici :
 *  - 1er focus (montage) → chargement ;
 *  - re-focus < ttlMs avec le même `load` → SKIP (les données sont fraîches,
 *    le realtime couvre les changements live) ;
 *  - re-focus ≥ ttlMs → rechargement ;
 *  - `load` change d'identité (deps modifiées, ex. liste de chevaux) → TOUJOURS
 *    rechargement, quel que soit le délai.
 *
 * Remplace le `useEffect(() => { load(); }, [load])` de montage.
 */
export function useAutoRefresh(load: () => void, ttlMs = 15000) {
  const lastRun = useRef(0);
  const lastLoad = useRef<(() => void) | null>(null);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const loadChanged = lastLoad.current !== load;
      if (!loadChanged && now - lastRun.current < ttlMs) return;
      lastLoad.current = load;
      lastRun.current = now;
      load();
    }, [load, ttlMs]),
  );
}
