import { useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { getAuthToken } from '../utils/supabaseAuth';

type ConfirmationStatus = 'confirming' | 'success' | 'error';

interface PaymentData {
  id: string;
  buyer_id: string;
  seller_id: string;
  type: string;
  amount_buyer_ttc: number;
  amount_seller_ht: number;
  amount_platform_fee: number;
  payment_status: string;
}

export default function CheckoutSuccessScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [status, setStatus] = useState<ConfirmationStatus>('confirming');
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      confirmPayment(sessionId);
    }
  }, [sessionId]);

  const confirmPayment = async (session: string) => {
    try {
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!SUPABASE_URL) {
        setStatus('error');
        setError('Configuration Supabase manquante');
        return;
      }

      const authToken = await getAuthToken();
      if (!authToken) {
        setStatus('error');
        setError('Authentification requise');
        return;
      }

      // Verify payment via Edge Function
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/verify-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId: session }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setError(data.error || 'Erreur lors de la vérification');
        return;
      }

      if (data.payment_status === 'succeeded') {
        setPayment(data);
        setStatus('success');
      } else {
        setStatus('error');
        setError('Le paiement n\'a pas abouti');
      }
    } catch (err) {
      console.error('Payment confirmation error:', err);
      setStatus('error');
      setError('Impossible de confirmer le paiement');
    }
  };

  const handleReturn = () => {
    router.push('/(tabs)/coach-demandes');
  };

  const handleRetry = () => {
    if (sessionId) {
      setStatus('confirming');
      confirmPayment(sessionId);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        scrollEnabled={false}
      >
        {status === 'confirming' && (
          <ConfirmingView />
        )}

        {status === 'success' && payment && (
          <SuccessView
            payment={payment}
            onPress={handleReturn}
          />
        )}

        {status === 'error' && (
          <ErrorView
            message={error}
            onRetry={handleRetry}
            onCancel={handleReturn}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ConfirmingView() {
  return (
    <View style={s.contentContainer}>
      <Text style={s.emoji}>✓</Text>
      <Text style={s.title}>Paiement en cours de confirmation</Text>
      <Text style={s.subtitle}>
        Veuillez patienter, nous vérifions votre paiement...
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
  payment: PaymentData;
  onPress: () => void;
}

function SuccessView({ payment, onPress }: SuccessViewProps) {
  const formatAmount = (cents: number) => {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  };

  return (
    <View style={s.contentContainer}>
      <Text style={s.emoji}>✅</Text>
      <Text style={s.title}>Paiement confirmé!</Text>
      <Text style={s.subtitle}>
        Merci pour votre achat
      </Text>

      <View style={s.receiptCard}>
        <Text style={s.receiptTitle}>Récapitulatif</Text>

        <View style={s.receiptRow}>
          <Text style={s.receiptLabel}>Type</Text>
          <Text style={s.receiptValue}>
            {payment.type === 'course' ? 'Cours' : 'Stage'}
          </Text>
        </View>

        <View style={s.receiptDivider} />

        <View style={s.receiptRow}>
          <Text style={s.receiptLabel}>Montant</Text>
          <Text style={s.receiptValue}>
            {formatAmount(payment.amount_buyer_ttc)}
          </Text>
        </View>

        <View style={s.receiptDivider} />

        <View style={s.receiptRow}>
          <Text style={s.receiptLabel}>Commission</Text>
          <Text style={s.receiptValue}>
            {formatAmount(payment.amount_platform_fee)}
          </Text>
        </View>

        <View style={[s.receiptDivider, s.thick]} />

        <View style={s.receiptRow}>
          <Text style={s.receiptLabelTotal}>Total TTC</Text>
          <Text style={s.receiptValueTotal}>
            {formatAmount(payment.amount_buyer_ttc)}
          </Text>
        </View>

        <View style={s.receiptNote}>
          <Text style={s.receiptNoteText}>
            💳 Un email de confirmation a été envoyé à votre adresse email
          </Text>
        </View>
      </View>

      <View style={s.infoBox}>
        <Text style={s.infoText}>
          📧 <Text style={s.infoBold}>Email envoyé</Text>
          {'\n'}Un reçu a été envoyé à votre adresse email
        </Text>
      </View>

      <View style={s.infoBox}>
        <Text style={s.infoText}>
          ⏱️ <Text style={s.infoBold}>Prochaines étapes</Text>
          {'\n'}Le coach recevra votre demande et pourra l\'accepter ou la refuser
        </Text>
      </View>

      <TouchableOpacity
        style={[s.button, s.buttonPrimary]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={s.buttonText}>Voir mes demandes</Text>
      </TouchableOpacity>
    </View>
  );
}

interface ErrorViewProps {
  message: string | null;
  onRetry: () => void;
  onCancel: () => void;
}

function ErrorView({ message, onRetry, onCancel }: ErrorViewProps) {
  return (
    <View style={s.contentContainer}>
      <Text style={s.emoji}>⚠️</Text>
      <Text style={s.title}>Erreur de confirmation</Text>
      <Text style={s.subtitle}>
        {message || 'Une erreur s\'est produite lors de la confirmation du paiement'}
      </Text>

      <View style={s.infoBox}>
        <Text style={s.infoText}>
          💡 <Text style={s.infoBold}>Conseil</Text>
          {'\n'}Si vous avez été débité mais cette page affiche une erreur, votre paiement a probablement réussi. Consultez votre email ou vos demandes.
        </Text>
      </View>

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
          <Text style={s.buttonTextSecondary}>Retour</Text>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
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
  receiptCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: Spacing.md,
  },
  receiptTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  receiptLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  receiptValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  receiptLabelTotal: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  receiptValueTotal: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  thick: {
    height: 2,
    backgroundColor: Colors.primary,
    opacity: 0.2,
  },
  receiptNote: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  receiptNoteText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#F0F9FF',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    marginVertical: Spacing.sm,
  },
  infoText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  infoBold: {
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
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
