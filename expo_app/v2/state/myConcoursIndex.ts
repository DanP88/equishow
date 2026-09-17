// ─────────────────────────────────────────────────────────────────────────────
// v2/state/myConcoursIndex — PHASE 1B (correction) : liste GLOBALE des concours
// "J'y serai" / "Suivi" de l'utilisateur, Supabase comme SEULE source de vérité.
//
// Contrairement à v2/state/concoursParticipation.ts (une ligne par concours,
// montée quand on ouvre SA fiche), ce module répond à une question différente :
// « tous MES concours going/following », nécessaire pour l'Accueil ("prochain
// concours"), les filtres de l'onglet Concours, et tout ce qui utilisait
// followingIds/goingIds — SANS avoir déjà ouvert chaque fiche individuellement.
//
// Reconstruit à froid (auth ready → fetch) : 2 requêtes de lecture sur
// concours_presence (status='going') et concours_followers, filtrées sur
// l'utilisateur courant (RLS déjà en place, 089/075, non modifiées ici).
//
// invalidate() est appelé par concoursParticipation.ts après un setGoing/
// toggleFollow réussi, pour rester cohérent dans la même session sans attendre
// un rechargement complet de l'app.
//
// Ne touche NI Transport/Box/Coach métier, NI payments, NI escrow, NI RLS,
// NI V1 (lecture seule sur des tables déjà utilisées par des hooks V1 réels).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface IndexState {
  goingIds: string[];
  followingIds: string[];
  ready: boolean;
  userId: string | null;
}

let state: IndexState = { goingIds: [], followingIds: [], ready: false, userId: null };
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const getSnapshot = () => state;

async function fetchIndex(userId: string) {
  const [presRes, folRes] = await Promise.all([
    supabase.from('concours_presence').select('concours_id').eq('user_id', userId).eq('status', 'going'),
    supabase.from('concours_followers').select('concours_id').eq('user_id', userId),
  ]);
  state = {
    goingIds: presRes.error ? state.goingIds : (presRes.data ?? []).map((r: any) => r.concours_id as string),
    followingIds: folRes.error ? state.followingIds : (folRes.data ?? []).map((r: any) => r.concours_id as string),
    ready: true,
    userId,
  };
  emit();
}

/** Appelé après une mutation réussie (setGoing/toggleFollow) pour resynchroniser
 *  l'index global sans attendre un redémarrage de l'app. */
export function invalidateMyConcoursIndex() {
  if (state.userId) void fetchIndex(state.userId);
}

export function useMyConcoursIndex() {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!userId) {
      if (state.userId !== null) { state = { goingIds: [], followingIds: [], ready: true, userId: null }; emit(); }
      return;
    }
    if (state.userId !== userId) { state = { ...state, ready: false }; emit(); }
    void fetchIndex(userId);
  }, [userId]);

  const reload = useCallback(() => { if (userId) void fetchIndex(userId); }, [userId]);

  return {
    ready: s.ready && s.userId === userId,
    goingIds: s.userId === userId ? s.goingIds : [],
    followingIds: s.userId === userId ? s.followingIds : [],
    reload,
  };
}
