import { useState, useEffect } from 'react';
import { supabase } from '../data/store';
import {
  CommissionConfig,
  ServiceType,
  setCommissions,
  getCommissions,
} from '../types/service';

type PlatformSettingsRow = {
  key: string;
  value: any;
};

/**
 * Charge les commissions depuis `platform_settings` Supabase
 * et synchronise le store local (types/service.ts).
 * Doit être appelé une seule fois au démarrage (dans _layout.tsx).
 */
export function usePlatformSettings() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', [
        'commission_trajet',
        'commission_location',
        'commission_cours',
        'commission_box',
      ]);

    if (error) {
      console.error('Erreur chargement platform_settings:', error.message);
      setLoaded(true);
      return;
    }

    if (!data || data.length === 0) {
      setLoaded(true);
      return;
    }

    const updates: Partial<CommissionConfig> = {};
    for (const row of data as PlatformSettingsRow[]) {
      const val = parseFloat(row.value);
      if (isNaN(val)) continue;
      if (row.key === 'commission_trajet') updates.trajet = val;
      if (row.key === 'commission_location') updates.location = val;
      if (row.key === 'commission_cours') updates.cours = val;
      if (row.key === 'commission_box') updates.box = val;
    }

    setCommissions(updates);
    setLoaded(true);
  }

  return loaded;
}

/**
 * Sauvegarde les commissions dans Supabase (appelé depuis admin-settings).
 */
export async function savePlatformCommissions(
  commissions: Partial<CommissionConfig>
): Promise<{ error: string | null }> {
  const rows = Object.entries({
    trajet: commissions.trajet,
    location: commissions.location,
    cours: commissions.cours,
    box: commissions.box,
  })
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ({
      key: `commission_${k}`,
      value: String(v),
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return { error: null };

  const { error } = await supabase
    .from('platform_settings')
    .upsert(rows, { onConflict: 'key' });

  if (error) {
    return { error: error.message };
  }

  // Synchroniser le store local immédiatement
  setCommissions(commissions);
  return { error: null };
}
