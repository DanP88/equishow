import { useEffect, useCallback } from 'react';
import { supabase } from '../data/store';

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type ConversationRow = {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message?: string;
  last_message_at?: string;
  unread_a?: number;
  unread_b?: number;
};

/**
 * Hook Realtime pour la messagerie.
 * S'abonne aux INSERT sur `messages` et aux UPDATE sur `conversations`
 * filtrés sur l'utilisateur courant.
 *
 * @param userId  - l'ID de l'utilisateur connecté
 * @param onNewMessage   - appelé quand un nouveau message arrive
 * @param onConvUpdated  - appelé quand une conversation est mise à jour
 */
export function useRealtimeMessages(
  userId: string | null,
  onNewMessage: (msg: MessageRow) => void,
  onConvUpdated: (conv: ConversationRow) => void,
) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`messages:user:${userId}`)
      // Nouveaux messages dans les conversations de l'utilisateur
      .on<MessageRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          onNewMessage(payload.new);
        }
      )
      // Mise à jour des conversations (dernier message, non-lus)
      .on<ConversationRow>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          // filtre côté serveur : conversations où l'user est participant
          filter: `participant_a=eq.${userId}`,
        },
        (payload) => onConvUpdated(payload.new)
      )
      .on<ConversationRow>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `participant_b=eq.${userId}`,
        },
        (payload) => onConvUpdated(payload.new)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime messages connecté');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}

/**
 * Hook Realtime pour les notifications.
 * S'abonne aux INSERT sur `notifications` filtrés sur l'user.
 */
export function useRealtimeNotifications(
  userId: string | null,
  onNewNotification: (notif: any) => void,
) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onNewNotification(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
