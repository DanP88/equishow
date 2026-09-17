// ─────────────────────────────────────────────────────────────────────────────
// v2/state/concoursParticipation — PHASE 1B : pont V2 → vraies tables Supabase
// pour le noyau « participation » (mig 110 + hooks V1 existants).
//
// Réutilise TEL QUEL (aucune modification V1) :
//   - useConcoursPresence (hooks/useConcoursPresence.ts) → going + cheval_id
//     singulier (compat V1 : PresenceButton / ConcoursPresenceModule).
//   - useConcoursFollow (hooks/useConcours.ts) → suivre / désuivre.
//
// Ajoute (V2 uniquement, colonnes/table posées par la migration 110, pas
// couvertes par les hooks V1 ci-dessus car elles n'existaient pas encore) :
//   - concours_presence.epreuves / transport_skip / box_skip / coach_skip
//   - concours_presence_chevaux (multi-cheval)
//
// COMPATIBILITÉ V1 — règle adoptée (documentée ici, pas ailleurs) :
//   `concours_presence.cheval_id` (singulier, 089) N'EST PLUS écrit
//   indépendamment par V2. Il devient un MIROIR dérivé du premier cheval
//   (par ordre d'ajout) de `concours_presence_chevaux`, recalculé et
//   ré-écrit via `useConcoursPresence.declare()` (le mécanisme V1 existant,
//   pas un second chemin d'écriture) à chaque changement de la sélection
//   multi-cheval V2. Une seule source de vérité pour le multi-cheval
//   (concours_presence_chevaux) ; cheval_id reste lisible par V1 sans jamais
//   diverger de « le 1ᵉʳ cheval que V2 a sélectionné ».
//
// Ne touche NI Transport/Box/Coach métier, NI payments, NI escrow, NI RLS.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useConcoursPresence } from '../../hooks/useConcoursPresence';
import { useConcoursFollow } from '../../hooks/useConcours';
import { invalidateMyConcoursIndex } from './myConcoursIndex';

export type SkipModule = 'transport' | 'box' | 'coach';
const SKIP_COLUMN: Record<SkipModule, 'transport_skip' | 'box_skip' | 'coach_skip'> = {
  transport: 'transport_skip', box: 'box_skip', coach: 'coach_skip',
};

// Même repli que useConcoursPresence/useConcoursFollow (V1) : table/colonne
// pas encore appliquée → dégrade proprement, ne casse jamais l'UI.
function isMissing(error: any): boolean {
  const code = error?.code ?? '';
  const msg = (error?.message ?? '').toLowerCase();
  return (
    code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || code === '42883' ||
    /could not find|does not exist|schema cache/.test(msg)
  );
}

