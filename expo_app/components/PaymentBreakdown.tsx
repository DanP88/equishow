import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';

interface PaymentBreakdownProps {
  amountTtc: number;        // cents
  amountHt: number;         // cents
  commission: number;       // cents
  vat: number;              // cents
}

export function PaymentBreakdown({
  amountTtc,
  amountHt,
  commission,
  vat,
}: PaymentBreakdownProps) {
  const formatAmount = (cents: number) => {
    const amount = (cents / 100).toFixed(2);
    return `${amount.replace('.', ',')} €`;
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Détail du paiement</Text>
      </View>

      <View style={s.content}>
        <View style={s.row}>
          <Text style={s.label}>Prix HT</Text>
          <Text style={s.value}>{formatAmount(amountHt)}</Text>
        </View>

        <View style={s.divider} />

        <View style={s.row}>
          <View>
            <Text style={s.label}>Commission Equishow</Text>
            <Text style={s.detail}>(5% de la prestation)</Text>
          </View>
          <Text style={s.value}>{formatAmount(commission)}</Text>
        </View>

        <View style={s.divider} />

        <View style={s.row}>
          <View>
            <Text style={s.label}>TVA</Text>
            <Text style={s.detail}>(20% sur le montant HT)</Text>
          </View>
          <Text style={s.value}>{formatAmount(vat)}</Text>
        </View>

        <View style={[s.divider, s.thick]} />

        <View style={[s.row, s.totalRow]}>
          <Text style={s.totalLabel}>Montant total TTC</Text>
          <Text style={s.totalValue}>{formatAmount(amountTtc)}</Text>
        </View>
      </View>

      <View style={s.footer}>
        <Text style={s.footerText}>
          💳 Paiement sécurisé par Stripe
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: Colors.surfaceVariant,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  detail: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs / 2,
  },
  value: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  thick: {
    height: 2,
    backgroundColor: Colors.primary,
    opacity: 0.2,
  },
  totalRow: {
    paddingTop: Spacing.sm,
  },
  totalLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  totalValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  footer: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#D1FAE5',
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
