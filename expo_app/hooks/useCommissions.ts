import { useState, useEffect } from 'react';
import { getCommissions, onCommissionChange, CommissionConfig, ServiceType, getCommission } from '../types/service';

/**
 * Hook qui retourne les commissions et les met à jour en temps réel
 */
export function useCommissions(): CommissionConfig {
  const [commissions, setCommissions] = useState<CommissionConfig>(getCommissions());

  useEffect(() => {
    // S'abonner aux changements de commissions
    const unsubscribe = onCommissionChange(() => {
      console.log('📊 Commissions updated:', getCommissions());
      setCommissions(getCommissions());
    });

    // Nettoyage
    return unsubscribe;
  }, []);

  return commissions;
}

/**
 * Hook qui retourne la commission pour un type de service spécifique
 */
export function useCommission(serviceType: ServiceType = 'trajet'): number {
  const [commission, setCommission] = useState<number>(getCommission(serviceType));

  useEffect(() => {
    // S'abonner aux changements de commissions
    const unsubscribe = onCommissionChange(() => {
      setCommission(getCommission(serviceType));
    });

    // Nettoyage
    return unsubscribe;
  }, [serviceType]);

  return commission;
}
