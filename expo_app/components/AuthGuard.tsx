import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../constants/colors';

export type AuthGuardRole = 'cavalier' | 'coach' | 'organisateur' | 'admin';

/**
 * Auth Guard Component
 * Protects routes and handles auth-based navigation.
 * Pass `requiredRole` (single role or array) to gate a screen by role.
 * - not signed in → redirect to /(auth)/login
 * - signed in but role mismatch → redirect to /(tabs)
 */
export function AuthGuard({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: AuthGuardRole | AuthGuardRole[];
}) {
  const router = useRouter();
  const { isSignedIn, isLoading, profile } = useAuth();

  const allowed: AuthGuardRole[] | null = requiredRole
    ? (Array.isArray(requiredRole) ? requiredRole : [requiredRole])
    : null;
  const hasRole = !allowed
    || (profile?.role ? allowed.includes(profile.role as AuthGuardRole) : false);

  useEffect(() => {
    if (isLoading) return;
    if (!isSignedIn) {
      router.replace('/(auth)/login');
    } else if (allowed && !hasRole) {
      router.replace('/(tabs)');
    }
  }, [isSignedIn, isLoading, hasRole, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  if (!isSignedIn) return null;
  if (allowed && !hasRole) return null;

  return <>{children}</>;
}

export default AuthGuard;
