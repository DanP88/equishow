import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';

const PLANS = [
  {
    id: 'gratuit',
    nom: 'Gratuit',
    prix: '0€',
    periode: '',
    couleur: Colors.textSecondary,
    bg: Colors.surfaceVariant,
    features: [
      '2 chevaux maximum',
      'Accès aux concours publics',
      'Co-transport (consultation)',
      'Communauté',
    ],
    limits: [
      'Pas de coaching en ligne',
      'Pas de réservation de box',
    ],
    current: true,
  },
  {
    id: 'pro',
    nom: 'Pro',
    prix: '9,90€',
    periode: '/ mois',
    couleur: Colors.primary,
    bg: Colors.primaryLight,
    features: [
      'Chevaux illimités',
      'Réservation co-transport & box',
      'Réservation coaching à la séance',
      'Résultats en temps réel',
      'Palmarès complet',
      'Messagerie sans limite',
      'Notifications push avancées',
    ],
    limits: [],
    current: false,
    popular: true,
  },
  {
    id: 'elite',
    nom: 'Élite',
    prix: '24,90€',
    periode: '/ mois',
    couleur: Colors.gold,
    bg: Colors.goldBg,
    features: [
      'Tout le plan Pro',
      'Import FFECompet automatique',
      'Accès API Winjump & Equistra',
      'Profil cavalier mis en avant',
      'Support prioritaire',
      'Badge Élite sur le profil',
    ],
    limits: [],
    current: false,
  },
];

export default function AbonnementScreen() {
  function subscribe(planId: string) {
    if (planId === 'gratuit') return;
    Alert.alert(
      'Paiement sécurisé',
      'Vous allez être redirigé vers Stripe pour finaliser votre abonnement.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Continuer', onPress: () => Alert.alert('Bientôt disponible', 'L\'intégration Stripe sera disponible au lancement de la plateforme.') },
      ],
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Abonnement</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container}>
        <View style={s.intro}>
          <Text style={s.introTitle}>Choisissez votre plan</Text>
          <Text style={s.introSub}>Changez ou annulez à tout moment · Paiement via Stripe</Text>
        </View>

        {PLANS.map((plan) => (
          <View key={plan.id} style={[s.card, plan.current && s.cardCurrent, plan.popular && s.cardPopular]}>
            {plan.popular && (
              <View style={s.popularBadge}>
                <Text style={s.popularText}>⭐ Le plus populaire</Text>
              </View>
            )}
            <View style={s.cardHeader}>
              <View style={[s.planIcon, { backgroundColor: plan.bg }]}>
                <Text style={[s.planIconText, { color: plan.couleur }]}>
                  {plan.id === 'gratuit' ? '🌱' : plan.id === 'pro' ? '🚀' : '👑'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.planNom, { color: plan.couleur }]}>{plan.nom}</Text>
                <View style={s.prixRow}>
                  <Text style={s.planPrix}>{plan.prix}</Text>
                  <Text style={s.planPeriode}>{plan.periode}</Text>
                </View>
              </View>
              {plan.current && (
                <View style={s.currentBadge}>
                  <Text style={s.currentBadgeText}>Actuel</Text>
                </View>
              )}
            </View>

            <View style={s.featureList}>
              {plan.features.map((f) => (
                <View key={f} style={s.featureRow}>
                  <Text style={[s.featureCheck, { color: plan.couleur }]}>✓</Text>
                  <Text style={s.featureText}>{f}</Text>
                </View>
              ))}
              {plan.limits.map((l) => (
                <View key={l} style={s.featureRow}>
                  <Text style={s.featureCross}>✕</Text>
                  <Text style={s.featureLimitText}>{l}</Text>
                </View>
              ))}
            </View>

            {!plan.current && (
              <TouchableOpacity
                style={[s.subscribeBtn, { backgroundColor: plan.couleur }]}
                onPress={() => subscribe(plan.id)}
                activeOpacity={0.85}
              >
                <Text style={s.subscribeBtnText}>
                  {plan.id === 'gratuit' ? 'Plan actuel' : `Passer au plan ${plan.nom}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <View style={s.stripeNotice}>
          <Text style={s.stripeIcon}>🔒</Text>
          <Text style={s.stripeText}>Paiements sécurisés via Stripe. Annulation possible à tout moment depuis votre espace.</Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.md },
  intro: { alignItems: 'center', paddingVertical: Spacing.md },
  introTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  introSub: { fontSize: FontSize.sm, color: Colors.textTertiary, marginTop: Spacing.xs },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.md },
  cardCurrent: { borderColor: Colors.borderMedium },
  cardPopular: { borderColor: Colors.primary, borderWidth: 2 },
  popularBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.primaryBorder },
  popularText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.bold },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  planIcon: { width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  planIconText: { fontSize: 26 },
  planNom: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold },
  prixRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  planPrix: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  planPeriode: { fontSize: FontSize.sm, color: Colors.textTertiary },
  currentBadge: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: Colors.border },
  currentBadgeText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  featureList: { gap: Spacing.xs },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  featureCheck: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, width: 16, marginTop: 2 },
  featureCross: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, width: 16, marginTop: 2, color: Colors.borderMedium },
  featureText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  featureLimitText: { fontSize: FontSize.sm, color: Colors.textTertiary, flex: 1, lineHeight: 20 },
  subscribeBtn: { borderRadius: Radius.lg, paddingVertical: Spacing.md + 2, alignItems: 'center', marginTop: Spacing.xs },
  subscribeBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  stripeNotice: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'flex-start' },
  stripeIcon: { fontSize: 16 },
  stripeText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
});
