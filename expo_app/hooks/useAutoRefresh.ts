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
 *
 * Filet de sécurité (chargement à froid — diagnostiqué via logs live, pas
 * supposé) : une ligne écrite par UNE AUTRE session (ex. un offreur qui vient
 * de répondre à une recherche) peut ne pas être immédiatement visible en
 * lecture pour CETTE session qui vient tout juste d'établir sa connexion —
 * fenêtre observée jusqu'à ~5 s. `profile.id` et l'authentification sont
 * pourtant déjà corrects à ce moment-là (vérifié) : ce n'est pas un souci de
 * React qui ne recharge pas, la toute première requête revient simplement
 * courte. Le realtime ne rattrape PAS ce cas : il ne délivre que les
 * changements survenus APRÈS l'abonnement, jamais une ligne déjà écrite
 * avant que l'écran ne soit monté. Un second appel différé, une seule fois
 * au tout premier chargement de cet écran, rattrape cette fenêtre sans
 * imposer de polling permanent ni changer le comportement des focus suivants.
 */
export function useAutoRefresh(load: () => void, ttlMs = 15000) {
  const lastRun = useRef(0);
  const lastLoad = useRef<(() => void) | null>(null);
  const firstLoadDone = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const loadChanged = lastLoad.current !== load;
      if (!loadChanged && now - lastRun.current < ttlMs) return;
      lastLoad.current = load;
      lastRun.current = now;
      load();

      if (!firstLoadDone.current) {
        firstLoadDone.current = true;
        const retryTimer = setTimeout(load, 3000);
        return () => clearTimeout(retryTimer);
      }
    }, [load, ttlMs]),
  );
}
