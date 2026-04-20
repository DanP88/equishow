import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { transportReservationsStore, notificationsStore } from '../data/store';

export default function PaiementTransportScreen() {
  const { reservationId, titre, montant, nbPlaces, villeDepart, villeArrivee } =
    useLocalSearchParams<{
      reservationId: string;
      titre: string;
      montant: string;
      nbPlaces: string;
      villeDepart: string;
      villeArrivee: string;
    }>();

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);

  function formatCardNumber(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  }

  function formatExpiry(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + ' / ' + digits.slice(2);
    return digits;
  }

  function handlePay() {
    if (!cardName.trim()) {
      if (typeof window !== 'undefined') window.alert('Veuillez saisir le nom sur la carte.');
      return;
    }
    const rawCard = cardNumber.replace(/\s/g, '');
    if (rawCard.length < 16) {
      if (typeof window !== 'undefined') window.alert('Numéro de carte invalide.');
      return;
    }
    if (expiry.replace(/\s/g, '').length < 5) {
      if (typeof window !== 'undefined') window.alert('Date d\'expiration invalide.');
      return;
    }
    if (cvc.length < 3) {
      if (typeof window !== 'undefined') window.alert('CVC invalide.');
      return;
    }

    setLoading(true);
    // Simuler délai traitement Stripe
    setTimeout(() => {
      // Mettre à jour le statut de la réservation → 'paid'
      const reservation = transportReservationsStore.list.find(r => r.id === reservationId);
      if (reservation) {
        reservation.statut = 'paid';
        // Mettre à jour la notification du vendeur → 'paid'
        const notif = notificationsStore.list.find(
          n => n.donnees?.transportId === reservation.transportId && n.destinataireId === reservation.sellerId
        );
        if (notif) notif.status = 'paid';
      }
      setLoading(false);
      setPaid(true);
    }, 1800);
  }

  if (paid) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.successContainer}>
          <View style={s.successIconWrap}>
            <Text style={s.successIcon}>✓</Text>
          </View>
          <Text style={s.successTitle}>Paiement réussi !</Text>
          <Text style={s.successSub}>
            Votre demande de transport a été envoyée au conducteur.{'\n'}
            Vous recevrez une confirmation par notification.
          </Text>
          <View style={s.successCard}>
            <View style={s.successRow}>
              <Text style={s.successLabel}>Trajet</Text>
              <Text style={s.successVal}>{villeDepart} → {villeArrivee}</Text>
            </View>
            <View style={s.successRow}>
              <Text style={s.successLabel}>Places</Text>
              <Text style={s.successVal}>{nbPlaces}</Text>
            </View>
            <View style={[s.successRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: 4 }]}>
              <Text style={[s.successLabel, { fontWeight: FontWeight.bold, color: Colors.textPrimary }]}>Total payé</Text>
              <Text style={s.successAmount}>{montant}€</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.doneBtn}
            onPress={() => router.replace('/(tabs)/services?tab=transport' as any)}
          >
            <Text style={s.doneBtnText}>Retour aux transports</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Header Stripe-like */}
      <View style={s.stripeHeader}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={s.stripeBadge}>
          <Text style={s.stripeLock}>🔒</Text>
          <Text style={s.stripeText}>Paiement sécurisé</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

        {/* Récap commande */}
        <View style={s.orderCard}>
          <Text style={s.orderLabel}>Récapitulatif</Text>
          <View style={s.orderRow}>
            <Text style={s.orderDesc}>🚐 {villeDepart} → {villeArrivee}</Text>
          </View>
          <View style={s.orderRow}>
            <Text style={s.orderMeta}>{nbPlaces} place{Number(nbPlaces) > 1 ? 's' : ''}</Text>
            <Text style={s.orderAmount}>{montant}€</Text>
          </View>
        </View>

        {/* Formulaire carte */}
        <View style={s.cardForm}>
          <Text style={s.formTitle}>Informations de paiement</Text>

          <View style={s.field}>
            <Text style={s.fieldLabel}>Nom sur la carte</Text>
            <TextInput
              style={s.input}
              value={cardName}
              onChangeText={setCardName}
              placeholder="Sophie Dupont"
              placeholderTextColor={Colors.textTertiary}
              autoComplete="name"
            />
          </View>

          <View style={s.field}>
            <Text style={s.fieldLabel}>Numéro de carte</Text>
            <View style={s.cardInputWrap}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={cardNumber}
                onChangeText={(v) => setCardNumber(formatCardNumber(v))}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                maxLength={19}
              />
              <Text style={s.cardIcons}>💳</Text>
            </View>
          </View>

          <View style={s.row}>
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.fieldLabel}>Date d'expiration</Text>
              <TextInput
                style={s.input}
                value={expiry}
                onChangeText={(v) => setExpiry(formatExpiry(v))}
                placeholder="MM / AA"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                maxLength={7}
              />
            </View>
            <View style={{ width: Spacing.md }} />
            <View style={[s.field, { flex: 1 }]}>
              <Text style={s.fieldLabel}>CVC</Text>
              <TextInput
                style={s.input}
                value={cvc}
                onChangeText={(v) => setCvc(v.replace(/\D/g, '').slice(0, 4))}
                placeholder="123"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
              />
            </View>
          </View>
        </View>

        {/* Bouton payer */}
        <TouchableOpacity
          style={[s.payBtn, loading && s.payBtnLoading]}
          onPress={handlePay}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Text style={s.payBtnText}>
            {loading ? 'Traitement en cours...' : `Payer ${montant}€`}
          </Text>
        </TouchableOpacity>

        {/* Mentions Stripe */}
        <View style={s.stripeMentions}>
          <Text style={s.stripeMentionsText}>
            Paiement sécurisé par Stripe · Vos données ne sont jamais stockées sur nos serveurs.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F9FC' },
  stripeHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E3E8EF',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F2F5',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 24, color: '#1A1A2E', lineHeight: 28 },
  stripeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stripeLock: { fontSize: 14 },
  stripeText: { fontSize: FontSize.sm, color: '#3C4257', fontWeight: FontWeight.semibold },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  orderCard: {
    backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: '#E3E8EF', ...Shadow.card,
  },
  orderLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  orderDesc: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: '#1A1A2E', flex: 1 },
  orderMeta: { fontSize: FontSize.sm, color: '#6B7280' },
  orderAmount: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: '#1A1A2E' },
  cardForm: {
    backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: '#E3E8EF', gap: Spacing.md, ...Shadow.card,
  },
  formTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#1A1A2E', marginBottom: 4 },
  field: { gap: 6 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5, borderColor: '#E3E8EF', borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: FontSize.base, color: '#1A1A2E', backgroundColor: '#FAFAFA',
  },
  cardInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E3E8EF', borderRadius: Radius.md, backgroundColor: '#FAFAFA', paddingRight: Spacing.sm },
  cardIcons: { fontSize: 18, marginLeft: 4 },
  row: { flexDirection: 'row' },
  payBtn: {
    backgroundColor: '#635BFF', borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab,
  },
  payBtnLoading: { backgroundColor: '#9C97FF' },
  payBtnText: { color: '#fff', fontWeight: FontWeight.extrabold, fontSize: FontSize.base, letterSpacing: 0.3 },
  stripeMentions: { alignItems: 'center', paddingHorizontal: Spacing.xl },
  stripeMentionsText: { fontSize: FontSize.xs, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },

  // Success
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, gap: Spacing.lg },
  successIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center',
  },
  successIcon: { fontSize: 40, color: '#fff', fontWeight: FontWeight.extrabold },
  successTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: '#1A1A2E', textAlign: 'center' },
  successSub: { fontSize: FontSize.base, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  successCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: '#E3E8EF', gap: Spacing.sm,
  },
  successRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  successLabel: { fontSize: FontSize.sm, color: '#6B7280' },
  successVal: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#1A1A2E' },
  successAmount: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: '#635BFF' },
  doneBtn: {
    width: '100%', backgroundColor: '#635BFF', borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4, alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
});
