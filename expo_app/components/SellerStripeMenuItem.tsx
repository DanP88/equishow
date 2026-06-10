import { useEffect, useState } from 'react';
import {
  TouchableOpacity, Text, StyleSheet, View, ActivityIndicator, Alert, Linking, Platform,
} from 'react-native';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { getAuthToken } from '../utils/supabaseAuth';
import { StripeAccountModal } from './StripeAccountModal';
import { SellerPaymentsModal } from './SellerPaymentsModal';
import { useMySellerPayments } from '../hooks/useMySellerPayments';

// ─────────────────────────────────────────────────────────────────────────────
// SellerStripeMenuItem
//
// Ligne menu insérable dans la section "Mon compte" des écrans profil
// (profil-coach, profil, profil-org). Affiche l'état du compte Stripe Connect
// du user courant et permet de démarrer / finaliser l'onboarding Express.
//
// États possibles :
//   - loading       : requête initiale en cours (skeleton)
//   - not_linked    : aucun stripe_account_id → bouton "Lier mon compte Stripe"
//   - pending       : compte créé mais charges_enabled=false (en attente)
//   - active        : charges_enabled=true → "✅ Compte actif"
//
// Click → POST create-stripe-onboarding-link → Linking.openURL.
// L'utilisateur revient via la route `/stripe-onboarding` (gérée par
// app/stripe-onboarding.tsx qui appelle complete-seller-onboarding).
// ─────────────────────────────────────────────────────────────────────────────

type StripeStatus = 'loading' | 'not_linked' | 'pending' | 'active' | 'error';

interface StripeRow {
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean | null;
  stripe_payouts_enabled: boolean | null;
  stripe_account_status: string | null;
  stripe_last_updated: string | null;
}

export function SellerStripeMenuItem() {
  const { profile } = useAuth();
  const [status, setStatus] = useState<StripeStatus>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentsVisible, setPaymentsVisible] = useState(false);

  const sellerPayments = useMySellerPayments();

  const userId = profile?.id;

  async function load() {
    if (!userId) { setStatus('error'); return; }
    const { data, error } = await supabase
      .from('users')
      .select('stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_account_status, stripe_last_updated')
      .eq('id', userId)
      .maybeSingle<StripeRow>();
    if (error || !data) { setStatus('error'); return; }
    setLastUpdated(data.stripe_last_updated ?? null);
    if (!data.stripe_account_id) setStatus('not_linked');
    else if (data.stripe_charges_enabled && data.stripe_payouts_enabled) setStatus('active');
    else setStatus('pending');
  }

  useEffect(() => { load(); }, [userId]);

  function handlePress() {
    // Tous les états (sauf chargement) ouvrent la modale détaillée.
    // L'état 'error' reste géré comme avant : on retente le chargement.
    if (status === 'error') { setStatus('loading'); load(); return; }
    setModalVisible(true);
  }

  // Démarre / finalise l'onboarding Stripe Connect Express via l'Edge Function
  // create-stripe-onboarding-link, puis ouvre l'URL retournée. Logique Stripe
  // existante inchangée — simplement extraite pour être réutilisée par la modale.
  async function openStripeOnboarding() {
    setModalVisible(false);
    setSubmitting(true);
    try {
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!SUPABASE_URL) { Alert.alert('Erreur', 'Configuration Supabase manquante'); return; }
      const token = await getAuthToken();
      if (!token) { Alert.alert('Erreur', 'Session expirée, veuillez vous reconnecter'); return; }
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/create-stripe-onboarding-link`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.onboarding_url) {
        Alert.alert('Erreur', data?.error ?? 'Impossible de créer le lien Stripe');
        return;
      }
      // Web : rediriger l'onglet courant. window.open() après un await est
      // bloqué par le bloqueur de pop-ups (geste utilisateur déjà consommé par
      // le fetch) → la redirection same-tab passe toujours. Le return_url Stripe
      // (APP_URL/stripe-onboarding) ramène l'utilisateur ensuite.
      if (Platform.OS === 'web') {
        window.location.assign(data.onboarding_url);
        return;
      }
      await Linking.openURL(data.onboarding_url);
      // Quand l'utilisateur revient, l'écran /stripe-onboarding appelle
      // complete-seller-onboarding. On reload ici en best-effort après délai.
      setTimeout(() => load(), 3000);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de démarrer Stripe');
    } finally {
      setSubmitting(false);
    }
  }

  const { icon, label, sublabel, labelColor } = decorate(status);

  return (
    <>
      <TouchableOpacity
        style={s.menuBtn}
        onPress={handlePress}
        disabled={submitting || status === 'loading'}
        activeOpacity={0.7}
      >
        <Text style={s.menuIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.menuLabel, !!labelColor && { color: labelColor }]}>{label}</Text>
          {sublabel ? <Text style={s.menuSublabel}>{sublabel}</Text> : null}
        </View>
        {submitting || status === 'loading'
          ? <ActivityIndicator size="small" color={Colors.textTertiary} />
          : <Text style={s.menuArrow}>›</Text>}
      </TouchableOpacity>

      <StripeAccountModal
        visible={modalVisible}
        state={status === 'active' ? 'active' : 'inactive'}
        lastUpdated={lastUpdated}
        onClose={() => setModalVisible(false)}
        onManage={openStripeOnboarding}
        onSeePayments={() => {
          setModalVisible(false);
          sellerPayments.reload();
          setPaymentsVisible(true);
        }}
      />

      <SellerPaymentsModal
        visible={paymentsVisible}
        loading={sellerPayments.loading}
        error={sellerPayments.error}
        payments={sellerPayments.payments}
        summary={sellerPayments.summary}
        onClose={() => setPaymentsVisible(false)}
      />
    </>
  );
}

function decorate(status: StripeStatus): {
  icon: string; label: string; sublabel?: string; labelColor?: string;
} {
  switch (status) {
    case 'loading':    return { icon: '💳', label: 'Compte de paiement Stripe', sublabel: 'Chargement…' };
    case 'not_linked': return { icon: '💳', label: 'Lier mon compte Stripe', sublabel: 'Requis pour recevoir des paiements', labelColor: Colors.primary };
    case 'pending':    return { icon: '⏳', label: 'Compte Stripe — en attente', sublabel: 'Finaliser la vérification', labelColor: '#92400E' };
    case 'active':     return { icon: '✅', label: 'Compte Stripe actif', sublabel: 'Vous pouvez recevoir des paiements', labelColor: Colors.success };
    case 'error':      return { icon: '⚠️', label: 'Compte Stripe — état indisponible', sublabel: 'Toucher pour réessayer' };
  }
}

const s = StyleSheet.create({
  menuBtn: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  menuIcon: { fontSize: 18, width: 24 },
  menuLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  menuSublabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  menuArrow: { fontSize: FontSize.xl, color: Colors.textTertiary },
});
