import { useEffect, useState, useCallback } from 'react';
import supabase from '../lib/supabase';

/**
 * Hook to sync data from Supabase with real-time updates
 *
 * Usage:
 * const { data, isLoading, error, refresh } = useSyncData(
 *   'chevaux',
 *   'proprietaire_id.eq.user123'
 * );
 */
export const useSyncData = <T,>(
  table: string,
  filter?: string,
  options?: {
    select?: string;
    order?: { column: string; ascending?: boolean };
    limit?: number;
  }
) => {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from(table)
        .select(options?.select || '*');

      // Apply filter if provided
      if (filter) {
        const [field, operator, value] = filter.split('.');
        if (operator === 'eq') {
          query = query.eq(field, value);
        } else if (operator === 'neq') {
          query = query.neq(field, value);
        } else if (operator === 'gt') {
          query = query.gt(field, value);
        }
      }

      // Apply ordering
      if (options?.order) {
        query = query.order(options.order.column, {
          ascending: options.order.ascending ?? true,
        });
      }

      // Apply limit
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data: result, error: err } = await query;

      if (err) {
        console.error(`❌ Error fetching ${table}:`, err.message);
        setError(err.message);
        return;
      }

      setData((result as T[]) || []);
    } catch (err: any) {
      console.error(`❌ Unexpected error fetching ${table}:`, err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [table, filter, options]);

  // Setup real-time subscription
  useEffect(() => {
    // First fetch
    fetchData();

    // Subscribe to changes
    const channel = supabase
      .channel(`public:${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        (payload) => {
          console.log(`🔄 Real-time update on ${table}:`, payload.eventType);

          setData((prevData) => {
            const updated = [...prevData];

            if (payload.eventType === 'INSERT') {
              // Add new item
              updated.push(payload.new as T);
            } else if (payload.eventType === 'UPDATE') {
              // Update existing item
              const index = updated.findIndex((item: any) => item.id === payload.new.id);
              if (index !== -1) {
                updated[index] = payload.new as T;
              }
            } else if (payload.eventType === 'DELETE') {
              // Remove deleted item
              return updated.filter((item: any) => item.id !== payload.old.id);
            }

            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, table]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchData,
  };
};

/**
 * Hook to sync single item with real-time updates
 */
export const useSyncItem = <T,>(
  table: string,
  id: string,
  filter?: string
) => {
  const [item, setItem] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItem = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from(table)
        .select('*')
        .eq('id', id);

      if (filter) {
        // Apply additional filters
        // e.g., "proprietaire_id.eq.user123"
      }

      const { data: result, error: err } = await query.single();

      if (err) {
        console.error(`❌ Error fetching ${table}:`, err.message);
        setError(err.message);
        return;
      }

      setItem(result as T);
    } catch (err: any) {
      console.error(`❌ Unexpected error:`, err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [table, id, filter]);

  useEffect(() => {
    fetchItem();

    const channel = supabase
      .channel(`public:${table}:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setItem(payload.new as T);
          } else if (payload.eventType === 'DELETE') {
            setItem(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, table, fetchItem]);

  return { item, isLoading, error, refresh: fetchItem };
};

export default useSyncData;
