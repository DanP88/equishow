import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert, Modal, Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { transportsStore, userStore, transportReservationsStore, notificationsStore } from '../data/store';
import { prixTTC, getCommissionMontant, getCommission, TransportReservation } from '../types/service';
import { MultiDatePickerModal } from '../components/DatePickerModal';
import { getAuthToken } from '../utils/supabaseAuth';
import { createClient } from '@supabase/supabase-js';
import { Notification } from '../types/notification';

export default function ReserverTransportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transport = transportsStore.list.find((t) => t.id === id);

  if (!transport) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.errorContainer}>
          <Text style={s.errorText}>Transport non trouvé</Text>
          <TouchableOpacity style={s.backBtn2} onPress={() => router.back()}>
            <Text style={s.backText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Vérifier que le type de transport est correct
  if (!transport.typeTransport) {
    transport.typeTransport = 'trajet'; // Par défaut
  }

  const ttc = prixTTC(transport.prixHT);
  const [nbPlaces, setNbPlaces] = useState(1);
  const [message, setMessage] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(false);

  // Calcul du prix
  let prixTotal = 0;
  let prixTotalTTC = 0;
  let nombreJours = 1;

  if (transport.typeTransport === 'location' && selectedDates.length > 0) {
    nombreJours = selectedDates.length;
    prixTotal = transport.prixHT * nombreJours;
    prixTotalTTC = prixTotal; // Déjà en TTC
  } else if (transport.typeTransport === 'trajet') {
    prixTotal = transport.prixHT * nbPlaces;
    prixTotalTTC = prixTotal; // Déjà en TTC
  }

  async function submit() {
    if (transport.typeTransport === 'location') {
      if (selectedDates.length === 0) {
        Alert.alert('Erreur', 'Veuillez sélectionner au moins 1 jour.');
        return;
      }
    } else {
      if (nbPlaces < 1 || nbPlaces > transport.nbPlacesDisponibles) {
        Alert.alert('Erreur', `Sélectionnez entre 1 et ${transport.nbPlacesDisponibles} place(s).`);
        return;
      }
    }

    console.log('🟢 Transport submit called');
    setLoading(true);
    try {
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      console.log('🔑 Checking Supabase config:', { URL: !!SUPABASE_URL, KEY: !!SUPABASE_ANON_KEY });

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.log('❌ Supabase config missing!');
        Alert.alert('Erreur', 'Variables Supabase non configurées');
        setLoading(false);
        return;
      }

      console.log('🔌 Creating Supabase client');
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Supabase client created');
      const authToken = await getAuthToken();
      if (!authToken) {
        Alert.alert('Erreur', 'Non authentifié');
        return;
      }

      // Créer réservation transport en BD
      const { data: reservation, error: reservError } = await supabase
        .from('transport_reservations')
        .insert({
          transport_id: transport.id,
          seller_id: transport.propId,
          buyer_id: userStore.id,
          title: `Transport ${transport.villeDepart} → ${transport.villeArrivee}`,
          ville_depart: transport.villeDepart,
          ville_arrivee: transport.villeArrivee,
          nb_places: transport.typeTransport === 'trajet' ? nbPlaces : 1,
          message: message.trim(),
          price_total_ht: Math.round(prixTotal * 100),
          platform_commission: Math.round(prixTotal * 0.05 * 100),
          price_total_ttc: Math.round(prixTotalTTC * 100),
          status: 'pending',
        })
        .select('id')
        .single();

      if (reservError || !reservation) {
        Alert.alert('Erreur', 'Impossible de créer la réservation');
        return;
      }

      // Ajouter à la store locale
      const nouvelleReservation: TransportReservation = {
        id: reservation.id,
        transportId: transport.id,
        sellerId: transport.propId || transport.auteurId,
        buyerId: userStore.id,
        titre: `Transport ${transport.villeDepart} → ${transport.villeArrivee}`,
        villeDepart: transport.villeDepart,
        villeArrivee: transport.villeArrivee,
        nbPlaces: transport.typeTransport === 'trajet' ? nbPlaces : 1,
        message: message.trim(),
        prixTotalHT: prixTotal,
        commissionPlateform: prixTotal * 0.05,
        prixTotalTTC: prixTotalTTC,
        statut: 'pending' as const,
        dateCreation: new Date(),
      };

      transportReservationsStore.list = [nouvelleReservation, ...transportReservationsStore.list];

      // Créer notification pour le propriétaire du transport
      const notificationTransport: Notification = {
        id: `notif_${Date.now()}`,
        destinataireId: transport.propId || transport.auteurId,
        type: 'reservation_request',
        titre: `🚐 Nouvelle réservation de transport`,
        message: `${userStore.prenom} ${userStore.nom} demande une réservation pour ${transport.villeDepart} → ${transport.villeArrivee}`,
        status: 'pending',
        lu: false,
        dateCreation: new Date(),
        actionUrl: '/transport-pending-demands',
        auteurId: userStore.id,
        auteurNom: userStore.nom,
        auteurPseudo: userStore.pseudo,
        auteurInitiales: `${userStore.prenom[0]}${userStore.nom[0]}`,
        auteurCouleur: userStore.avatarColor,
        donnees: {
          transportId: transport.id,
          titre: `Transport ${transport.villeDepart} → ${transport.villeArrivee}`,
          prix: prixTotalTTC,
          message: message.trim(),
        },
      };

      notificationsStore.list = [notificationTransport, ...notificationsStore.list];

      // Réservation créée, en attente de validation du propriétaire
      console.log('✅ Réservation créée, en attente de validation');
      setShowConfirmation(true);
    } catch (error) {
      console.error('❌ Transport submit error:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log('Error details:', errorMsg);
      Alert.alert('Erreur', `Une erreur est survenue: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }

  // Filtrer les dates sélectionnables (seulement les dates disponibles)
  const datesDispoAvailableForSelection = (transport.datesDisponibles || [])
    .map(d => new Date(d.getFullYear(), d.getMonth(), d.getDate()));

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Réserver un transport</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Transport card */}
        <View style={s.transportCard}>
          <View style={s.routeSection}>
            <View>
              <Text style={s.routeDepart}>{transport.villeDepart}</Text>
              <Text style={s.routeArrow}>↓</Text>
              <Text style={s.routeArrivee}>{transport.villeArrivee}</Text>
            </View>
            <View style={s.priceBadge}>
              {transport.typeTransport === 'location' ? (
                <>
                  <Text style={s.priceHT}>{transport.prixHT}€/jour TTC</Text>
                  <Text style={s.priceTTC}>km inclus: {transport.kmInclus}</Text>
                </>
              ) : (
                <>
                  <Text style={s.priceHT}>{transport.prixHT}€/place TTC</Text>
                  <Text style={s.priceTTC}>{ttc}€ TTC</Text>
                </>
              )}
            </View>
          </View>

          <View style={s.infoRow}>
            <Text style={s.infoLabel}>📅 {transport.typeTransport === 'location' ? 'Type' : 'Date'}</Text>
            <Text style={s.infoValue}>
              {transport.typeTransport === 'location' ? 'Location du van seul' : transport.dateTrajet.toLocaleDateString('fr-FR')}
            </Text>
          </View>
          {transport.typeTransport === 'trajet' && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>🐴 Places restantes</Text>
              <Text style={s.infoValue}>{transport.nbPlacesDisponibles}/{transport.nbPlacesTotal}</Text>
            </View>
          )}
          {transport.typeTransport === 'location' && (
            <>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>💳 Caution réparation</Text>
                <Text style={s.infoValue}>{transport.cautionRéparation}€ TTC</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>🧹 Caution nettoyage</Text>
                <Text style={s.infoValue}>{transport.cautionNettoyage}€ TTC</Text>
              </View>
            </>
          )}
          {transport.concours && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>🏆 Concours</Text>
              <Text style={s.infoValue}>{transport.concours}</Text>
            </View>
          )}
        </View>

        {/* Trajet: Places / Location: Dates */}
        {transport.typeTransport === 'trajet' ? (
          <View style={s.field}>
            <Text style={s.fieldLabel}>Nombre de places</Text>
            <View style={s.row}>
              <TouchableOpacity
                style={s.minusBtn}
                onPress={() => setNbPlaces(Math.max(1, nbPlaces - 1))}
              >
                <Text style={s.minusBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.nbPlacesInput}>{nbPlaces}</Text>
              <TouchableOpacity
                style={s.plusBtn}
                onPress={() => setNbPlaces(Math.min(transport.nbPlacesDisponibles, nbPlaces + 1))}
              >
                <Text style={s.plusBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.field}>
            <Text style={s.fieldLabel}>Sélectionner les jours ({selectedDates.length} jour(s))</Text>
            <TouchableOpacity
              style={[s.datePickerBtn, selectedDates.length > 0 && s.datePickerBtnActive]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={[s.datePickerBtnText, selectedDates.length > 0 && s.datePickerBtnTextActive]}>
                {selectedDates.length === 0 ? 'Sélectionner les dates' : `${selectedDates.length} jour(s) sélectionné(s)`}
              </Text>
            </TouchableOpacity>
            {selectedDates.length > 0 && (
              <View style={s.datesListContainer}>
                {selectedDates
                  .sort((a, b) => a.getTime() - b.getTime())
                  .map((date, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={s.dateTag}
                      onPress={() => setSelectedDates(selectedDates.filter((_, i) => i !== idx))}
                    >
                      <Text style={s.dateTagText}>
                        {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} ✕
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}
          </View>
        )}

        {/* Message */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Message au conducteur</Text>
          <TextInput
            style={[s.input, s.inputMultiline, !!message && s.inputFilled]}
            value={message}
            onChangeText={setMessage}
            placeholder="Nombre de chevaux, adresse de récupération..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Prix récap */}
        <View style={s.prixCard}>
          {transport.typeTransport === 'location' ? (
            <>
              <View style={s.prixRow}>
                <Text style={s.prixLabel}>Prix par jour (HT)</Text>
                <Text style={s.prixVal}>{transport.prixHT}€</Text>
              </View>
              <View style={s.prixRow}>
                <Text style={s.prixLabel}>Nombre de jours</Text>
                <Text style={s.prixVal}>{nombreJours}</Text>
              </View>
              <View style={s.prixRow}>
                <Text style={s.prixLabel}>Tarif km supplémentaire</Text>
                <Text style={s.prixVal}>{transport.tarifKmSupplémentaire}€/km HT</Text>
              </View>
              <View style={s.prixRow}>
                <Text style={s.prixLabel}>Sous-total HT</Text>
                <Text style={s.prixVal}>{prixTotalTTC}€</Text>
              </View>
              <View style={s.prixRow}>
                <Text style={s.prixLabel}>Commission app ({(getCommission('location') * 100).toFixed(0)}%)</Text>
                <Text style={s.prixVal}>{getCommissionMontant(prixTotalTTC, 'location')}€</Text>
              </View>
              <View style={[s.prixRow, s.prixTotal]}>
                <Text style={s.prixTotalLabel}>Total TTC</Text>
                <Text style={s.prixTotalVal}>{(prixTotalTTC + getCommissionMontant(prixTotalTTC, 'location')).toFixed(2)}€</Text>
              </View>
            </>
          ) : (
            <>
              <View style={s.prixRow}>
                <Text style={s.prixLabel}>Prix / place (HT)</Text>
                <Text style={s.prixVal}>{transport.prixHT}€</Text>
              </View>
              <View style={s.prixRow}>
                <Text style={s.prixLabel}>Nombre de places</Text>
                <Text style={s.prixVal}>{nbPlaces}</Text>
              </View>
              <View style={s.prixRow}>
                <Text style={s.prixLabel}>Sous-total HT</Text>
                <Text style={s.prixVal}>{prixTotalTTC}€</Text>
              </View>
              <View style={s.prixRow}>
                <Text style={s.prixLabel}>Commission app ({(getCommission('trajet') * 100).toFixed(0)}%)</Text>
                <Text style={s.prixVal}>{getCommissionMontant(prixTotalTTC, 'trajet')}€</Text>
              </View>
              <View style={[s.prixRow, s.prixTotal]}>
                <Text style={s.prixTotalLabel}>Total TTC</Text>
                <Text style={s.prixTotalVal}>{(prixTotalTTC + getCommissionMontant(prixTotalTTC, 'trajet')).toFixed(2)}€</Text>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity style={s.submitBtn} onPress={submit} activeOpacity={0.85}>
          <Text style={s.submitText}>Envoyer la demande</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal de confirmation */}
      <Modal visible={showConfirmation} transparent animationType="fade">
        <View style={s.confirmationBackdrop}>
          <View style={s.confirmationCard}>
            <Text style={s.confirmationIcon}>✅</Text>

            <Text style={s.confirmationTitle}>Demande envoyée !</Text>

            <Text style={s.confirmationMessage}>
              Le conducteur prendra connaissance de votre demande rapidement
            </Text>

            <View style={s.confirmationDetails}>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>🚐</Text>
                <Text style={s.detailText}>{transport.villeDepart} → {transport.villeArrivee}</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>📅</Text>
                <Text style={s.detailText}>{transport.dateTrajet.toLocaleDateString('fr-FR')}</Text>
              </View>
              {transport.typeTransport === 'location' ? (
                <>
                  <View style={s.detailRow}>
                    <Text style={s.detailIcon}>📅</Text>
                    <Text style={s.detailText}>{selectedDates.length} jour(s)</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={s.detailIcon}>💳</Text>
                    <Text style={s.detailText}>{prixTotalTTC}€ TTC (hors cautions)</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.detailRow}>
                    <Text style={s.detailIcon}>🐴</Text>
                    <Text style={s.detailText}>{nbPlaces} place(s)</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={s.detailIcon}>💳</Text>
                    <Text style={s.detailText}>{prixTotalTTC}€ TTC (à confirmer)</Text>
                  </View>
                </>
              )}
            </View>

            <View style={s.confirmationButtons}>
              <TouchableOpacity
                style={s.confirmationBtn}
                onPress={() => {
                  setShowConfirmation(false);
                  router.push('/(tabs)/services?tab=transport' as any);
                }}
              >
                <Text style={s.confirmationBtnText}>Retour aux transports</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {transport.typeTransport === 'location' && (
        <MultiDatePickerModal
          visible={showDatePicker}
          selectedDates={selectedDates}
          availableDates={transport.datesDisponibles}
          onConfirm={setSelectedDates}
          onClose={() => setShowDatePicker(false)}
          title="Sélectionner les dates de location"
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  backBtn2: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', minWidth: 120 },
  backText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg },
  errorText: { fontSize: FontSize.lg, color: Colors.textSecondary },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  transportCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  routeSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  routeDepart: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  routeArrow: { fontSize: 20, color: Colors.textSecondary, marginVertical: 4 },
  routeArrivee: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  priceBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.primaryBorder },
  priceHT: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  priceTTC: { fontSize: FontSize.xs, color: Colors.primary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  field: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  minusBtn: { width: 44, height: 44, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  minusBtnText: { fontSize: 24, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  nbPlacesInput: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary, minWidth: 60, textAlign: 'center' },
  plusBtn: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  plusBtnText: { fontSize: 24, color: Colors.textInverse, fontWeight: FontWeight.bold },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  prixCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  prixRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prixLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  prixVal: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  prixTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs },
  prixTotalLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  prixTotalVal: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab },
  submitText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  confirmationBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  confirmationCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', marginHorizontal: Spacing.lg, ...Shadow.card },
  confirmationIcon: { fontSize: 64, marginBottom: Spacing.lg },
  confirmationTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  confirmationMessage: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  confirmationDetails: { width: '100%', backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg, gap: Spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  detailIcon: { fontSize: 18, width: 28 },
  detailText: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  confirmationButtons: { width: '100%', gap: Spacing.md },
  confirmationBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center' },
  confirmationBtnText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  datePickerBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing.md, backgroundColor: Colors.surface, alignItems: 'center' },
  datePickerBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  datePickerBtnText: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  datePickerBtnTextActive: { color: Colors.primary },
  datesListContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  dateTag: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.primary },
  dateTagText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
});