export function useConcoursParticipation(concoursId?: string) {
  const { profile } = useAuth();
  const userId = profile?.id;

  // Réutilisation directe des hooks V1 — aucune logique dupliquée.
  const presence = useConcoursPresence(concoursId); // going + cheval_id singulier (compat V1)
  const follow = useConcoursFollow(concoursId);      // suivre / désuivre

  const [epreuves, setEpreuvesState] = useState<string[]>([]);
  const [transportSkip, setTransportSkipState] = useState(false);
  const [boxSkip, setBoxSkipState] = useState(false);
  const [coachSkip, setCoachSkipState] = useState(false);
  const [horseIds, setHorseIdsState] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(true);

  const load = useCallback(async () => {
    if (!concoursId || !userId) { setReady(true); return; }
    const [presRes, chevRes] = await Promise.all([
      supabase.from('concours_presence')
        .select('epreuves, transport_skip, box_skip, coach_skip')
        .eq('concours_id', concoursId).eq('user_id', userId).maybeSingle(),
      supabase.from('concours_presence_chevaux')
        .select('cheval_id')
        .eq('concours_id', concoursId).eq('user_id', userId)
        .order('created_at', { ascending: true }),
    ]);
    if (presRes.error) {
      if (isMissing(presRes.error)) setAvailable(false);
    } else {
      setEpreuvesState(presRes.data?.epreuves ?? []);
      setTransportSkipState(!!presRes.data?.transport_skip);
      setBoxSkipState(!!presRes.data?.box_skip);
      setCoachSkipState(!!presRes.data?.coach_skip);
    }
    if (chevRes.error) {
      if (isMissing(chevRes.error)) setAvailable(false);
    } else {
      setHorseIdsState((chevRes.data ?? []).map((r: any) => r.cheval_id as string));
    }
    setReady(true);
  }, [concoursId, userId]);

  useEffect(() => { load(); }, [load]);
  // La suppression de "J'y serai" (presence.remove) cascade côté serveur sur
  // concours_presence_chevaux (FK composite ON DELETE CASCADE, mig 110) —
  // on relit pour refléter le vidage local.
  useEffect(() => { if (presence.isReady) load(); }, [presence.present]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── "J'y serai" (explicite, pas un toggle — reprend la sémantique V1) ──────
  // Invalide l'index global (goingIds) après succès : Accueil/filtres Concours
  // restent cohérents dans la session sans attendre un redémarrage complet.
  const setGoing = useCallback(async (going: boolean) => {
    if (going) await presence.declare(presence.chevalId);
    else await presence.remove();
    invalidateMyConcoursIndex();
  }, [presence.declare, presence.remove, presence.chevalId]);

  // ── "Suivre" (idem : invalide followingIds après succès) ───────────────────
  const toggleFollow = useCallback(async () => {
    await follow.toggle();
    invalidateMyConcoursIndex();
  }, [follow.toggle]);

  // ── Épreuves ────────────────────────────────────────────────────────────────
  const setEpreuves = useCallback(async (list: string[]) => {
    if (!concoursId || !userId) return;
    setEpreuvesState(list); // optimiste
    const { error } = await supabase
      .from('concours_presence')
      .update({ epreuves: list })
      .eq('concours_id', concoursId).eq('user_id', userId);
    if (error) await load();
  }, [concoursId, userId, load]);

  // ── "Pas nécessaire" (transport_skip / box_skip / coach_skip UNIQUEMENT — ──
  // jamais un statut de réservation réel, cf. migration 110). ─────────────────
  const setSkip = useCallback(async (m: SkipModule, value: boolean) => {
    if (!concoursId || !userId) return;
    if (m === 'transport') setTransportSkipState(value);
    else if (m === 'box') setBoxSkipState(value);
    else setCoachSkipState(value);
    const { error } = await supabase
      .from('concours_presence')
      .update({ [SKIP_COLUMN[m]]: value })
      .eq('concours_id', concoursId).eq('user_id', userId);
    if (error) await load();
  }, [concoursId, userId, load]);

  // ── Chevaux multi (concours_presence_chevaux — source V2) ───────────────────
  const addHorse = useCallback(async (chevalId: string) => {
    if (!concoursId || !userId) return;
    setHorseIdsState((cur) => (cur.includes(chevalId) ? cur : [...cur, chevalId])); // optimiste
    const { error } = await supabase
      .from('concours_presence_chevaux')
      .insert({ concours_id: concoursId, user_id: userId, cheval_id: chevalId });
    if (error && !/duplicate key|already exists/i.test(error.message ?? '')) { await load(); return; }
    // Mirror V1 : le 1ᵉʳ cheval par ordre d'ajout devient cheval_id singulier.
    // Premier ajout (liste vide avant) → ce cheval devient le mirror ; sinon
    // le mirror existant (horseIds[0]) ne change pas.
    const newFirst = horseIds.length === 0 ? chevalId : horseIds[0];
    await presence.declare(newFirst);
  }, [concoursId, userId, load, presence, horseIds]);

  const removeHorse = useCallback(async (chevalId: string) => {
    if (!concoursId || !userId) return;
    const next = horseIds.filter((x) => x !== chevalId);
    setHorseIdsState(next); // optimiste
    const { error } = await supabase
      .from('concours_presence_chevaux')
      .delete()
      .eq('concours_id', concoursId).eq('user_id', userId).eq('cheval_id', chevalId);
    if (error) { await load(); return; }
    // Mirror V1 : recalcule le 1ᵉʳ cheval restant (ou null).
    await presence.declare(next[0] ?? null);
  }, [concoursId, userId, load, presence, horseIds]);

  // Remplace la sélection complète (utilisé par « Cheval » dans Préparer mon
  // concours, qui manipule une liste, pas des ajouts/retraits unitaires).
  const setHorseIds = useCallback(async (ids: string[]) => {
    const next = [...new Set(ids)];
    const toAdd = next.filter((id) => !horseIds.includes(id));
    const toRemove = horseIds.filter((id) => !next.includes(id));
    for (const id of toRemove) await removeHorse(id);
    for (const id of toAdd) await addHorse(id);
  }, [horseIds, addHorse, removeHorse]);

  return {
    ready: ready && presence.isReady && follow.isReady,
    available: available && presence.available && follow.available,
    going: presence.present,
    setGoing,
    following: follow.isFollowing,
    toggleFollow,
    horseIds,
    addHorse,
    removeHorse,
    setHorseIds,
    epreuves,
    setEpreuves,
    transportSkip, boxSkip, coachSkip,
    setSkip,
  };
}
