import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { getAuthToken } from '../utils/supabaseAuth';

type StatusType = 'loading' | 'ready' | 'pending' | 'no_account';

interface SellerStatusProps {
  sellerId: string;
  onRefresh?: () => void;
}

interface StatusData {
  status: StatusType;
  pending_requirements?: string[];
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
}

export function SellerStatus({ sellerId, onRefresh }: SellerStatusProps) {
  const [status, setStatus] = useState<StatusType>('loading');
  const [requirements, setRequirements] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, [sellerId]);

  const checkStatus = async () => {
    try {
      setStatus('loading');
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!SUPABASE_URL) {
        setError('Configuration manquante');
        setStatus('pending');
        return;
      }

      const authToken = await getAuthToken();
      if (!authToken) return;

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/check-seller-status/${sellerId}`,
        {
          headers: { 'Authorization': `Bearer ${authToken}` },
        }
      );

      const data: StatusData = await response.json();
      setStatus(data.status);
      setRequirements(data.pending_requirements || []);
      setError(null);
    } catch (err) {
      console.error('Error checking seller status:', err);
      setError('Impossible de vérifier le statut');
      setStatus('pending');
    }
  };

  const getStatusStyles = (st: StatusType) => {
    switch (st) {
      case 'ready':
        return { container: s.containerSuccess, text: s.textSuccess };
      case 'pending':
        return { container: s.containerWarning, text: s.textWarning };
      case 'no_account':
        return { container: s.containerError, text: s.textError };
      default:
        return { container: s.containerLoading, text: s.textLoading };
    }
  };

  const getStatusContent = (st: StatusType) => {
    switch (st) {
      case 'ready':
        return {
          emoji: '✅',
          title: 'Compte Stripe prêt',
          subtitle: 'Vous pouvez maintenant recevoir des paiements',
        };
      case 'pending':
        return {
          emoji: '⏳',
          title: 'Vérification en cours',
          subtitle: 'Votre compte est en cours de vérification (24-48h)',
        };
      case 'no_account':
        return {
          emoji: '⚠️',
          title: 'Compte non configuré',
          subtitle: 'Veuillez lier un compte Stripe pour continuer',
        };
      default:
        return {
          emoji: '🔄',
          title: 'Vérification...',
          subtitle: '',
        };
    }
  };

  const { container, text } = getStatusStyles(status);
  const { emoji, title, subtitle } = getStatusContent(status);

  return (
    <View style={[s.container, container]}>
      <View style={s.content}>
        <Text style={s.emoji}>{emoji}</Text>
        <View style={s.textContainer}>
          <Text style={[s.title, text]}>{title}</Text>
          {subtitle && (
            <Text style={[s.subtitle, text]}>{subtitle}</Text>
          )}
          {requirements.length > 0 && (
            <Text style={[s.requirements, text]}>
              À compléter: {requirements.join(', ')}
            </Text>
          )}
        </View>
        {status === 'loading' && (
          <ActivityIndicator color={Colors.primary} style={s.loader} />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    marginVertical: Spacing.md,
    ...Shadow.card,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emoji: {
    fontSize: 32,
    marginRight: Spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.xs,
  },
  requirements: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  loader: {
    marginLeft: Spacing.sm,
  },
  // Status-specific styles
  containerSuccess: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  textSuccess: {
    color: '#065F46',
  },
  containerWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FBBF24',
  },
  textWarning: {
    color: '#78350F',
  },
  containerError: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  textError: {
    color: '#7F1D1D',
  },
  containerLoading: {
    backgroundColor: Colors.surfaceVariant,
    borderColor: Colors.border,
  },
  textLoading: {
    color: Colors.textSecondary,
  },
});
