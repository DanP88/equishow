import { useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { getAuthToken } from '../utils/supabaseAuth';

type StatusType = 'confirming' | 'success' | 'pending' | 'error';

export default function StripeOnboardingScreen() {
  const [status, setStatus] = useState<StatusType>('confirming');
  const [message, setMessage] = useState('');

  useEffect(() => {
    completeOnboarding();
  }, []);

  const completeOnboarding = async () => {
    try {
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!SUPABASE_URL) {
        setStatus('error');
        setMessage('Configuration Supabase manquante');
        return;
      }

      const authToken = await getAuthToken();
      if (!authToken) {
        setStatus('error');
        setMessage('Authentification requise');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/complete-seller-onboarding`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setMessage(data.error || 'Erreur lors de la finalisation');
        return;
      }

      if (data.success) {
        if (data.status === 'active') {
          setStatus('success');
          setMessage('Votre compte est prêt à recevoir des paiements!');
        } else {
          setStatus('pending');
          setMessage(
            'Votre compte est en cours de vérification. '
            + 'Stripe vous enverra un email de confirmation. '
            + 'En attendant, vous pouvez créer des annonces.'
          );
        }
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      setStatus('error');
      setMessage('Impossible de finaliser l\'intégration');
    }
  };

  const handleRetry = () => {
    setStatus('confirming');
    completeOnboarding();
  };

  const handleReturn = () => {
    router.push('/(tabs)/coach-annonces');
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.container}>
        {status === 'confirming' && (
          <ConfirmingView />
        )}

        {status === 'success' && (
          <SuccessView onPress={handleReturn} />
        )}

        {status === 'pending' && (
          <PendingView onPress={handleReturn} />
        )}

        {status === 'error' && (
          <ErrorView message={message} onRetry={handleRetry} onCancel={handleReturn} />
        )}
      </View>
    </SafeAreaView>
  );
}

function ConfirmingView() {
  return (
    <View style={s.contentContainer}>
      <Text style={s.emoji}>⏳</Text>
      <Text style={s.title}>Finalisation de votre compte Stripe</Text>
      <Text style={s.subtitle}>
        Veuillez patienter, nous vérifions votre compte...
      </Text>
      <ActivityIndicator
        color={Colors.primary}
        size="large"
        style={s.loader}
      />
    </View>
  );
}

interface SuccessViewProps {
  onPress: () => void;
}

function SuccessView({ onPress }: SuccessViewProps) {
  return (
    <View style={s.contentContainer}>
      <Text style={s.emoji}>✅</Text>
      <Text style={s.title}>Prêt à recevoir des paiements!</Text>
      <Text style={s.subtitle}>
        Votre compte Stripe est maintenant configuré et vous pouvez accepter des demandes de cours et des réservations de stages.
      </Text>
      <Text style={s.detail}>
        L'argent des paiements sera transféré directement sur votre compte bancaire.
      </Text>
      <TouchableOpacity
        style={[s.button, s.buttonPrimary]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={s.buttonText}>Retour aux annonces</Text>
      </TouchableOpacity>
    </View>
  );
}

interface PendingViewProps {
  onPress: () => void;
}

function PendingView({ onPress }: PendingViewProps) {
  return (
    <View style={s.contentContainer}>
      <Text style={s.emoji}>⏳</Text>
      <Text style={s.title}>Vérification en cours</Text>
      <Text style={s.subtitle}>
        Stripe finalise votre compte (24-48 heures généralement).
      </Text>
      <Text style={s.detail}>
        📧 Vous recevrez un email de confirmation une fois votre compte vérifié.

        En attendant, vous pouvez:
        • Créer des annonces
        • Être contacté par les cavaliers
        • Recevoir les demandes

        Vous pourrez accepter les paiements dès que la vérification sera complète.
      </Text>
      <TouchableOpacity
        style={[s.button, s.buttonPrimary]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={s.buttonText}>Retour aux annonces</Text>
      </TouchableOpacity>
    </View>
  );
}

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
  onCancel: () => void;
}

function ErrorView({ message, onRetry, onCancel }: ErrorViewProps) {
  return (
    <View style={s.contentContainer}>
      <Text style={s.emoji}>⚠️</Text>
      <Text style={s.title}>Erreur</Text>
      <Text style={s.subtitle}>{message}</Text>
      <Text style={s.detail}>
        Veuillez vérifier votre connexion internet et réessayer.
      </Text>
      <View style={s.buttonGroup}>
        <TouchableOpacity
          style={[s.button, s.buttonPrimary]}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Text style={s.buttonText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.button, s.buttonSecondary]}
          onPress={onCancel}
          activeOpacity={0.8}
        >
          <Text style={s.buttonTextSecondary}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  contentContainer: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  emoji: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  detail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loader: {
    marginTop: Spacing.lg,
  },
  buttonGroup: {
    gap: Spacing.md,
    width: '100%',
    marginTop: Spacing.lg,
  },
  button: {
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
  },
  buttonSecondary: {
    backgroundColor: Colors.surfaceVariant,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  buttonTextSecondary: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
});
