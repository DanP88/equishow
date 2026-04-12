import { useState } from 'react';
import supabase from '../lib/supabase';

/**
 * Hook for creating, updating, and deleting data in Supabase
 *
 * Usage:
 * const { create, update, delete: deleteItem, isLoading } = useMutateData('chevaux');
 */
export const useMutateData = <T,>(table: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create
  const create = async (data: Partial<T>): Promise<T | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: result, error: err } = await supabase
        .from(table)
        .insert([data])
        .select()
        .single();

      if (err) {
        console.error(`❌ Error creating ${table}:`, err.message);
        setError(err.message);
        return null;
      }

      console.log(`✅ Created ${table}:`, result);
      return result as T;
    } catch (err: any) {
      console.error(`❌ Unexpected error:`, err);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Update
  const update = async (
    id: string,
    updates: Partial<T>
  ): Promise<T | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: result, error: err } = await supabase
        .from(table)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (err) {
        console.error(`❌ Error updating ${table}:`, err.message);
        setError(err.message);
        return null;
      }

      console.log(`✅ Updated ${table}:`, result);
      return result as T;
    } catch (err: any) {
      console.error(`❌ Unexpected error:`, err);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete
  const deleteItem = async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const { error: err } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (err) {
        console.error(`❌ Error deleting ${table}:`, err.message);
        setError(err.message);
        return false;
      }

      console.log(`✅ Deleted ${table} with id:`, id);
      return true;
    } catch (err: any) {
      console.error(`❌ Unexpected error:`, err);
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Batch create
  const createBatch = async (items: Partial<T>[]): Promise<T[] | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: result, error: err } = await supabase
        .from(table)
        .insert(items)
        .select();

      if (err) {
        console.error(`❌ Error batch creating ${table}:`, err.message);
        setError(err.message);
        return null;
      }

      console.log(`✅ Created ${result.length} items in ${table}`);
      return result as T[];
    } catch (err: any) {
      console.error(`❌ Unexpected error:`, err);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    create,
    update,
    delete: deleteItem,
    createBatch,
    isLoading,
    error,
  };
};

export default useMutateData;
