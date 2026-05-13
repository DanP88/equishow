import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { Colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ExpiredAccessScreen } from '../components/ExpiredAccessScreen';
import { isTestAccessExpired } from '../config/testExpiration';
import { userStore } from '../data/store';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { usePlatformSettings } from '../hooks/usePlatformSettings';

// Scrub sensitive patterns from any string before it leaves the device.
// Audit P25-bis : on évite que tokens / clés / cartes / emails fuient dans Sentry.
const SECRET_PATTERNS: { re: RegExp; replace: string }[] = [
  { re: /\bsk_(live|test)_[A-Za-z0-9]{16,}/g, replace: 'sk_[REDACTED]' },        // Stripe secret
  { re: /\bpk_(live|test)_[A-Za-z0-9]{16,}/g, replace: 'pk_[REDACTED]' },        // Stripe publishable
  { re: /\brk_(live|test)_[A-Za-z0-9]{16,}/g, replace: 'rk_[REDACTED]' },        // Stripe restricted
  { re: /\bwhsec_[A-Za-z0-9]{16,}/g, replace: 'whsec_[REDACTED]' },              // Stripe webhook secret
  { re: /\beyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}/g, replace: '[JWT_REDACTED]' },
  { re: /\bBearer\s+[A-Za-z0-9._\-]{20,}/gi, replace: 'Bearer [REDACTED]' },
  { re: /\b\d{13,19}\b/g, replace: '[CARD_REDACTED]' },                          // Carte bancaire
  { re: /\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi, replace: '[EMAIL_REDACTED]' },
];

function scrubString(s: string): string {
  let out = s;
  for (const { re, replace } of SECRET_PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

function scrubValue(v: unknown): unknown {
  if (typeof v === 'string') return scrubString(v);
  if (Array.isArray(v)) return v.map(scrubValue);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      // Drop entirely les clés notoirement sensibles (Sentry les loggue parfois en clair).
      if (/^(password|access_token|refresh_token|api_key|secret|authorization|cookie)$/i.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = scrubValue(val);
      }
    }
    return out;
  }
  return v;
}

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || 'https://95fb80ee023c19b097d1da1c47e705a4@o4511231038980096.ingest.de.sentry.io/4511231145476176',
  environment: process.env.EXPO_PUBLIC_APP_ENV || 'production',
  release: 'equishow@1.0.0',
  tracesSampleRate: 0.2,
  attachStacktrace: true,
  enabled: true,
  // PII : on ne demande jamais Sentry de capturer les corps de requêtes.
  sendDefaultPii: false,
  beforeSend(event) {
    // Anonymiser user : on garde l'id (UUID) pour groupage, on retire email/username.
    if (event.user) {
      event.user = { id: event.user.id };
    }
    if (event.message) event.message = scrubString(event.message);
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (ex.value) ex.value = scrubString(ex.value);
      }
    }
    if (event.request) event.request = scrubValue(event.request) as typeof event.request;
    if (event.extra)   event.extra   = scrubValue(event.extra)   as typeof event.extra;
    if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts;
    if (event.tags)    event.tags    = scrubValue(event.tags)    as typeof event.tags;
    return event;
  },
  beforeBreadcrumb(crumb) {
    if (crumb.message) crumb.message = scrubString(crumb.message);
    if (crumb.data)    crumb.data    = scrubValue(crumb.data) as typeof crumb.data;
    return crumb;
  },
});
function RootLayout() {
  const { isSignedIn, isLoading } = useAuth();

  // Charger les commissions depuis Supabase au démarrage
  usePlatformSettings();

  // Enregistrer le token push et gérer les notifications
  usePushNotifications();

  useEffect(() => {
    // PII : seul l'UUID part vers Sentry — pas d'email ni de pseudo.
    // Le pseudo suffit pour identifier en interne, on le résout depuis l'UUID.
    if (isSignedIn) {
      Sentry.setUser({ id: userStore.id });
    } else {
      Sentry.setUser(null);
    }
  }, [isSignedIn]);

  // Blocage testeurs : actif uniquement en production Vercel après la date d'expiration
  // Guard placé après les hooks pour respecter les Rules of Hooks
  if (isTestAccessExpired) {
    return <ExpiredAccessScreen />;
  }


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

export default Sentry.wrap(RootLayout);

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
