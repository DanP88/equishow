// ⚠️ Instance Supabase UNIQUE partagée avec lib/supabase.ts. Avant on avait
// `createClient(...)` ici, ce qui créait un 2e GoTrueClient → "Lock was stolen
// by another request" + auth qui rate de façon erratique.
import supabase from "../lib/supabase";

/**
 * Get the current authenticated user's session token
 * @returns The JWT access token or null if not authenticated
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      return null;
    }

    return data.session.access_token;
  } catch (err) {
    console.error("Error getting auth token:", err);
    return null;
  }
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    return data.user;
  } catch (err) {
    console.error("Error getting current user:", err);
    return null;
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (token: string | null) => void) {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    callback(session?.access_token || null);
  });
}

export default supabase;
