import { useState, useEffect } from 'react';
import { notificationsStore } from '../data/notificationsStore';

export function useNotifications() {
  const [notifications, setNotifications] = useState(notificationsStore.list);
  const [unreadCount, setUnreadCount] = useState(notificationsStore.getUnreadCount());

  useEffect(() => {
    const unsubscribe = notificationsStore.onChange(() => {
      setNotifications([...notificationsStore.list]);
      setUnreadCount(notificationsStore.getUnreadCount());
    });

    return unsubscribe;
  }, []);

  return { notifications, unreadCount };
}
