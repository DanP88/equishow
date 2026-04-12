import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import supabase from '../lib/supabase';

/**
 * Hook to manage Supabase authentication
 * Handles session persistence and auto-refresh
 */
export const useSupabaseAuth = () => {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        setIsLoading(true);
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Session error:', error);
          setError(error.message);
          return;
        }

        setSession(session);
        if (session?.user) {
          setUser(session.user);
        }
      } catch (err: any) {
        console.error('❌ Error getting session:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`🔄 Auth event: ${event}`);

        setSession(session);
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }

        // Handle different auth events
        switch (event) {
          case 'SIGNED_IN':
            console.log('✅ User signed in');
            // Navigate to main app
            router.replace('/(tabs)/chevaux');
            break;
          case 'SIGNED_OUT':
            console.log('✅ User signed out');
            // Navigate to login
            router.replace('/login');
            break;
          case 'TOKEN_REFRESHED':
            console.log('🔄 Token refreshed');
            break;
          case 'USER_UPDATED':
            console.log('👤 User updated');
            break;
        }
      }
    );

    // Cleanup subscription
    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  return {
    session,
    user,
    isLoading,
    error,
    isSignedIn: !!session?.user,
  };
};

export default useSupabaseAuth;
