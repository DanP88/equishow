// ─────────────────────────────────────────────────────────────────────────────
// useConcoursDiscussion — LOT 1 « Discussions concours » (Option C : 1 fil public).
//
// Backend : migration 082 (concours_messages + concours_thread_reads +
// fn_concours_thread_unread + RLS lecture publique / insert authentifié /
// soft delete auteur·org·admin + realtime).
//
// Hooks :
// - useConcoursThread(concoursId)      — résumé léger pour l'entrée fiche
//   ({ total, unread }) : compteur « Discussion (N) » + pastille non-lu.
// - useConcoursDiscussion(concoursId)  — fil complet (écran dédié) :
//   messages, send, softDelete, markRead, realtime.
//
// Identité affichée = pseudo + couleur + initiales (snapshot serveur). Jamais le
// nom complet ni le club/niveau (LOT 1).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface ConcoursMessage {
  id: string;
  concours_id: string;
  auteur_id: string;
  auteur_pseudo: string | null;
  auteur_initiales: string | null;
  auteur_couleur: string | null;
  auteur_role: string | null;
  contenu: string;
  topic: string | null;
  is_deleted: boolean;
  created_at: string;
}

const SELECT_COLS =
  'id,concours_id,auteur_id,auteur_pseudo,auteur_initiales,auteur_couleur,auteur_role,contenu,topic,is_deleted,created_at';

// ── Résumé léger pour l'entrée fiche : total messages + non-lus ──────────────
export function useConcoursThread(concoursId?: string) {
  const { profile } = useAuth();
  const me = profile?.id;
  const channelId = useId();
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!concoursId) return;
    // Total messages non supprimés (head count, lecture publique).
    const { count } = await supabase
      .from('concours_messages')
      .select('id', { count: 'exact', head: true })
      .eq('concours_id', concoursId)
      .eq('is_deleted', false);
    setTotal(count ?? 0);

    // Non-lus : fn SECURITY DEFINER (exclut soi + supprimés + ≤ last_read_at).
    if (me) {
      const { data } = await supabase.rpc('fn_concours_thread_unread', { p_concours_id: concoursId });
      setUnread(typeof data === 'number' ? data : 0);
    } else {
      setUnread(0);
    }
  }, [concoursId, me]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!concoursId) return;
    const ch = supabase
      .channel(`concours-thread-${concoursId}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'concours_messages', filter: `concours_id=eq.${concoursId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [concoursId, channelId, load]);

  return { total, unread, reload: load };
}

// ── Fil complet (écran dédié) ───────────────────────────────────────────────
export function useConcoursDiscussion(concoursId?: string) {
  const { profile } = useAuth();
  const me = profile?.id;
  const isAdmin = profile?.role === 'admin';
  const channelId = useId();
  const [messages, setMessages] = useState<ConcoursMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!concoursId) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('concours_messages')
      .select(SELECT_COLS)
      .eq('concours_id', concoursId)
      .order('created_at', { ascending: true });
    setMessages((data as ConcoursMessage[]) ?? []);
    setIsLoading(false);
  }, [concoursId]);

  useEffect(() => { load(); }, [load]);

  // Realtime : tout changement sur le fil de CE concours recharge.
  useEffect(() => {
    if (!concoursId) return;
    const ch = supabase
      .channel(`concours-discussion-${concoursId}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'concours_messages', filter: `concours_id=eq.${concoursId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [concoursId, channelId, load]);

  // Marque le fil comme lu (upsert own read). Appelé à l'ouverture de l'écran.
  const markRead = useCallback(async () => {
    if (!concoursId || !me) return;
    await supabase
      .from('concours_thread_reads')
      .upsert({ concours_id: concoursId, user_id: me, last_read_at: new Date().toISOString() }, { onConflict: 'concours_id,user_id' });
  }, [concoursId, me]);

  // Poste un message. auteur_* rempli serveur (trigger) ; on n'envoie que l'id.
  const send = useCallback(
    async (contenu: string, topic?: string | null) => {
      const text = contenu.trim();
      if (!concoursId || !me || !text) return { error: 'invalid' as const };
      setSending(true);
      const { error } = await supabase
        .from('concours_messages')
        .insert({ concours_id: concoursId, auteur_id: me, contenu: text, topic: topic ?? null });
      setSending(false);
      if (error) return { error: error.message };
      await load();
      await markRead();
      return { error: null };
    },
    [concoursId, me, load, markRead],
  );

  // Soft delete (RLS : auteur OU org propriétaire OU admin). On set is_deleted.
  const softDelete = useCallback(
    async (messageId: string) => {
      const { error } = await supabase
        .from('concours_messages')
        .update({ is_deleted: true })
        .eq('id', messageId);
      if (error) return { error: error.message };
      await load();
      return { error: null };
    },
    [load],
  );

  // Éligibilité d'affichage du bouton supprimer (l'autorité reste la RLS) :
  // auteur du message OU admin. (L'org propriétaire peut aussi supprimer côté
  // serveur, mais l'UI ne connaît pas l'ownership en LOT 1.)
  const canDelete = useCallback(
    (m: ConcoursMessage) => !m.is_deleted && !!me && (m.auteur_id === me || isAdmin),
    [me, isAdmin],
  );

  return { messages, isLoading, sending, send, softDelete, markRead, canDelete, me, canPost: !!me, reload: load };
}
