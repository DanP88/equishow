// ─────────────────────────────────────────────────────────────────────────────
// v2/state/searchHorses — chevaux concernés par UNE recherche « Je cherche ».
//
// Indépendant par module (transport ≠ box ≠ coach). Seed, par priorité :
//   1. `chevalIds` transmis par le hub (?chevalIds=a,b)
//   2. horsesByNeed[module] du concours (Préparer mon concours)
//   3. selectedHorseIds du concours (Préparer mon concours)
//   4. sans concours : présélection SI un seul cheval, sinon AUCUN
//
// L'utilisateur peut toujours modifier. Si un concours est lié, `persist()`
// réécrit `horsesByNeed[module]` (cohérence avec Préparer). FRONT-ONLY.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react';
import { useV2AllHorses } from './contestHorses';
import { useConcoursLocal, type NeedModule } from './concoursLocal';

export function useSearchHorses(
  concoursId: string | undefined,
  module: NeedModule,
  chevalIdsParam?: string,
) {
  const pool = useV2AllHorses();
  const cl = useConcoursLocal(concoursId);

  const [ids, setIds] = useState<string[]>([]);
  const touched = useRef(false);

  // Route params changent → on réarme le seed.
  useEffect(() => {
    touched.current = false;
  }, [concoursId, chevalIdsParam]);

  // Seed (tant que l'utilisateur n'a pas édité).
  useEffect(() => {
    if (touched.current) return;
    if (!pool.ready || !cl.ready) return;

    const valid = (list: string[]) => list.filter((id) => pool.byId(id));
    const fromParam = (chevalIdsParam ?? '').split(',').map((x) => x.trim()).filter(Boolean);

    let next: string[] = [];
    if (fromParam.length) {
      next = valid(fromParam);
    } else if (concoursId) {
      const byNeed = valid(cl.entry.horsesByNeed?.[module] ?? []);
      next = byNeed.length ? byNeed : valid(cl.entry.selectedHorseIds ?? []);
    }
    // Sans concours : présélection SEULEMENT si le compte a un unique cheval.
    if (!next.length && !concoursId && pool.all.length === 1) next = [pool.all[0].id];

    setIds(next);
  }, [concoursId, chevalIdsParam, module, pool.ready, cl.ready]);

  const setUserIds = useCallback((v: string[]) => {
    touched.current = true;
    setIds(v);
  }, []);

  const persist = useCallback(() => {
    if (concoursId) cl.setModuleHorses(module, ids);
  }, [concoursId, module, ids, cl]);

  const horses = ids.map((id) => pool.byId(id)).filter(Boolean) as NonNullable<
    ReturnType<typeof pool.byId>
  >[];
  const names = horses.map((h) => h.nom);

  return {
    ready: pool.ready && cl.ready,
    ids,
    setIds: setUserIds,
    horses,
    names,
    count: ids.length,
    hasSelection: ids.length > 0,
    primaryId: ids[0],
    /** « Tornado P · Tomas » */
    label: names.join(' · '),
    isEmptyPool: pool.ready && pool.isEmpty,
    persist,
    /** ids sérialisés pour propager en param de route. */
    param: ids.join(','),
  };
}
