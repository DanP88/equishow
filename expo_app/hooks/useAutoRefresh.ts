import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Recharge les données à chaque fois que l'écran (re)gagne le focus — y compris
 * au montage initial (le focus survient au montage dans un Stack expo-router).
 *
 * Pourquoi : le groupe `(tabs)` est un Stack ; les écrans quittés restent
 * montés en arrière-plan. Sans refetch au focus, en revenant sur un écran on
 * réaffiche les données du 1er fetch → l'utilisateur doit recharger la page
 * pour voir les infos à jour. Ce hook garantit des données fraîches à chaque
 * navigation, indépendamment du realtime (qui reste le complément live).
 *
 * Remplace le `useEffect(() => { load(); }, [load])` de montage.
 */
export function useAutoRefresh(load: () => void) {
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
}
