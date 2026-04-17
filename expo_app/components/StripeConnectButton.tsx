import { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { getAuthToken } from '../utils/supabaseAuth';

interface StripeConnectButtonProps {
  sellerId: string;
  onSuccess?: () => void;
  disabled?: boolean;
}

export function StripeConnectButton({
  sellerId,
  onSuccess,
  disabled,
}: StripeConnectButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!SUPABASE_URL) {
        Alert.alert('Erreur', 'Variables Supabase non configurées');
        return;
      }

      // Get auth token
      const authToken = await getAuthToken();
      if (!authToken) {
        Alert.alert('Erreur', 'Authentification requise');
        return;
      }

      // Step 1: Create Stripe onboarding link via Edge Function
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-stripe-onboarding-link`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ seller_id: sellerId }),
        }
      );

      const data = await response.json();

      if (!data.onboarding_url) {
        Alert.alert('Erreur', 'Impossible de créer le lien Stripe');
        return;
      }

      // Step 2: Open browser to Stripe onboarding
      await Linking.openURL(data.onboarding_url);

      // Step 3: When user returns, check status (with delay)
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 2000);
    } catch (error) {
      console.error('Stripe onboarding error:', error);
      Alert.alert('Erreur', 'Impossible de connecter Stripe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[s.button, (disabled || loading) && s.buttonDisabled]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <>
          <ActivityIndicator color={Colors.primary} style={s.loader} />
          <Text style={s.text}>⏳ Connexion...</Text>
        </>
      ) : (
        <>
          <Text style={s.emoji}>🔗</Text>
          <Text style={s.text}>Lier mon compte Stripe</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loader: {
    marginRight: Spacing.xs,
  },
  emoji: {
    fontSize: 16,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
});

