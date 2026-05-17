import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { getPlanById } from '../data/tarification';
import { useAuth } from '../hooks/useAuth';
import { AlertModal } from '../components/AlertModal';
import { ConfirmModal } from '../components/ConfirmModal';

const ROLE_LABELS: Record<string, string> = {
  cavalier: 'Cavalier',
  coach: 'Coach Pro',
  organisateur: 'Organisateur',
};

const PERIODE_LABEL: Record<string, string> = {
  mensuel: '/ mois',
  annuel: '/ an',
  unique: '/ concours',
};

export default function CheckoutScreen() {
  const { profile } = useAuth();
  const { planId, role } = useLocalSearchParams<{ planId: string; role: string }>();
  const plan = getPlanById(planId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [alertState, setAlertState] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'error';
    onClose?: () => void;
  } | null>(null);

  if (!plan) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Forfait</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.errorWrap}>
          <Text style={s.errorIcon}>⚠️</Text>
          <Text style={s.errorTitle}>Forfait introuvable</Text>
          <Text style={s.errorMsg}>Le forfait sélectionné n'existe pas ou a été retiré.</Text>
          <TouchableOpacity style={s.backToPlansBtn} onPress={() => router.replace('/tarification' as any)}>
            <Text style={s.backToPlansText}>Voir les forfaits</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFree = plan.prix === 0;
  const periodeLabel = PERIODE_LABEL[plan.periode] ?? '';
  const roleLabel = ROLE_LABELS[role ?? ''] ?? 'Cavalier';
  const monthlyEquiv = plan.periode === 'annuel' && plan.prix > 0
    ? (plan.prix / 12).toFixed(2)
    : null;

  function startCheckout() {
    if (submitting) return;
    if (isFree) {
      activateFree();
      return;
    }
    setShowConfirm(true);
  }

  async function activateFree() {
    setSubmitting(true);
    // Plan gratuit : activation immédiate (à terme : update users.plan_id en DB).
    await new Promise((r) => setTimeout(r, 250));
    setSubmitting(false);
    setAlertState({
      title: 'Bienvenue dans Découverte 🎉',
      message: 'Votre plan gratuit est activé. Vous pouvez commencer à utiliser Equishow dès maintenant.',
      variant: 'info',
      onClose: () => {
        setAlertState(null);
        router.replace('/' as any);
      },
    });
  }

  async function confirmPaidCheckout() {
    setShowConfirm(false);
    setSubmitting(true);
    // TODO : créer une Stripe Subscription Checkout Session via Edge function.
    // En attendant, on prévient l'utilisateur de l'état beta.
    await new Promise((r) => setTimeout(r, 400));
    setSubmitting(false);
    setAlertState({
      title: 'Bientôt disponible',
      message: 'Le paiement Stripe pour les abonnements sera activé au lancement officiel. Tu as été marqué dans la liste d\'attente prioritaire.',
      variant: 'info',
      onClose: () => {
        setAlertState(null);
        router.replace('/' as any);
      },
    });
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Confirmation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container}>
        {/* Intro */}
        <View style={s.intro}>
          <Text style={s.introTitle}>{isFree ? 'Activez votre plan' : 'Finalisez votre abonnement'}</Text>
          <Text style={s.introSub}>Espace {roleLabel}</Text>
        </View>

        {/* Plan recap */}
        <View style={s.card}>
          {plan.badge && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{plan.badge}</Text>
            </View>
          )}

          <Text style={s.planName}>{plan.nom}</Text>
          <Text style={s.planDesc}>{plan.description}</Text>

          <View style={s.priceRow}>
            <Text style={s.price}>{isFree ? 'Gratuit' : `${plan.prix}€`}</Text>
            {!isFree && <Text style={s.period}>{periodeLabel}</Text>}
          </View>
          {monthlyEquiv && (
            <Text style={s.monthlyEquiv}>soit {monthlyEquiv}€ / mois</Text>
          )}

          <View style={s.divider} />

          <Text style={s.featuresTitle}>Ce qui est inclus</Text>
          {plan.features.map((f) => (
            <View key={f} style={s.featureRow}>
              <Text style={s.featureCheck}>✓</Text>
              <Text style={s.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Email rappel */}
        <View style={s.infoBlock}>
          <Text style={s.infoLabel}>Compte facturé</Text>
          <Text style={s.infoValue}>{profile?.email ?? '—'}</Text>
        </View>

        {/* Stripe note */}
        {!isFree && (
          <View style={s.stripeNote}>
            <Text style={s.stripeIcon}>🔒</Text>
            <Text style={s.stripeText}>
              Paiement sécurisé via Stripe. Vos données bancaires ne transitent jamais par Equishow.
              Annulation possible à tout moment depuis votre profil.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* CTA */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.cta, submitting && { opacity: 0.6 }]}
          onPress={startCheckout}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <Text style={s.ctaText}>
              {isFree
                ? 'Activer Découverte'
                : `Payer ${plan.prix}€${periodeLabel ? ' ' + periodeLabel : ''}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ConfirmModal
        visible={showConfirm}
        title="Confirmer l'abonnement"
        body={
          <View style={cs.body}>
            <View style={cs.row}>
              <Text style={cs.label}>{plan.nom}</Text>
              <Text style={cs.value}>{plan.prix}€{periodeLabel}</Text>
            </View>
            {monthlyEquiv && (
              <View style={cs.row}>
                <Text style={cs.label}>Équivalent mensuel</Text>
                <Text style={cs.value}>{monthlyEquiv}€ / mois</Text>
              </View>
            )}
            <View style={cs.divider} />
            <View style={cs.row}>
              <Text style={cs.totalLabel}>Total {periodeLabel.replace('/ ', '')}</Text>
              <Text style={cs.totalValue}>{plan.prix}€</Text>
            </View>
            <Text style={cs.note}>
              Vous allez être redirigé vers Stripe pour saisir vos informations de paiement.
            </Text>
          </View>
        }
        cancelLabel="Annuler"
        confirmLabel="Continuer vers Stripe"
        onCancel={() => setShowConfirm(false)}
        onConfirm={confirmPaidCheckout}
      />

      <AlertModal
        visible={!!alertState}
        title={alertState?.title ?? ''}
        message={alertState?.message}
        variant={alertState?.variant ?? 'info'}
        onClose={alertState?.onClose ?? (() => setAlertState(null))}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  container: { padding: Spacing.lg, paddingBottom: 120, gap: Spacing.md },

  intro: { alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.xs },
  introTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  introSub: { fontSize: FontSize.sm, color: Colors.textTertiary },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.xs, position: 'relative',
  },
  badge: {
    position: 'absolute', top: -12, left: Spacing.lg, backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: 20,
  },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textInverse },

  planName: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  planDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs, marginTop: Spacing.sm },
  price: { fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  period: { fontSize: FontSize.base, color: Colors.textSecondary },
  monthlyEquiv: { fontSize: FontSize.xs, color: Colors.textTertiary, marginBottom: Spacing.sm },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },

  featuresTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.xs },
  featureCheck: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary, width: 16, marginTop: 2 },
  featureText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  infoBlock: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  infoLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: FontWeight.bold },
  infoValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },

  stripeNote: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surfaceVariant,
    borderRadius: Radius.md, padding: Spacing.md, alignItems: 'flex-start',
  },
  stripeIcon: { fontSize: 16 },
  stripeText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.lg, paddingBottom: 32, backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  cta: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab },
  ctaText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },

  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  errorIcon: { fontSize: 48 },
  errorTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  errorMsg: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  backToPlansBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, marginTop: Spacing.md },
  backToPlansText: { color: Colors.textInverse, fontWeight: FontWeight.bold },
});

const cs = StyleSheet.create({
  body: { gap: Spacing.sm, marginTop: Spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary },
  value: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  totalLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  totalValue: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  note: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic', marginTop: Spacing.sm, lineHeight: 18 },
});
