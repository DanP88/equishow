import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { Notification } from '../types/notification';

// ── DB row shape (snake_case) ───────────────────────────────────────────────
type NotificationType =
  | 'stage_reservation'
  | 'box_reservation'
  | 'transport_reservation'
  | 'course_request'
  | 'reservation_request'
  | 'message'
  | 'like'
  | 'comment'
  | 'mention';

type NotificationStatus = 'pending' | 'accepted' | 'rejected' | 'paid';

interface NotificationRow {
  id: string;
  destinataire_id: string;
  auteur_id: string | null;
  auteur_nom: string | null;
  auteur_pseudo: string | null;
  auteur_initiales: string | null;
  auteur_couleur: string | null;
  type: NotificationType;
  titre: string;
  message: string;
  status: NotificationStatus | null;
  lu: boolean;
  donnees: Record<string, unknown>;
  action_url: string | null;
  lien: string | null;
  created_at: string;
}

function rowToNotification(r: NotificationRow): Notification {
  return {
    id: r.id,
    destinataireId: r.destinataire_id,
    auteurId: r.auteur_id ?? undefined,
    auteurNom: r.auteur_nom ?? undefined,
    auteurPseudo: r.auteur_pseudo ?? undefined,
    auteurInitiales: r.auteur_initiales ?? undefined,
    auteurCouleur: r.auteur_couleur ?? undefined,
    type: r.type,
    titre: r.titre,
    message: r.message,
    status: r.status ?? undefined,
    lu: r.lu,
    donnees: (r.donnees ?? {}) as Notification['donnees'],
    actionUrl: r.action_url ?? undefined,
    lien: r.lien ?? undefined,
    dateCreation: new Date(r.created_at),
  };
}

// ── Standalone helper : créer une notif pour un autre user ─────────────────
// Utilisable hors hook (paths de réservation, paiement, etc.).
export interface CreateNotificationInput {
  destinataireId: string;
  type: NotificationType;
  titre: string;
  message: string;
  status?: NotificationStatus;
  actionUrl?: string;
  lien?: string;
  donnees?: Record<string, unknown>;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<{ error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  const auteurId = session?.user?.id;
  if (!auteurId) return { error: 'Non authentifié' };

  const { error } = await supabase.from('notifications').insert({
    destinataire_id: input.destinataireId,
    auteur_id: auteurId,
    type: input.type,
    titre: input.titre,
    message: input.message,
    status: input.status ?? null,
    action_url: input.actionUrl ?? null,
    lien: input.lien ?? null,
    donnees: input.donnees ?? {},
    // lu défaut false côté DB ; auteur_* remplis par trigger.
  });
  return { error: error?.message ?? null };
}

// ── Hook principal : boîte de réception du user courant ────────────────────
export function useNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setNotifications([]);
      return;
    }
    setIsLoading(true);
    const { data, error: queryErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('destinataire_id', profile.id)
      .order('created_at', { ascending: false });
    if (queryErr) {
      setError(queryErr.message);
      setNotifications([]);
    } else {
      setError(null);
      setNotifications(((data ?? []) as NotificationRow[]).map(rowToNotification));
    }
    setIsLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime sync sur ma boîte de réception.
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `destinataire_id=eq.${profile.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, load]);

  const unreadCount = notifications.filter((n) => !n.lu).length;

  const markAsRead = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('notifications').update({ lu: true }).eq('id', id);
    return { error: error?.message ?? null };
  }, []);

  const markAllAsRead = useCallback(async (): Promise<{ error: string | null }> => {
    if (!profile?.id) return { error: 'Non authentifié' };
    const { error } = await supabase
      .from('notifications')
      .update({ lu: true })
      .eq('destinataire_id', profile.id)
      .eq('lu', false);
    return { error: error?.message ?? null };
  }, [profile?.id]);

  const removeNotification = useCallback(async (id: string): Promise<{ error: string | null }> => {
    // RLS bloque déjà l'IDOR (delete only own).
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    return { error: error?.message ?? null };
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    removeNotification,
    createNotification,
    reload: load,
  };
}

// ── Hook léger : juste le count (pour bottom bar, badges) ──────────────────
export function useUnreadNotificationsCount() {
  const { profile } = useAuth();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setCount(0);
      return;
    }
    const { count: c, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('destinataire_id', profile.id)
      .eq('lu', false);
    if (error) {
      setCount(0);
    } else {
      setCount(c ?? 0);
    }
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`notifications-count-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `destinataire_id=eq.${profile.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, load]);

  return count;
}
