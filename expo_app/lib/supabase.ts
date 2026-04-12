import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppError } from './errorHandler';

// Get credentials from environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase credentials not configured. Using fallback.');
  console.warn('Please add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env');
}

// Create Supabase client
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Type helpers for database
export type User = {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  pseudo: string;
  role: 'cavalier' | 'coach' | 'organisateur';
  plan: string;
  region?: string;
  avatar_color?: string;
  created_at: string;
};

export type Cheval = {
  id: string;
  proprietaire_id: string;
  nom: string;
  type: 'cheval' | 'poney';
  race?: string;
  robe?: string;
  annee_naissance?: number;
  disciplines: string[];
  created_at: string;
};

export type Concours = {
  id: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  lieu: string;
  organisateur_id: string;
  statut: 'ouvert' | 'complet' | 'ferme' | 'termine' | 'brouillon';
  created_at: string;
};

export type CoachAnnonce = {
  id: string;
  auteur_id: string;
  titre: string;
  type: 'concours' | 'regulier';
  discipline: string;
  prix_heure_ht?: number;
  prix_heure_ttc?: number;
  created_at: string;
};

export type Avis = {
  id: string;
  auteur_id: string;
  auteur_nom?: string;
  destinataire_id: string;
  note: number;
  commentaire?: string;
  created_at: string;
  updated_at?: string;
};

export type Post = {
  id: string;
  auteur_id: string;
  auteur_nom?: string;
  titre: string;
  contenu: string;
  image_url?: string;
  nb_likes: number;
  nb_commentaires: number;
  created_at: string;
  updated_at?: string;
};

export type PostComment = {
  id: string;
  post_id: string;
  auteur_id: string;
  auteur_nom?: string;
  contenu: string;
  created_at: string;
  updated_at?: string;
};

/**
 * Get current session user
 */
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('❌ Error getting user:', error.message);
    return null;
  }
  return user;
};

/**
 * Sign up new user
 */
export const signUp = async (
  email: string,
  password: string,
  userData: Partial<User>
): Promise<{ user: User | null; error: AppError | null }> => {
  try {
    // Sign up with auth
    const { data: { user }, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!user) throw new Error('No user returned from signup');

    // Create user profile in database
    const { error: dbError } = await supabase
      .from('users')
      .insert([
        {
          id: user.id,
          email,
          prenom: userData.prenom || '',
          nom: userData.nom || '',
          pseudo: userData.pseudo || '',
          role: userData.role || 'cavalier',
          plan: 'Gratuit',
          avatar_color: userData.avatar_color,
        },
      ]);

    if (dbError) throw dbError;

    // Note: Full user profile is fetched from database, not auth
    return { user: null, error: null };
  } catch (err: unknown) {
    console.error('❌ Sign up error:', err);
    const error = err instanceof AppError
      ? err
      : new AppError(err instanceof Error ? err.message : String(err), 'SIGNUP_ERROR', 500);
    return { user: null, error };
  }
};

/**
 * Sign in with email and password
 */
export const signIn = async (email: string, password: string): Promise<{ user: User | null; error: AppError | null }> => {
  try {
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Note: Full user profile is fetched from database, not auth
    return { user: null, error: null };
  } catch (err: unknown) {
    console.error('❌ Sign in error:', err);
    const error = err instanceof AppError
      ? err
      : new AppError(err instanceof Error ? err.message : String(err), 'SIGNIN_ERROR', 401);
    return { user: null, error };
  }
};

/**
 * Sign out
 */
export const signOut = async (): Promise<{ error: AppError | null }> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (err: unknown) {
    console.error('❌ Sign out error:', err);
    const error = err instanceof AppError
      ? err
      : new AppError(err instanceof Error ? err.message : String(err), 'SIGNOUT_ERROR', 500);
    return { error };
  }
};

/**
 * Get user profile from database
 */
export const getUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    return { data: null, error };
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  userId: string,
  updates: Partial<User>
) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    return { data: null, error };
  }
};

/**
 * Subscribe to real-time changes
 */
export const subscribeToTable = (
  table: string,
  onData: (payload: any) => void,
  filter?: string
) => {
  const channel = supabase
    .channel(`public:${table}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        ...(filter ? { filter } : {}),
      },
      onData
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export default supabase;
