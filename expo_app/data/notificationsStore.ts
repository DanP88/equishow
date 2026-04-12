export interface Notification {
  id: string;
  type: 'mention' | 'message' | 'like' | 'comment';
  title: string;
  message: string;
  author: string;
  authorRole: string;
  timestamp: Date;
  read: boolean;
  relatedId?: string; // ID du post/message/etc.
}

interface NotificationsStore {
  list: Notification[];
  addNotification(notif: Omit<Notification, 'id' | 'timestamp' | 'read'>): void;
  markAsRead(id: string): void;
  getUnreadCount(): number;
  listeners: Set<() => void>;
  onChange(callback: () => void): () => void;
}

const createNotificationsStore = (): NotificationsStore => {
  const store: NotificationsStore = {
    list: [
      {
        id: '1',
        type: 'mention',
        title: '🏇 Sarah Lefebvre vous a tagué',
        message: 'Sarah vous a mentionné dans un commentaire: "J\'aimerais vos conseils pour ma progression..."',
        author: 'Sarah Lefebvre',
        authorRole: 'Cavalier',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
        read: false,
        relatedId: 'post1',
      },
      {
        id: '2',
        type: 'comment',
        title: '💬 Nouveau commentaire sur votre post',
        message: 'Marc Dubois a répondu à votre post sur la progression des jeunes cavaliers',
        author: 'Marc Dubois',
        authorRole: 'Coach',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5h ago
        read: false,
        relatedId: 'post2',
      },
      {
        id: '3',
        type: 'like',
        title: '❤️ 5 personnes aiment votre post',
        message: 'Votre post "Gestion des cavaliers timides" a reçu 5 likes',
        author: 'Communauté',
        authorRole: 'Système',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        read: true,
        relatedId: 'post3',
      },
    ],
    listeners: new Set(),
    addNotification(notif) {
      const notification: Notification = {
        ...notif,
        id: Math.random().toString(36),
        timestamp: new Date(),
        read: false,
      };
      this.list.unshift(notification);
      this.listeners.forEach(cb => cb());
    },
    markAsRead(id) {
      const notif = this.list.find(n => n.id === id);
      if (notif) {
        notif.read = true;
        this.listeners.forEach(cb => cb());
      }
    },
    getUnreadCount() {
      return this.list.filter(n => !n.read).length;
    },
    onChange(callback) {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    },
  };
  return store;
};

export const notificationsStore = createNotificationsStore();
