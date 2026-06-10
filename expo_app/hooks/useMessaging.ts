// ─────────────────────────────────────────────────────────────────────────────
// useMessaging — messagerie persistée (Supabase) : conversations + messages.
// Remplace l'ancien messagesStore in-memory. Realtime + non-lus via
// conversation_reads (last_read_at par user).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useAutoRefresh } from './useAutoRefresh';

// ── Bus pubsub in-process pour la lecture ────────────────────────────────────
// `conversation_reads` est HORS publication realtime : un upsert markRead ne
// déclenche aucun push DB, donc les badges/listes ne se recalculent pas tout
// seuls. Ce bus notifie en mémoire (même onglet) tous les abonnés dès qu'une
// conversation est marquée lue → décrément instantané, sans toucher au SQL/RLS.
const readListeners = new Set<() => void>();
function emitMessagesRead() { readListeners.forEach((cb) => cb()); }
function onMessagesRead(cb: () => void): () => void {
  readListeners.add(cb);
  return () => { readListeners.delete(cb); };
}

// Dernier expéditeur par conversation. Sert à ne JAMAIS compter mon propre
// message comme non lu : une conv n'est non-lue que si son dernier message
// vient de l'autre. Lecture seule, clé sur l'id courant uniquement (pas
// d'écriture → aucune confusion d'identité possible).
async function fetchLastSenders(convIds: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (convIds.length === 0) return out;
  const { data } = await supabase
    .from('messages')
    .select('conversation_id,sender_id,created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false });
  (data ?? []).forEach((m: any) => {
    if (!(m.conversation_id in out)) out[m.conversation_id] = m.sender_id; // 1er = plus récent
  });
  return out;
}

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

function rowToView(r: ConvRow, myId: string, lastReadAt: string | null, lastSenderId: string | null): ConversationView {
  const iAmA = r.participant_a === myId;
  const otherId = iAmA ? r.participant_b : r.participant_a;
  const oNom = iAmA ? r.b_nom : r.a_nom;
  const oPseudo = iAmA ? r.b_pseudo : r.a_pseudo;
  const oCouleur = iAmA ? r.b_couleur : r.a_couleur;
  const oInit = iAmA ? r.b_initiales : r.a_initiales;
  const lastAt = r.last_message_at ? new Date(r.last_message_at) : null;
  // Non-lu ssi : dernier message envoyé par l'AUTRE (jamais le mien) ET pas
  // encore lu (last_message_at > mon last_read_at).
  const fromOther = !!lastSenderId && lastSenderId !== myId;
  const unread = !!lastAt && fromOther && (!lastReadAt || lastAt > new Date(lastReadAt));
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
    const lastSenders = await fetchLastSenders(((convs ?? []) as ConvRow[]).map((c) => c.id));
    setList(((convs ?? []) as ConvRow[]).map((c) => rowToView(c, me, readMap[c.id] ?? null, lastSenders[c.id] ?? null)));
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

  // Le dot "non lu" de la liste suit le même bus que le badge.
  useEffect(() => onMessagesRead(load), [load]);

  const unreadTotal = list.filter((c) => c.unread).length;
  return { conversations: list, isLoading, reload: load, unreadTotal };
}

// ── Compteur de conversations non lues (badge) ───────────────────────────────
// Source unique = Supabase (conversations + conversation_reads). Aucun store
// mémoire. Increment instantané via realtime `messages` ; décrément au focus
// (useAutoRefresh) après markRead, comme les autres badges de la bottom bar.
export function useUnreadMessagesCount(): number {
  const { profile } = useAuth();
  const me = profile?.id;
  const channelId = useId();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!me) { setCount(0); return; }
    const [{ data: convs }, { data: reads }] = await Promise.all([
      supabase.from('conversations').select('id,last_message_at')
        .or(`participant_a.eq.${me},participant_b.eq.${me}`),
      supabase.from('conversation_reads').select('conversation_id,last_read_at').eq('user_id', me),
    ]);
    const readMap: Record<string, string> = {};
    (reads ?? []).forEach((r: any) => { readMap[r.conversation_id] = r.last_read_at; });
    const rows = (convs ?? []) as { id: string; last_message_at: string | null }[];
    const lastSenders = await fetchLastSenders(rows.map((c) => c.id));
    const n = rows.reduce((acc, c) => {
      if (!c.last_message_at) return acc;
      const senderId = lastSenders[c.id] ?? null;
      const fromOther = !!senderId && senderId !== me; // mon propre dernier message → jamais non lu
      if (!fromOther) return acc;
      const lastReadAt = readMap[c.id] ?? null;
      const unread = !lastReadAt || new Date(c.last_message_at) > new Date(lastReadAt);
      return acc + (unread ? 1 : 0);
    }, 0);
    setCount(n);
  }, [me]);

  useAutoRefresh(load);

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`unread-messages-${me}-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, load, channelId]);

  // Décrément instantané après lecture (bus in-process, hors realtime DB).
  useEffect(() => onMessagesRead(load), [load]);

  return count;
}

// ── Messages d'une conversation + envoi + lecture ────────────────────────────
export function useConversationMessages(conversationId?: string) {
  const { profile } = useAuth();
  const me = profile?.id;
  const channelId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Horodatage (ms) du dernier message connu, dérivé du SERVEUR (messages.created_at).
  // Sert de plancher à markRead pour neutraliser tout décalage horloge client↔serveur.
  const lastMsgAtRef = useRef(0);
  useEffect(() => {
    const last = messages[messages.length - 1];
    lastMsgAtRef.current = last ? last.createdAt.getTime() : 0;
  }, [messages]);

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

  // Marque la conversation lue pour MOI (destinataire qui ouvre la conv).
  // N'écrit QUE ma propre ligne (user_id = me) → ne touche jamais le
  // read-marker de l'autre participant.
  const markRead = useCallback(async () => {
    if (!conversationId || !me) return;
    // Robustesse horloge : on garantit last_read_at >= dernier message (temps
    // serveur), sinon un client en retard sur l'horloge serveur laisserait la
    // conv « non lue » (last_message_at > last_read_at) malgré une lecture réelle.
    const readMs = Math.max(Date.now(), lastMsgAtRef.current + 1);
    const { error } = await supabase.from('conversation_reads')
      .upsert({ conversation_id: conversationId, user_id: me, last_read_at: new Date(readMs).toISOString() },
        { onConflict: 'conversation_id,user_id' });
    if (error) { console.warn('[markRead] échec conversation_reads:', error.message); return; }
    // conversation_reads écrit + committé → notifier les badges/listes (bus
    // in-process) pour un décrément immédiat (table hors realtime).
    emitMessagesRead();
  }, [conversationId, me]);

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
    // Pas de markRead ici : l'expéditeur est déjà exclu du non-lu côté lecture
    // (dernier expéditeur = moi → jamais compté). On ne touche donc aucun
    // read-marker à l'envoi → le non-lu du destinataire reste intact.
    emitMessagesRead(); // recalcule mes propres vues (ma conv repasse non-grasse)
    return { error: null };
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
