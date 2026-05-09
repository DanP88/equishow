import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../data/store';

// Config: afficher les notifs même si l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) {
    // Simulateur — pas de token
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notifications: permission refusée');
    return null;
  }

  // Android: canal obligatoire
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Equishow',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID,
  });

  return tokenData.data;
}

async function savePushToken(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const platform = Platform.OS as 'ios' | 'android' | 'web';

  // Upsert : un token est unique, on met à jour si déjà existant
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: user.id, token, platform, active: true, updated_at: new Date().toISOString() },
      { onConflict: 'token' }
    );

  if (error) {
    console.error('Erreur sauvegarde push token:', error.message);
  }
}

async function deactivatePushToken(token: string) {
  const { error } = await supabase
    .from('push_tokens')
    .update({ active: false })
    .eq('token', token);

  if (error) {
    console.error('Erreur désactivation push token:', error.message);
  }
}

/**
 * Hook principal — à appeler une seule fois dans _layout.tsx
 * Gère l'inscription, la sauvegarde du token et les listeners de notifs.
 */
export function usePushNotifications() {
  const tokenRef = useRef<string | null>(null);
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    let mounted = true;

    // Enregistrement + sauvegarde du token
    registerForPushNotifications().then((token) => {
      if (!mounted || !token) return;
      tokenRef.current = token;
      savePushToken(token);
    });

    // Listener : tap sur une notification reçue en background
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, any>;
        // Les edge functions envoient { actionUrl: '/messagerie?convId=...' }
        if (data?.actionUrl) {
          // Expo Router — navigation via URL string
          const { router } = require('expo-router');
          router.push(data.actionUrl);
        }
      }
    );

    return () => {
      mounted = false;
      responseListenerRef.current?.remove();
      // Désactiver le token côté serveur au logout
      if (tokenRef.current) {
        deactivatePushToken(tokenRef.current);
      }
    };
  }, []);
}
