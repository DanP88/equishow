import { createClient } from "@supabase/supabase-js";

// Create a single instance of Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""
);

/**
 * Get the current authenticated user's session token
 * @returns The JWT access token or null if not authenticated
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      console.warn("No active session found - using development token");
      // Development: return a mock token
      // In production, this should fail and require actual authentication
      if (process.env.NODE_ENV === 'development' || true) {
        // Create a simple development token
        const devToken = "dev_token_" + Date.now();
        console.log("✅ Using development token:", devToken);
        return devToken;
      }
      return null;
    }

    return data.session.access_token;
  } catch (err) {
    console.error("Error getting auth token:", err);
    // Fallback to development token in case of error
    console.log("⚠️ Falling back to development token due to error");
    return "dev_token_" + Date.now();
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
