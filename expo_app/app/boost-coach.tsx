// ─────────────────────────────────────────────────────────────────────────────
// /boost-coach — Page d'achat Boost Coach (4,90€ / 30 jours)
//
// Affiche :
//  - statut actuel du Boost (si actif → countdown + bouton "Renouveler/Cumuler")
//  - inclusions (priorité recherche / badge premium / carrousel / etc.)
//  - bouton "Booster mon profil — 4,90€" → fetch Edge → redirect Stripe Checkout
//
// Le coach paie 100% à la plateforme (pas de Stripe Connect ici).
// Webhook → fn_apply_boost (cumul GREATEST(now,exp)+30j).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Platform, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { getAuthToken } from '../utils/supabaseAuth';
import { useAuth } from '../hooks/useAuth';
import { useUserBadges } from '../hooks/useUserBadges';

const BOOST_PRICE_EUR = 4.90;
const BOOST_DURATION_DAYS = 30;

const BOOST_INCLUDES = [
  { icon: '🔝', label: 'Priorité dans les résultats de recherche' },
  { icon: '⭐', label: 'Badge Boost visible sur ton profil et tes posts' },
  { icon: '🎠', label: 'Apparition dans le carrousel d\'accueil' },
  { icon: '🏟️', label: 'Visibilité accrue auprès des organisateurs de concours' },
  { icon: '📈', label: 'Mise en avant en tête de la marketplace coachs' },
];

function formatExpires(iso: string | null): { days: number; label: string } {
  if (!iso) return { days: 0, label: '' };
  const exp = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, exp - now);
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const date = new Date(exp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return { days, label: date };
}

export default function BoostCoachScreen() {
  const { profile } = useAuth();
  const { badges } = useUserBadges(profile?.id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBoosted = !!badges?.isBoosted;
  const expInfo = formatExpires(badges?.boostExpiresAt ?? null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error('Configuration manquante.');

      const token = await getAuthToken();
      if (!token) throw new Error('Session expirée — reconnecte-toi.');

      const resp = await fetch(`${supabaseUrl}/functions/v1/create-boost-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const data = await resp.json();
      if (!resp.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'Erreur lors de la création du paiement.');
      }

      if (Platform.OS === 'web') {
        window.location.href = data.checkoutUrl;
      } else {
        await Linking.openURL(data.checkoutUrl);
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de démarrer le paiement.');
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.container}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Text style={s.back}>← Retour</Text>
        </TouchableOpacity>

        <View style={s.hero}>
          <Text style={s.heroIcon}>🚀</Text>
          <Text style={s.heroTitle}>Booster mon profil</Text>
          <Text style={s.heroPrice}>{BOOST_PRICE_EUR.toFixed(2)}€</Text>
          <Text style={s.heroDuration}>pour {BOOST_DURATION_DAYS} jours</Text>
        </View>

        {isBoosted && (
          <View style={s.activeCard}>
            <Text style={s.activeTitle}>⭐ Boost actif</Text>
            <Text style={s.activeText}>
              Expire dans {expInfo.days} jour{expInfo.days > 1 ? 's' : ''} ({expInfo.label}).
            </Text>
            <Text style={s.activeNote}>
              Renouveler maintenant cumule les jours : tu garderas tous tes jours restants + 30 jours supplémentaires.
            </Text>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Ce que tu obtiens</Text>
          {BOOST_INCLUDES.map((item) => (
            <View key={item.label} style={s.includeRow}>
              <Text style={s.includeIcon}>{item.icon}</Text>
              <Text style={s.includeLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>À retenir</Text>
          <Text style={s.disclaimer}>
            Le Boost est une <Text style={{ fontWeight: '700' }}>visibilité sponsorisée</Text>, distincte du badge "Coach Certifié" qui reste gratuit et basé sur le mérite (10 réservations finalisées + bonne réputation).
          </Text>
        </View>

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.payBtn, loading && s.payBtnDisabled]}
          onPress={handlePay}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.payBtnText}>
              {isBoosted ? `Cumuler 30 jours — ${BOOST_PRICE_EUR.toFixed(2)}€` : `Booster mon profil — ${BOOST_PRICE_EUR.toFixed(2)}€`}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={s.footer}>
          Paiement sécurisé via Stripe. Aucun engagement, aucun renouvellement automatique.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg, paddingBottom: 120 },
  back: { color: Colors.primary, fontSize: 16, fontWeight: '600', marginBottom: Spacing.lg },
  hero: {
    alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: '#F59E0B', padding: Spacing.xl, marginBottom: Spacing.lg, ...Shadow.sm,
  },
  heroIcon: { fontSize: 44, marginBottom: Spacing.sm },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: '#92400E' },
  heroPrice: { fontSize: 40, fontWeight: FontWeight.extrabold, color: '#92400E', marginTop: Spacing.sm },
  heroDuration: { fontSize: FontSize.base, color: '#92400E' },
  activeCard: {
    backgroundColor: Colors.successBg, borderColor: Colors.successBorder, borderWidth: 1,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg,
  },
  activeTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.success, marginBottom: 4 },
  activeText: { fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 4 },
  activeNote: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: 'italic' },
  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  includeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: Spacing.sm },
  includeIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  includeLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  disclaimer: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  errorBox: {
    backgroundColor: Colors.urgentBg, borderColor: Colors.urgentBorder, borderWidth: 1,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md,
  },
  errorText: { color: Colors.urgent, fontSize: FontSize.sm },
  payBtn: {
    backgroundColor: '#92400E', borderRadius: Radius.md, paddingVertical: Spacing.md,
    alignItems: 'center', marginTop: Spacing.md,
  },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold },
  footer: {
    fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center',
    marginTop: Spacing.lg, lineHeight: 16,
  },
});
