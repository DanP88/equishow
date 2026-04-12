import { useState, useEffect } from 'react';
import { userStore } from '../data/store';

/**
 * Hook qui retourne le rôle de l'utilisateur et re-rend quand ça change
 */
export function useUserRole() {
  const [role, setRole] = useState(userStore.role);

  useEffect(() => {
    // S'abonner aux changements de rôle
    const unsubscribe = userStore.onRoleChange(() => {
      console.log('🔄 Role changed to:', userStore.role);
      setRole(userStore.role);
    });

    // Nettoyage
    return unsubscribe;
  }, []);

  return role;
}
