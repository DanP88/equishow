import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { TARIFICATION, getPlansByRole, formatPrice, Plan } from '../data/tarification';

export default function TarificationScreen() {
  const { profile } = useAuth();
  const { role: paramRole } = useLocalSearchParams<{ role?: string }>();
  const userRole = (paramRole || profile?.role || 'cavalier') as 'cavalier' | 'coach' | 'organisateur';
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const plans = getPlansByRole(userRole);

  const ROLE_LABELS: Record<string, string> = {
    cavalier: 'Cavalier',
    coach: 'Coach Pro',
    organisateur: 'Organisateur',
  };

  const ROLE_DESCRIPTIONS: Record<string, string> = {
    cavalier: 'Choisissez votre forfait cavalier',
    coach: 'Développez votre activité de coach',
    organisateur: 'Organisez vos concours ou événements',
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{ROLE_LABELS[userRole]}</Text>
          <Text style={styles.subtitle}>{ROLE_DESCRIPTIONS[userRole]}</Text>
        </View>

        {/* Plans Grid */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlanId === plan.id}
              onSelect={() => setSelectedPlanId(plan.id)}
              onSubscribe={() => {
                // Placeholder pour la souscription
                router.push({
                  pathname: '/checkout',
                  params: { planId: plan.id, role: userRole },
                } as any);
              }}
            />
          ))}
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Questions fréquentes</Text>

          <FAQItem
            question="Puis-je changer de forfait?"
            answer="Oui, vous pouvez changer ou annuler votre abonnement à tout moment depuis votre compte."
          />

          <FAQItem
            question="Y a-t-il une période d'essai?"
            answer="Les forfaits mensuels offrent 7 jours d'essai gratuit. Pas de carte bancaire requise."
          />

          <FAQItem
            question="Comment fonctionnent les paiements?"
            answer="Nous acceptons les cartes bancaires, PayPal et virement. Les renouvellements sont automatiques."
          />

          <FAQItem
            question="Quelle est votre politique d'annulation?"
            answer="Annulation sans frais jusqu'à 7 jours avant le renouvellement. Remboursement immédiat."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface PlanCardProps {
  plan: Plan;
  isSelected: boolean;
  onSelect: () => void;
  onSubscribe: () => void;
}

function PlanCard({ plan, isSelected, onSelect, onSubscribe }: PlanCardProps) {
  return (
    <TouchableOpacity
      style={[styles.planCard, isSelected && styles.planCardSelected]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {plan.badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{plan.badge}</Text>
        </View>
      )}

      <Text style={styles.planName}>{plan.nom}</Text>
      <Text style={styles.planDescription}>{plan.description}</Text>

      <View style={styles.priceSection}>
        <Text style={styles.price}>{plan.prix}€</Text>
        <Text style={styles.period}>
          {plan.periode === 'mensuel' && '/mois'}
          {plan.periode === 'annuel' && '/an'}
          {plan.periode === 'unique' && '/concours'}
        </Text>
      </View>

      {plan.periode === 'annuel' && (
        <Text style={styles.monthlyEquiv}>
          {(plan.prix / 12).toFixed(2)}€/mois
        </Text>
      )}

      <View style={styles.featuresSection}>
        {plan.features.map((feature, idx) => (
          <View key={idx} style={styles.featureRow}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.subscribeBtn, isSelected && styles.subscribeBtnActive]}
        onPress={onSubscribe}
      >
        <Text style={[styles.subscribeBtnText, isSelected && styles.subscribeBtnTextActive]}>
          S'abonner
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.faqItem}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.faqQuestion}>
        <Text style={styles.faqQuestionText}>{question}</Text>
        <Text style={[styles.faqIcon, expanded && styles.faqIconRotated]}>›</Text>
      </View>
      {expanded && (
        <Text style={styles.faqAnswer}>{answer}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg, paddingBottom: 100 },

  backBtn: {
    marginBottom: Spacing.lg,
  },
  backBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },

  header: {
    marginBottom: Spacing.xxxl,
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  plansContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },

  planCard: {
    ...CommonStyles.card,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },

  badge: {
    position: 'absolute',
    top: -12,
    left: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },

  planName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  planDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },

  priceSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.xs,
  },
  price: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
  },
  period: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  monthlyEquiv: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginBottom: Spacing.lg,
  },

  featuresSection: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  featureIcon: {
    fontSize: FontSize.base,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    marginTop: 2,
  },
  featureText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },

  subscribeBtn: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  subscribeBtnActive: {
    backgroundColor: Colors.primary,
  },
  subscribeBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  subscribeBtnTextActive: {
    color: Colors.textInverse,
  },

  faqSection: {
    marginTop: Spacing.xl,
  },
  faqTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },

  faqItem: {
    ...CommonStyles.card,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  faqQuestionText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  faqIcon: {
    fontSize: FontSize.xl,
    color: Colors.primary,
    marginLeft: Spacing.md,
  },
  faqIconRotated: {
    transform: [{ rotate: '90deg' }],
  },
  faqAnswer: {
    padding: Spacing.lg,
    paddingTop: 0,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    lineHeight: 22,
  },
});
