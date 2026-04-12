import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../constants/colors';

/**
 * Auth Guard Component
 * Protects routes and handles auth-based navigation
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isSignedIn, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isSignedIn) {
        // Redirect to login if not signed in
        router.replace('/(auth)/login');
      }
    }
  }, [isSignedIn, isLoading, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Only render children if signed in
  if (!isSignedIn) {
    return null;
  }

  return <>{children}</>;
}

export default AuthGuard;
