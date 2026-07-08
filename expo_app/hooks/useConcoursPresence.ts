// ─────────────────────────────────────────────────────────────────────────────
// useConcoursPresence — présence concours (PR2a, mig 089).
//
// Présence DÉCLARÉE : un cavalier indique « J'y serai » sur un concours, avec un
// cheval optionnel. Toggle simple (insert/delete), upsert pour attacher le cheval.
//
// useConcoursKnownAttendees — hero « X personnes que vous connaissez » : appelle
// la RPC fn_concours_known_attendees (intersection présence × fn_people_i_know).
//
// Calqué sur useConcoursFollow (même robustesse : `available=false` si la table/
// RPC 089 n'est pas encore appliquée, pas de crash si déconnecté).
//
// Ne touche NI payments NI escrow NI Stripe.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

// 089 non appliquée : table/RPC absente (PostgREST PGRST205/PGRST202, PG 42P01/42883).
function isMissing(error: any): boolean {
  const code = error?.code ?? '';
  const msg = (error?.message ?? '').toLowerCase();
  return (
    code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || code === '42883' ||
    /could not find|does not exist|schema cache/.test(msg)
  );
}

export interface KnownAttendee {
  user_id: string;
  prenom: string | null;
  pseudo: string | null;
  initiales: string | null;
  avatar_color: string | null;
  role: string | null;
  relation: string | null;
  cheval_id: string | null;
  cheval_nom: string | null;
  status: string | null;
}

export function useConcoursPresence(concoursId?: string) {
  const { profile } = useAuth();
  const userId = profile?.id;

  const [present, setPresent] = useState(false);
  const [chevalId, setChevalId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!concoursId || !userId) { setIsReady(true); return; }
    const { data, error } = await supabase
      .from('concours_presence')
      .select('cheval_id, status')
      .eq('concours_id', concoursId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      if (isMissing(error)) setAvailable(false);
      setPresent(false);
      setChevalId(null);
    } else {
      setPresent(!!data);
      setChevalId(data?.cheval_id ?? null);
    }
    setIsReady(true);
  }, [concoursId, userId]);

  useEffect(() => { load(); }, [load]);

  // Déclare (ou met à jour le cheval de) ma présence. Upsert own.
  const declare = useCallback(async (cheval: string | null = null) => {
    if (!concoursId || !userId) return;
    setBusy(true);
    setPresent(true);             // optimiste
    setChevalId(cheval);
    const { error } = await supabase
      .from('concours_presence')
      .upsert(
        { concours_id: concoursId, user_id: userId, status: 'going', cheval_id: cheval, source: 'declared' },
        { onConflict: 'concours_id,user_id' },
      );
    if (error) {
      if (isMissing(error)) setAvailable(false);
      await load();               // resync sur erreur
    }
    setBusy(false);
  }, [concoursId, userId, load]);

  const remove = useCallback(async () => {
    if (!concoursId || !userId) return;
    setBusy(true);
    setPresent(false);            // optimiste
    setChevalId(null);
    const { error } = await supabase
      .from('concours_presence')
      .delete()
      .eq('concours_id', concoursId)
      .eq('user_id', userId);
    if (error) { await load(); }
    setBusy(false);
  }, [concoursId, userId, load]);

  const toggle = useCallback(async () => {
    if (present) await remove();
    else await declare(chevalId);
  }, [present, remove, declare, chevalId]);

  return {
    present,
    chevalId,
    isReady,
    available,
    busy,
    canDeclare: !!userId && !!concoursId,
    declare,
    remove,
    toggle,
  };
}

// ── Compteurs de présence (fiche) ───────────────────────────────────────────
// participants = présents (status='going') ; horses = présents ayant renseigné
// un cheval. Deux `count head` (pas de rows ramenées) → léger. Filtre concours_id
// = préfixe de la PK (concours_id, user_id) → indexé. Anti cold-start géré côté UI.
export function useConcoursPresenceSummary(concoursId?: string) {
  const [participants, setParticipants] = useState(0);
  const [horses, setHorses] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [available, setAvailable] = useState(true);

  const load = useCallback(async () => {
    if (!concoursId) { setIsReady(true); return; }
    const base = () => supabase
      .from('concours_presence')
      .select('*', { count: 'exact', head: true })
      .eq('concours_id', concoursId)
      .eq('status', 'going');
    const [pRes, hRes] = await Promise.all([
      base(),
      base().not('cheval_id', 'is', null),
    ]);
    if (pRes.error) {
      if (isMissing(pRes.error)) setAvailable(false);
      setParticipants(0); setHorses(0);
    } else {
      setParticipants(pRes.count ?? 0);
      setHorses(hRes.error ? 0 : (hRes.count ?? 0));
    }
    setIsReady(true);
  }, [concoursId]);

  useEffect(() => { load(); }, [load]);

  return { participants, horses, isReady, available, reload: load };
}

// ── Tous les participants (écran « Tous les participants ») ──────────────────
// Lignes brutes (user_id, cheval_id) des présents. La résolution nom cavalier
// (useUsersByIds) et nom cheval (useChevauxByIds) se fait dans l'écran (hooks
// top-level). Paresseux : ne requête que si `enabled` (ouverture de l'écran).
export interface AttendeeRow { user_id: string; cheval_id: string | null }

export function useConcoursAttendees(concoursId?: string, enabled: boolean = true) {
  const [rows, setRows] = useState<AttendeeRow[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [available, setAvailable] = useState(true);

  const load = useCallback(async () => {
    if (!concoursId || !enabled) { setRows([]); setIsReady(!enabled ? false : true); return; }
    const { data, error } = await supabase
      .from('concours_presence')
      .select('user_id, cheval_id')
      .eq('concours_id', concoursId)
      .eq('status', 'going');
    if (error) {
      if (isMissing(error)) setAvailable(false);
      setRows([]);
    } else {
      setRows((data ?? []) as AttendeeRow[]);
    }
    setIsReady(true);
  }, [concoursId, enabled]);

  useEffect(() => { load(); }, [load]);

  return { rows, isReady, available, reload: load };
}

export function useConcoursKnownAttendees(concoursId?: string) {
  const { profile } = useAuth();
  const userId = profile?.id;

  const [attendees, setAttendees] = useState<KnownAttendee[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [available, setAvailable] = useState(true);

  const load = useCallback(async () => {
    if (!concoursId || !userId) { setAttendees([]); setIsReady(true); return; }
    const { data, error } = await supabase.rpc('fn_concours_known_attendees', {
      p_concours_id: concoursId,
      viewer: userId,
    });
    if (error) {
      if (isMissing(error)) setAvailable(false);
      setAttendees([]);
    } else {
      setAttendees((data ?? []) as KnownAttendee[]);
    }
    setIsReady(true);
  }, [concoursId, userId]);

  useEffect(() => { load(); }, [load]);

  return { attendees, count: attendees.length, isReady, available, reload: load };
}
