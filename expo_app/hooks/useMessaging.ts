// ─────────────────────────────────────────────────────────────────────────────
// useMessaging — messagerie persistée (Supabase) : conversations + messages.
// Remplace l'ancien messagesStore in-memory. Realtime + non-lus via
// conversation_reads (last_read_at par user).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useAutoRefresh } from './useAutoRefresh';

export interface ChatMessage {
  id: string;
  senderId: string;
  contenu: string;
  createdAt: Date;
}

export interface ConversationView {
  id: string;
  otherId: string;
  otherNom: string;
  otherPseudo: string;
  otherCouleur: string;
  otherInitiales: string;
  sujet: string;
  annonce?: string;
  annonceType?: string;
  dernierMsg: string;
  lastMessageAt: Date | null;
  unread: boolean;
}

interface ConvRow {
  id: string;
  participant_a: string;
  participant_b: string;
  a_nom: string | null; a_pseudo: string | null; a_couleur: string | null; a_initiales: string | null;
  b_nom: string | null; b_pseudo: string | null; b_couleur: string | null; b_initiales: string | null;
  sujet: string | null;
  annonce: string | null;
  annonce_type: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

function rowToView(r: ConvRow, myId: string, lastReadAt: string | null): ConversationView {
  const iAmA = r.participant_a === myId;
  const otherId = iAmA ? r.participant_b : r.participant_a;
  const oNom = iAmA ? r.b_nom : r.a_nom;
  const oPseudo = iAmA ? r.b_pseudo : r.a_pseudo;
  const oCouleur = iAmA ? r.b_couleur : r.a_couleur;
  const oInit = iAmA ? r.b_initiales : r.a_initiales;
  const lastAt = r.last_message_at ? new Date(r.last_message_at) : null;
  const unread = !!lastAt && (!lastReadAt || lastAt > new Date(lastReadAt));
  return {
    id: r.id,
    otherId,
    otherNom: oNom ?? '',
    otherPseudo: oPseudo ?? '',
    otherCouleur: oCouleur ?? '#7C3AED',
    otherInitiales: oInit ?? (oNom ?? '?').slice(0, 2).toUpperCase(),
    sujet: r.sujet ?? '💬 Discussion',
    annonce: r.annonce ?? undefined,
    annonceType: r.annonce_type ?? undefined,
    dernierMsg: r.last_message ?? '',
    lastMessageAt: lastAt,
    unread,
  };
}

// ── Liste de mes conversations ───────────────────────────────────────────────
export function useConversations() {
  const { profile } = useAuth();
  const me = profile?.id;
  const channelId = useId();
  const [list, setList] = useState<ConversationView[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!me) { setList([]); return; }
    setIsLoading(true);
    const [{ data: convs }, { data: reads }] = await Promise.all([
      supabase.from('conversations').select('*')
        .or(`participant_a.eq.${me},participant_b.eq.${me}`)
        .order('last_message_at', { ascending: false, nullsFirst: false }),
      supabase.from('conversation_reads').select('conversation_id,last_read_at').eq('user_id', me),
    ]);
    const readMap: Record<string, string> = {};
    (reads ?? []).forEach((r: any) => { readMap[r.conversation_id] = r.last_read_at; });
    setList(((convs ?? []) as ConvRow[]).map((c) => rowToView(c, me, readMap[c.id] ?? null)));
    setIsLoading(false);
  }, [me]);

  useAutoRefresh(load);

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`conversations-${me}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, load, channelId]);

  const unreadTotal = list.filter((c) => c.unread).length;
  return { conversations: list, isLoading, reload: load, unreadTotal };
}

// ── Messages d'une conversation + envoi + lecture ────────────────────────────
export function useConversationMessages(conversationId?: string) {
  const { profile } = useAuth();
  const me = profile?.id;
  const channelId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!conversationId) { setMessages([]); return; }
    setIsLoading(true);
    const { data } = await supabase
      .from('messages').select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages(((data ?? []) as any[]).map((m) => ({
      id: m.id, senderId: m.sender_id, contenu: m.contenu, createdAt: new Date(m.created_at),
    })));
    setIsLoading(false);
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`messages-${conversationId}-${channelId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m: any = payload.new;
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev
            : [...prev, { id: m.id, senderId: m.sender_id, contenu: m.contenu, createdAt: new Date(m.created_at) }]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, channelId]);

  const send = useCallback(async (texte: string): Promise<{ error: string | null }> => {
    if (!conversationId || !me) return { error: 'Non authentifié' };
    const contenu = texte.trim();
    if (!contenu) return { error: null };
    // Optimistic
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, senderId: me, contenu, createdAt: new Date() }]);
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: me, contenu })
      .select('*').single();
    if (error || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return { error: error?.message ?? 'Erreur envoi' };
    }
    setMessages((prev) => prev.map((m) => m.id === tempId
      ? { id: data.id, senderId: data.sender_id, contenu: data.contenu, createdAt: new Date(data.created_at) } : m));
    return { error: null };
  }, [conversationId, me]);

  const markRead = useCallback(async () => {
    if (!conversationId || !me) return;
    await supabase.from('conversation_reads')
      .upsert({ conversation_id: conversationId, user_id: me, last_read_at: new Date().toISOString() },
        { onConflict: 'conversation_id,user_id' });
  }, [conversationId, me]);

  return { messages, isLoading, send, markRead, reload: load };
}

// ── Trouver / créer une conversation avec un autre user ──────────────────────
export async function getOrCreateConversation(params: {
  me: { id: string; nom: string; pseudo: string; couleur: string; initiales: string };
  other: { id: string; nom: string; pseudo: string; couleur: string; initiales: string };
  sujet?: string;
  annonce?: string;
  annonceType?: string;
}): Promise<{ id: string | null; error: string | null }> {
  const { me, other, sujet, annonce, annonceType } = params;
  // Conversation existante (dans un sens ou l'autre)
  const { data: existing } = await supabase
    .from('conversations').select('id')
    .or(`and(participant_a.eq.${me.id},participant_b.eq.${other.id}),and(participant_a.eq.${other.id},participant_b.eq.${me.id})`)
    .limit(1).maybeSingle();
  if (existing?.id) return { id: existing.id, error: null };

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      participant_a: me.id, participant_b: other.id,
      a_nom: me.nom, a_pseudo: me.pseudo, a_couleur: me.couleur, a_initiales: me.initiales,
      b_nom: other.nom, b_pseudo: other.pseudo, b_couleur: other.couleur, b_initiales: other.initiales,
      sujet: sujet ?? '💬 Discussion',
      annonce: annonce ?? null,
      annonce_type: annonceType ?? null,
    })
    .select('id').single();
  if (error || !data) return { id: null, error: error?.message ?? 'Erreur création conversation' };
  return { id: data.id, error: null };
}
