import { useCallback, useSyncExternalStore } from 'react';
import { Session, User as AuthUser } from '@supabase/supabase-js';
import supabase, { User, signUp, signIn, signOut, getUserProfile } from '../lib/supabase';
import { userStore } from '../data/store';

// ─────────────────────────────────────────────────────────────────────────────
// État auth EN SINGLETON (module-level), partagé par tous les useAuth().
//
// Avant : useAuth était un hook par appel → chaque composant/hook avait son
// propre profile (démarrait à null), sa propre souscription onAuthStateChange
// et son propre getSession/fetch. Conséquences : "SIGNED_IN" émis N fois,
// surcharge auth (lenteur login), et bug "profil/compteurs repassent à 0/Débutant"
// quand un composant remontait (ex: clic Avis → useMyChevauxCount/useMyProgression
// remontaient avec profile=null).
//
// Maintenant : une seule source de vérité partagée + une seule souscription.
// ─────────────────────────────────────────────────────────────────────────────

type AuthState = {
  authUser: AuthUser | null;
  profile: User | null;
  session: Session | null;
  isLoading: boolean;
  isSigningIn: boolean;
  isSigningUp: boolean;
  error: string | null;
};

let state: AuthState = {
  authUser: null,
  profile: null,
  session: null,
  isLoading: true,
  isSigningIn: false,
  isSigningUp: false,
  error: null,
};

const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot() { return state; }
function setState(patch: Partial<AuthState>) { state = { ...state, ...patch }; emit(); }

// Synchronise userStore (utilisé par CustomBottomBar via useUserRole) avec le profile.
function syncUserStore(profile: User | null) {
  if (!profile?.id) return;
  userStore.applyRemoteProfile({
    id: profile.id,
    prenom: (profile as any).prenom ?? '',
    nom: (profile as any).nom ?? '',
    email: profile.email ?? '',
    role: ((profile as any).role ?? 'cavalier') as 'cavalier' | 'coach' | 'organisateur' | 'admin',
    region: (profile as any).region ?? null,
    disciplines: (profile as any).disciplines ?? null,
    plan: (profile as any).plan ?? null,
  });
}

// Init unique : session courante + UNE souscription onAuthStateChange.
let initialized = false;
function initAuthOnce() {
  if (initialized) return;
  initialized = true;

  (async () => {
    try {
      setState({ isLoading: true });
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      setState({ session: currentSession, authUser: currentSession?.user ?? null });
      if (currentSession?.user) {
        const { data: profileData, error: profileError } = await getUserProfile(currentSession.user.id);
        if (!profileError && profileData) {
          setState({ profile: profileData });
          syncUserStore(profileData);
        }
      }
    } catch (err: any) {
      console.error('❌ Error initializing auth:', err);
      setState({ error: err?.message ?? 'init auth error' });
    } finally {
      setState({ isLoading: false });
    }
  })();

  // ⚠️ Callback synchrone : ne jamais await une méthode supabase ici (deadlock
  // signInWithPassword). Fetch profil déféré via setTimeout(0).
  supabase.auth.onAuthStateChange((event, newSession) => {
    console.log(`🔄 Auth event: ${event}`);
    setState({ session: newSession });
    if (newSession?.user) {
      setState({ authUser: newSession.user });
      if (
        event === 'SIGNED_IN' ||
        event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        const uid = newSession.user.id;
        setTimeout(() => {
          getUserProfile(uid)
            .then(({ data }) => {
              if (data) { setState({ profile: data }); syncUserStore(data); }
            })
            .catch((e) => console.warn('[onAuthStateChange] profile fetch:', e));
        }, 0);
      }
    } else {
      setState({ authUser: null, profile: null });
    }
  });
}

// Démarre dès l'import (une seule fois).
initAuthOnce();

/**
 * Complete Authentication Hook — lit l'état partagé (singleton) + expose les actions.
 */
export const useAuth = () => {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const register = useCallback(
    async (email: string, password: string, userData: Partial<User>) => {
      try {
        setState({ isSigningUp: true, error: null });
        const { user, error: signUpError } = await signUp(email, password, userData);
        if (signUpError) throw signUpError;
        if (!user) throw new Error('No user returned from signup');
        console.log('✅ Sign up successful:', email);
        return { user, error: null };
      } catch (err: any) {
        console.error('❌ Sign up error:', err);
        const errorMsg = err.message || 'Sign up failed';
        setState({ error: errorMsg });
        return { user: null, error: errorMsg };
      } finally {
        setState({ isSigningUp: false });
      }
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setState({ isSigningIn: true, error: null });
        const { user, error: signInError } = await signIn(email, password);
        if (signInError) throw signInError;
        if (!user) throw new Error('No user returned from login');
        // Sync immédiat avant que login.tsx navigue.
        setState({ profile: user });
        syncUserStore(user);
        console.log('✅ Sign in successful:', email);
        return { user, error: null };
      } catch (err: any) {
        console.error('❌ Sign in error:', err);
        const errorMsg = err.message || 'Sign in failed';
        setState({ error: errorMsg });
        return { user: null, error: errorMsg };
      } finally {
        setState({ isSigningIn: false });
      }
    },
    [],
  );

  // Re-fetch le profil (source de vérité) après une mutation serveur (changement de rôle…).
  const refetchProfile = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    const uid = s?.user?.id;
    if (!uid) return null;
    const { data, error } = await getUserProfile(uid);
    if (error) {
      console.error('refetchProfile error:', error);
      return null;
    }
    setState({ profile: data });
    syncUserStore(data);
    return data;
  }, []);

  // Sign out — clear immédiat (navigation instantanée), signOut() en arrière-plan.
  const logout = useCallback(async () => {
    setState({ authUser: null, session: null, profile: null, error: null });
    signOut().catch((err) => console.error('❌ Sign out background error:', err));
    return { error: null };
  }, []);

  return {
    // Auth state
    authUser: snap.authUser,
    profile: snap.profile,
    session: snap.session,
    isSignedIn: !!snap.session?.user,

    // Loading states
    isLoading: snap.isLoading,
    isSigningIn: snap.isSigningIn,
    isSigningUp: snap.isSigningUp,
    isBusy: snap.isLoading || snap.isSigningIn || snap.isSigningUp,

    // Error state
    error: snap.error,

    // Methods
    register,
    login,
    logout,
    refetchProfile,
  };
};
