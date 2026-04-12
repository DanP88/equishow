import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Session, User as AuthUser } from '@supabase/supabase-js';
import supabase, { User, signUp, signIn, signOut, getUserProfile } from '../lib/supabase';

/**
 * Complete Authentication Hook
 * Manages user session, profile, and authentication state
 */
export const useAuth = () => {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get initial session and profile
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        // Get current session
        const { data: { session: currentSession }, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        setSession(currentSession);

        // If user is signed in, fetch their profile
        if (currentSession?.user) {
          setAuthUser(currentSession.user);

          const { data: profileData, error: profileError } =
            await getUserProfile(currentSession.user.id);

          if (profileError) {
            console.error('❌ Error fetching profile:', profileError);
          } else {
            setProfile(profileData);
          }
        }
      } catch (err: any) {
        console.error('❌ Error initializing auth:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log(`🔄 Auth event: ${event}`);

        setSession(newSession);

        if (newSession?.user) {
          setAuthUser(newSession.user);

          // Fetch profile when user signs in
          if (event === 'SIGNED_IN') {
            const { data: profileData } = await getUserProfile(newSession.user.id);
            setProfile(profileData);
            console.log('✅ User signed in:', newSession.user.email);
          }
        } else {
          setAuthUser(null);
          setProfile(null);
          console.log('✅ User signed out');
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign up
  const register = useCallback(
    async (email: string, password: string, userData: Partial<User>) => {
      try {
        setIsSigningUp(true);
        setError(null);

        const { user, error: signUpError } = await signUp(
          email,
          password,
          userData
        );

        if (signUpError) throw signUpError;
        if (!user) throw new Error('No user returned from signup');

        console.log('✅ Sign up successful:', email);
        return { user, error: null };
      } catch (err: any) {
        console.error('❌ Sign up error:', err);
        const errorMsg = err.message || 'Sign up failed';
        setError(errorMsg);
        return { user: null, error: errorMsg };
      } finally {
        setIsSigningUp(false);
      }
    },
    []
  );

  // Sign in
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setIsSigningIn(true);
        setError(null);

        const { user, error: signInError } = await signIn(email, password);

        if (signInError) throw signInError;
        if (!user) throw new Error('No user returned from login');

        console.log('✅ Sign in successful:', email);
        return { user, error: null };
      } catch (err: any) {
        console.error('❌ Sign in error:', err);
        const errorMsg = err.message || 'Sign in failed';
        setError(errorMsg);
        return { user: null, error: errorMsg };
      } finally {
        setIsSigningIn(false);
      }
    },
    []
  );

  // Sign out
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { error: signOutError } = await signOut();

      if (signOutError) throw signOutError;

      console.log('✅ Sign out successful');
      return { error: null };
    } catch (err: any) {
      console.error('❌ Sign out error:', err);
      const errorMsg = err.message || 'Sign out failed';
      setError(errorMsg);
      return { error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // Auth state
    authUser,
    profile,
    session,
    isSignedIn: !!session?.user,

    // Loading states
    isLoading,
    isSigningIn,
    isSigningUp,
    isBusy: isLoading || isSigningIn || isSigningUp,

    // Error state
    error,

    // Methods
    register,
    login,
    logout,
  };
};

export default useAuth;
