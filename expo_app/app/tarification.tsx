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
import { useCoachAccess } from '../hooks/useCoachAccess';

export default function TarificationScreen() {
  const { profile } = useAuth();
  const { role: paramRole } = useLocalSearchParams<{ role?: string }>();
  const userRole = (paramRole || profile?.role || 'cavalier') as 'cavalier' | 'coach' | 'organisateur';
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const coachAccess = useCoachAccess();

  const plans = getPlansByRole(userRole);

  // Résoudre le plan actuel — robuste aux anciennes valeurs DB :
  //   - match exact sur plan.id
  //   - match sur le nom textuel (users.plan) en tolérant casse/accents
  //   - fallback ULTIME : plan gratuit du rôle (pour cavalier → Gratuit). Pour
  //     coach/organisateur sans plan gratuit, la bannière reste légitimement masquée.
  const rawPlanId = ((profile as any)?.plan_id ?? '').toString().toLowerCase().trim();
  const rawPlanNom = ((profile as any)?.plan ?? '').toString().toLowerCase().trim();
  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  let currentPlan: Plan | null = null;
  if (rawPlanId) currentPlan = plans.find((p) => p.id === rawPlanId) ?? null;
  if (!currentPlan && rawPlanNom) {
    currentPlan = plans.find((p) => normalize(p.nom) === normalize(rawPlanNom)) ?? null;
  }
  if (!currentPlan) {
    currentPlan = plans.find((p) => p.prix === 0) ?? null;
  }
  const currentPlanId = currentPlan?.id ?? null;
  if (__DEV__) {
    // Diagnostic : pourquoi un user voit ou ne voit pas "Forfait actuel".
    // eslint-disable-next-line no-console
    console.log('[tarification]', { userRole, rawPlanId, rawPlanNom, currentPlanId });
  }

  const ROLE_LABELS: Record<string, string> = {
    cavalier: 'Cavalier',
    coach: 'Coach Pro',
    organisateur: 'Organisateur',
  };

  const ROLE_DESCRIPTIONS: Record<string, string> = {
    cavalier: 'Equishow est 100% gratuit pour les cavaliers',
    coach: 'Développez votre activité de coach',
    organisateur: 'Organisez vos concours ou événements',
  };

  // FAQ adaptée au rôle : le cavalier est gratuit (aucun abonnement) ;
  // coach / organisateur ont des offres payantes.
  const FAQ_PRO: { question: string; answer: string }[] = [
    {
      question: 'Puis-je changer de forfait ?',
      answer: 'Oui, vous pouvez changer ou annuler votre abonnement à tout moment depuis votre compte.',
    },
    {
      question: "Y a-t-il une période d'essai ?",
      answer: "Les forfaits mensuels offrent 7 jours d'essai gratuit. Pas de carte bancaire requise.",
    },
    {
      question: 'Comment fonctionnent les paiements ?',
      answer: 'Nous acceptons les cartes bancaires, PayPal et virement. Les renouvellements sont automatiques.',
    },
    {
      question: "Quelle est votre politique d'annulation ?",
      answer: "Annulation sans frais jusqu'à 7 jours avant le renouvellement. Remboursement immédiat.",
    },
  ];

  const FAQ_CAVALIER: { question: string; answer: string }[] = [
    {
      question: 'Equishow est-il vraiment gratuit pour les cavaliers ?',
      answer: 'Oui, totalement. Toutes les fonctionnalités cavalier sont gratuites, sans abonnement ni carte bancaire : chevaux illimités, réservation de box, transport, coach et stage, suivi des concours, messagerie, communauté, agenda et notifications.',
    },
    {
      question: 'Devrai-je payer un abonnement plus tard ?',
      answer: "Non. L'accès cavalier reste gratuit. Vous ne payez que les services que vous réservez (box, transport, coach, stage), réglés en toute sécurité au moment de la réservation.",
    },
    {
      question: 'Comment fonctionnent les paiements des réservations ?',
      answer: "Quand vous réservez un service, le paiement est sécurisé et conservé sous séquestre jusqu'à la prestation. Une commission de service est ajoutée au moment du paiement, affichée clairement avant validation.",
    },
    {
      question: 'Existe-t-il des offres payantes sur Equishow ?',
      answer: "Oui, mais uniquement pour les professionnels : les coachs et les organisateurs disposent de forfaits dédiés. En tant que cavalier, vous n'êtes jamais concerné.",
    },
  ];

  const faqItems = userRole === 'cavalier' ? FAQ_CAVALIER : FAQ_PRO;

  // Fonctionnalités incluses gratuitement pour tout cavalier (réassurance).
  const CAVALIER_FEATURES: string[] = [
    'Chevaux illimités',
    'Réservation Box',
    'Réservation Transport',
    'Réservation Coach',
    'Réservation Stage',
    'Agenda Concours',
    'Communauté',
    'Messagerie',
    'Notifications',
    'Avis & suivi',
  ];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{ROLE_LABELS[userRole]}</Text>
          <Text style={styles.subtitle}>{ROLE_DESCRIPTIONS[userRole]}</Text>
        </View>

        {userRole === 'cavalier' ? (
          <>
            {/* CAVALIER — page « marketing » : Equishow gratuit, aucun abonnement */}
            <View style={styles.freeCard}>
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>✓ Gratuit pour tous les cavaliers</Text>
              </View>
              <Text style={styles.freeTitle}>Tous les services sont inclus, sans abonnement</Text>
              <Text style={styles.freeDesc}>
                Vous ne payez que les <Text style={styles.freeDescStrong}>prestations que vous réservez</Text>
                {' '}(box, transport, coach ou stage).
              </Text>

              <View style={styles.featGrid}>
                {CAVALIER_FEATURES.map((f) => (
                  <View key={f} style={styles.featRow}>
                    <View style={styles.featCheck}><Text style={styles.featCheckText}>✓</Text></View>
                    <Text style={styles.featText}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Pourquoi gratuit ? — argument de marque */}
            <View style={styles.whyCard}>
              <Text style={styles.whyTitle}>Pourquoi Equishow est gratuit&nbsp;?</Text>
              <Text style={styles.whyText}>
                Notre objectif est de permettre à tous les cavaliers de participer plus facilement aux
                concours. Les cavaliers n'ont aucun abonnement. Les professionnels (coachs et
                organisateurs) disposent d'offres dédiées pour développer leur activité.
              </Text>
            </View>

            {/* Renvoi vers les Offres Pro */}
            <View style={styles.proCard}>
              <Text style={styles.proKicker}>VOUS ÊTES PROFESSIONNEL&nbsp;?</Text>
              <Text style={styles.proTitle}>Offres Pro — coachs &amp; organisateurs</Text>
              <Text style={styles.proDesc}>
                Développez votre activité avec des forfaits dédiés. Réservé aux pros — les cavaliers
                ne sont jamais concernés.
              </Text>
              <TouchableOpacity
                style={styles.proBtn}
                activeOpacity={0.85}
                onPress={() => router.push('/tarification?role=coach' as any)}
              >
                <Text style={styles.proBtnText}>Découvrir les offres Pro →</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* COACH — carte marketing « Commencez gratuitement » */}
            {userRole === 'coach' && (
              <View style={styles.coachMktCard}>
                <Text style={styles.coachMktTitle}>🚀 Commencez gratuitement</Text>
                <View style={styles.coachMktRow}>
                  <Text style={styles.coachMktCheck}>✓</Text>
                  <Text style={styles.coachMktText}>Aucun abonnement avant vos 3 premières séances payées.</Text>
                </View>
                <View style={styles.coachMktRow}>
                  <Text style={styles.coachMktCheck}>✓</Text>
                  <Text style={styles.coachMktText}>Vous payez seulement lorsque vous avez déjà gagné de l'argent avec Equishow.</Text>
                </View>
              </View>
            )}

            {/* COACH — explication de l'essai gratuit « 3 premières séances payées » */}
            {userRole === 'coach' && (
              <View style={styles.coachTrialCard}>
                <Text style={styles.coachTrialTitle}>🎁 Gratuit jusqu'à vos 3 premières séances payées</Text>
                <Text style={styles.coachTrialText}>
                  Démarrez sans rien payer : l'accès Pro est offert tant que vous n'avez pas reçu le
                  paiement de vos 3 premières séances de coaching. Ensuite, choisissez une offre pour
                  continuer à recevoir de nouvelles réservations.
                </Text>
                {coachAccess.isCoach && !coachAccess.loading && !coachAccess.error && !coachAccess.hasPro && (
                  coachAccess.trialBlockedDuplicate ? (
                    <Text style={styles.coachTrialProgress}>
                      Un compte professionnel semble déjà exister pour cette activité.
                    </Text>
                  ) : (
                    <Text style={styles.coachTrialProgress}>
                      Séances payées : {coachAccess.paidSessions}/{coachAccess.limit}
                      {coachAccess.trialActive
                        ? `  ·  ${coachAccess.remaining} restante${coachAccess.remaining > 1 ? 's' : ''}`
                        : '  ·  essai terminé'}
                    </Text>
                  )
                )}
              </View>
            )}

            {/* Bannière "Plan actuel" — bien visible en haut */}
            {currentPlan && (
              <View style={styles.currentBanner}>
                <View style={styles.currentBannerLeft}>
                  <Text style={styles.currentBannerLabel}>VOTRE FORFAIT ACTUEL</Text>
                  <Text style={styles.currentBannerName}>{currentPlan.nom}</Text>
                  <Text style={styles.currentBannerPrice}>
                    {currentPlan.prix === 0
                      ? 'Gratuit'
                      : `${currentPlan.prix}€${currentPlan.periode === 'mensuel' ? '/mois' : currentPlan.periode === 'annuel' ? '/an' : ''}`}
                  </Text>
                </View>
                <View style={styles.currentBannerBadge}>
                  <Text style={styles.currentBannerBadgeText}>✓ Actif</Text>
                </View>
              </View>
            )}

            {/* Plans Grid */}
            <View style={styles.plansContainer}>
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrent={plan.id === currentPlanId}
                  isSelected={selectedPlanId === plan.id}
                  onSelect={() => setSelectedPlanId(plan.id)}
                  onSubscribe={() => {
                    router.push({
                      pathname: '/checkout',
                      params: { planId: plan.id, role: userRole },
                    } as any);
                  }}
                />
              ))}
            </View>
          </>
        )}

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Questions fréquentes</Text>

          {faqItems.map((item) => (
            <FAQItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface PlanCardProps {
  plan: Plan;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onSubscribe: () => void;
}

function PlanCard({ plan, isCurrent, isSelected, onSelect, onSubscribe }: PlanCardProps) {
  const isFree = plan.prix === 0;
  return (
    <View style={[styles.planCard, isSelected && styles.planCardSelected, isCurrent && styles.planCardCurrent]}>
      {isCurrent && (
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>✓ FORFAIT ACTUEL</Text>
        </View>
      )}
      {plan.badge && !isCurrent && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{plan.badge}</Text>
        </View>
      )}

      <TouchableOpacity onPress={onSelect} activeOpacity={0.85}>
        <Text style={styles.planName}>{plan.nom}</Text>
        <Text style={styles.planDescription}>{plan.description}</Text>

        <View style={styles.priceSection}>
          {isFree ? (
            <Text style={styles.price}>Gratuit</Text>
          ) : (
            <>
              <Text style={styles.price}>{plan.prix}€</Text>
              <Text style={styles.period}>
                {plan.periode === 'mensuel' && '/mois'}
                {plan.periode === 'annuel' && '/an'}
                {plan.periode === 'unique' && '/concours'}
              </Text>
            </>
          )}
        </View>

        {plan.periode === 'annuel' && plan.prix > 0 && (
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
      </TouchableOpacity>

      {isCurrent ? (
        <View style={[styles.subscribeBtn, styles.subscribeBtnCurrent]}>
          <Text style={[styles.subscribeBtnText, styles.subscribeBtnCurrentText]}>
            Vous y êtes ✓
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.subscribeBtn, isSelected && styles.subscribeBtnActive]}
          onPress={onSubscribe}
          activeOpacity={0.85}
        >
          <Text style={[styles.subscribeBtnText, isSelected && styles.subscribeBtnTextActive]}>
            {isFree ? 'Commencer gratuitement' : 'S\'abonner'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
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

  // ── Coach : carte marketing « Commencez gratuitement » ──────────────────────
  coachMktCard: {
    ...CommonStyles.card,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primaryLight,
    marginBottom: Spacing.lg,
  },
  coachMktTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  coachMktRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  coachMktCheck: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.extrabold,
    color: Colors.success,
    marginTop: 1,
  },
  coachMktText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
  },

  // ── Coach : explication essai « 3 premières séances payées » ────────────────
  coachTrialCard: {
    ...CommonStyles.card,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primaryLight,
    marginBottom: Spacing.lg,
  },
  coachTrialTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.extrabold,
    color: Colors.primaryDark,
  },
  coachTrialText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginTop: Spacing.xs,
  },
  coachTrialProgress: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },

  // ── Cavalier : carte « tout gratuit » ──────────────────────────────────────
  freeCard: {
    ...CommonStyles.card,
    padding: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primaryLight,
    marginBottom: Spacing.lg,
  },
  freeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 30,
    marginBottom: Spacing.md,
  },
  freeBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
  },
  freeTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  freeDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: Spacing.lg,
  },
  freeDescStrong: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  featGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.sm,
  },
  featRow: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  featCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featCheckText: {
    fontSize: 11,
    fontWeight: FontWeight.extrabold,
    color: Colors.success,
  },
  featText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },

  // ── Cavalier : « pourquoi gratuit » ────────────────────────────────────────
  whyCard: {
    ...CommonStyles.card,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  whyTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  whyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
  },

  // ── Cavalier : renvoi Offres Pro ───────────────────────────────────────────
  proCard: {
    ...CommonStyles.card,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    backgroundColor: Colors.goldBg,
    marginBottom: Spacing.xxxl,
  },
  proKicker: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 1,
    color: Colors.gold,
    marginBottom: 4,
  },
  proTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
  },
  proDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  proBtn: {
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  proBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },

  currentBanner: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
    borderWidth: 2,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currentBannerLeft: {
    flex: 1,
  },
  currentBannerLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  currentBannerName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
  },
  currentBannerPrice: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  currentBannerBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
  },
  currentBannerBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#fff',
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
  planCardCurrent: {
    borderColor: Colors.primary,
    borderWidth: 3,
    backgroundColor: Colors.primaryLight,
  },
  currentBadge: {
    position: 'absolute',
    top: -12,
    left: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    zIndex: 2,
  },
  currentBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#fff',
    letterSpacing: 0.5,
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
  subscribeBtnCurrent: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  subscribeBtnCurrentText: {
    color: '#fff',
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
