import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { Colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Initialize Sentry for error tracking
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.APP_ENV || 'development',
    tracesSampleRate: process.env.APP_ENV === 'production' ? 0.1 : 1.0,
    attachStacktrace: true,
    enabled: process.env.APP_ENV === 'production',
    integrations: [
      // Note: ReactNativeTracing and NativeLinkedErrorsIntegration are initialized automatically
      // in newer versions of @sentry/react-native
    ],
  });
}

export default function RootLayout() {
  const { isSignedIn, isLoading } = useAuth();


  // Show loading while checking auth state
  if (isLoading) {
    const loadingView = (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );

    if (Platform.OS === 'web') {
      return (
        <View style={styles.webBg}>
          <View style={styles.phoneFrame}>
            <View style={styles.phoneSpeaker} />
            <View style={styles.phoneScreen}>{loadingView}</View>
            <View style={styles.phoneHome} />
          </View>
        </View>
      );
    }
    return loadingView;
  }

  if (Platform.OS === 'web') {
    return (
      <ErrorBoundary>
        <View style={styles.webBg}>
          {/* Branding côté gauche */}
          <View style={styles.webSidebar}>
            <View style={styles.webLogo}>
              <View style={styles.webLogoCircle}>
                <View style={styles.webLogoInner} />
              </View>
            </View>
            <View style={styles.webBrand}>
              <View style={styles.webBrandDot} />
              <View style={[styles.webBrandDot, { width: 40, opacity: 0.4 }]} />
              <View style={[styles.webBrandDot, { width: 24, opacity: 0.2 }]} />
            </View>
          </View>

          {/* Téléphone centré */}
          <View style={styles.phoneFrame}>
            <View style={styles.phoneSpeaker} />
            <View style={styles.phoneScreen}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false }}>
                  {!isSignedIn ? (
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  ) : (
                    <>
                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                      <Stack.Screen name="cheval/[id]" options={{ presentation: 'card' }} />
                    </>
                  )}
                </Stack>
              </GestureHandlerRootView>
            </View>
            <View style={styles.phoneHome} />
          </View>

          {/* Texte côté droit */}
          <View style={styles.webSidebarRight}>
            <View style={styles.webFeature}>
              <View style={[styles.featureIcon, { backgroundColor: Colors.primaryLight }]}>
                <View style={[styles.featureDot, { backgroundColor: Colors.primary }]} />
              </View>
              <View style={styles.featureLines}>
                <View style={[styles.featureLine, { width: 80 }]} />
                <View style={[styles.featureLine, { width: 56, opacity: 0.4 }]} />
              </View>
            </View>
            <View style={[styles.webFeature, { marginTop: 20 }]}>
              <View style={[styles.featureIcon, { backgroundColor: Colors.successBg }]}>
                <View style={[styles.featureDot, { backgroundColor: Colors.success }]} />
              </View>
              <View style={styles.featureLines}>
                <View style={[styles.featureLine, { width: 64 }]} />
                <View style={[styles.featureLine, { width: 96, opacity: 0.4 }]} />
              </View>
            </View>
            <View style={[styles.webFeature, { marginTop: 20 }]}>
              <View style={[styles.featureIcon, { backgroundColor: Colors.goldBg }]}>
                <View style={[styles.featureDot, { backgroundColor: Colors.gold }]} />
              </View>
              <View style={styles.featureLines}>
                <View style={[styles.featureLine, { width: 72 }]} />
                <View style={[styles.featureLine, { width: 48, opacity: 0.4 }]} />
              </View>
            </View>
          </View>
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          {!isSignedIn ? (
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          ) : (
            <>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="cheval/[id]" options={{ presentation: 'card' }} />
            </>
          )}
        </Stack>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  webBg: {
    flex: 1,
    backgroundColor: '#1A0F0A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 48,
    minHeight: '100vh' as any,
  },
  webSidebar: {
    width: 120,
    alignItems: 'flex-end',
    gap: 16,
  },
  webLogo: {
    marginBottom: 8,
  },
  webLogoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webLogoInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  webBrand: {
    gap: 8,
    alignItems: 'flex-end',
  },
  webBrandDot: {
    width: 56,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  phoneFrame: {
    width: 390,
    height: 844,
    backgroundColor: '#0D0D0D',
    borderRadius: 50,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
    elevation: 30,
    borderWidth: 1,
    borderColor: '#333',
  },
  phoneSpeaker: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333',
    alignSelf: 'center',
    marginBottom: 8,
  },
  phoneScreen: {
    flex: 1,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  phoneHome: {
    width: 100,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#444',
    alignSelf: 'center',
    marginTop: 8,
  },
  webSidebarRight: {
    width: 140,
    gap: 0,
  },
  webFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  featureLines: {
    gap: 6,
  },
  featureLine: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
