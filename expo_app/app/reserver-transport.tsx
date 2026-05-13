import { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { userStore, supabase } from '../data/store';
import { useTransportAnnonces, useMyTransportReservations } from '../hooks/useTransports';
import { createNotification } from '../hooks/useNotifications';
import { prixTTC, getCommissionMontant, getCommission } from '../types/service';
import { MultiDatePickerModal } from '../components/DatePickerModal';
import { AddressAutocomplete } from '../components/AddressAutocomplete';

const ROUTE_PRICING_ENABLED = process.env.EXPO_PUBLIC_ENABLE_ROUTE_PRICING === 'true';

interface RouteResult {
  distanceOwnerToPickupKm: number;
  distancePickupToDestinationKm: number;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  pricePerKm: number;
  totalPrice: number;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  routeSnapshotJson: unknown;
}

export default function ReserverTransportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transports } = useTransportAnnonces();
  const { createReservation } = useMyTransportReservations();
  const transport = transports.find((t) => t.id === id);

  const [nbPlaces, setNbPlaces] = useState(1);
  const [message, setMessage] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  // Route pricing state
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupSource, setPickupSource] = useState<'manual' | 'geolocation'>('manual');
  const [geoLoading, setGeoLoading] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  const geoCoords = useRef<{ lat: number; lng: number } | null>(null);

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

  if (!transport.typeTransport) {
    transport.typeTransport = 'trajet';
  }

  const ttc = prixTTC(transport.prixHT);
  const isTrajet = transport.typeTransport === 'trajet';
  const showRoutePricing = isTrajet && ROUTE_PRICING_ENABLED;

  // ─── Prix ────────────────────────────────────────────────────────────────────
  let prixTotal = 0;
  let prixTotalTTC = 0;
  let nombreJours = 1;

  // Multiplicateur A/R appliqué côté FRONT seulement quand routeResult absent.
  // Quand routeResult est présent, l'Edge calculate-route-price a déjà inclus
  // le ×2 dans totalPrice (anti-fraud server-side).
  const tripMultiplierFallback = isTrajet && transport.allerRetour ? 2 : 1;

  if (!isTrajet && selectedDates.length > 0) {
    nombreJours = selectedDates.length;
    prixTotal = transport.prixHT * nombreJours;
    prixTotalTTC = prixTotal;
  } else if (isTrajet) {
    if (routeResult) {
      prixTotal = routeResult.totalPrice * nbPlaces;
      prixTotalTTC = prixTotal;
    } else {
      prixTotal = transport.prixHT * nbPlaces * tripMultiplierFallback;
      prixTotalTTC = prixTotal;
    }
  }

  // ─── Géolocalisation ─────────────────────────────────────────────────────────
  function handleUseLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setRouteError('Géolocalisation non supportée par ce navigateur. Saisissez votre adresse manuellement.');
      return;
    }
    setGeoLoading(true);
    setRouteError(null);
    setRouteResult(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        geoCoords.current = { lat, lng };
        setPickupSource('geolocation');
        setPickupAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        // Reverse geocoding pour afficher le nom du lieu en dessous
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`,
            { headers: { 'User-Agent': 'Equishow/1.0' } }
          );
          if (r.ok) {
            const geo = await r.json();
            const a = geo.address ?? {};
            const lieu = a.suburb ?? a.neighbourhood ?? a.village ?? a.town ?? a.city ?? '';
            const cp = a.postcode ? a.postcode.slice(0, 5) : '';
            const ville = a.city ?? a.town ?? a.village ?? '';
            let label = '';
            if (lieu && ville && lieu !== ville) label = `${lieu}, ${ville}${cp ? ' ' + cp : ''}`;
            else if (ville) label = `${ville}${cp ? ' ' + cp : ''}`;
            if (label) setGeoLabel(label);
          }
        } catch { /* ignore */ }
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        geoCoords.current = null;
        setPickupSource('manual');
        if (err.code === 1 /* PERMISSION_DENIED */) {
          setRouteError('Autorisation refusée, saisissez votre adresse manuellement.');
        } else {
          setRouteError('Position impossible à récupérer, saisissez votre adresse manuellement.');
        }
      },
      { timeout: 10000, enableHighAccuracy: false },
    );
  }

  function resetGeo() {
    setPickupSource('manual');
    setPickupAddress('');
    setGeoLabel(null);
    setRouteResult(null);
    setRouteError(null);
    geoCoords.current = null;
  }

  // ─── Calcul du prix ──────────────────────────────────────────────────────────
  async function handleCalculatePrice() {
    if (pickupSource === 'manual' && !pickupAddress.trim()) {
      setRouteError('Veuillez saisir votre adresse de prise en charge.');
      return;
    }
    setCalcLoading(true);
    setRouteError(null);
    setRouteResult(null);

    try {
      // Edge function durcie (P22) : on n'envoie plus pricePerKm/adresses depuis le
      // client. Le serveur recharge tout depuis transport_annonces via transportId.
      const payload: Record<string, unknown> = { transportId: transport.id, pickupSource };
      if (geoCoords.current) {
        payload.pickupLat = geoCoords.current.lat;
        payload.pickupLng = geoCoords.current.lng;
      } else {
        payload.pickupAddress = pickupAddress.trim();
      }

      const { data: { session } } = await supabase.auth.getSession();
      const userToken = session?.access_token;
      if (!userToken) {
        setRouteError('Session expirée, veuillez vous reconnecter.');
        return;
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const resp = await fetch(`${supabaseUrl}/functions/v1/calculate-route-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok || data?.error) throw new Error(data?.error ?? `Erreur ${resp.status}`);

      setRouteResult(data as RouteResult);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible de calculer le trajet pour le moment.';
      setRouteError(msg);
    } finally {
      setCalcLoading(false);
    }
  }

  // Sur web, Alert.alert est silencieux → on bascule sur window.alert.
  function showErr(msg: string) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(msg);
    else Alert.alert('Erreur', msg);
  }

  // ─── Soumission ──────────────────────────────────────────────────────────────
  async function submit() {
    if (!isTrajet) {
      if (selectedDates.length === 0) {
        showErr('Veuillez sélectionner au moins 1 jour.');
        return;
      }
    } else {
      if (nbPlaces < 1 || nbPlaces > transport.nbPlacesDisponibles) {
        showErr(`Sélectionnez entre 1 et ${transport.nbPlacesDisponibles} place(s).`);
        return;
      }
      if (showRoutePricing && !routeResult) {
        showErr('Veuillez d\'abord calculer le prix de votre trajet (bouton "Calculer mon prix").');
        return;
      }
    }

    const routeSnapshot = routeResult
      ? {
          pickupAddress: routeResult.pickupAddress,
          pickupLat: routeResult.pickupLat,
          pickupLng: routeResult.pickupLng,
          pickupSource,
          distanceOwnerToPickupKm: routeResult.distanceOwnerToPickupKm,
          distancePickupToDestinationKm: routeResult.distancePickupToDestinationKm,
          totalDistanceKm: routeResult.totalDistanceKm,
          estimatedDurationMinutes: routeResult.estimatedDurationMinutes,
          pricePerKmSnapshot: routeResult.pricePerKm,
          calculatedTransportPrice: routeResult.totalPrice,
          finalPrice: prixTotalTTC,
          routeProvider: 'openrouteservice',
          routeSnapshotJson: routeResult.routeSnapshotJson,
          routePricingStatus: 'calculated' as const,
        }
      : { routePricingStatus: 'skipped' as const };

    const titre = `Transport ${transport.villeDepart} → ${transport.villeArrivee}`;

    const { data: created, error: createErr } = await createReservation({
      transportId: transport.id,
      sellerId: transport.auteurId,
      titre,
      villeDepart: transport.villeDepart,
      villeArrivee: transport.villeArrivee,
      nbPlaces: isTrajet ? nbPlaces : 1,
      message: message.trim(),
      prixTotalHT: prixTotal,
      commissionPlateform: prixTotal * 0.05,
      prixTotalTTC,
      ...routeSnapshot,
    });

    if (createErr || !created) {
      showErr(createErr ?? 'Impossible de créer la réservation.');
      return;
    }

    const transportRef = `EQ-TRP-${created.id.replace(/[^A-Z0-9]/gi, '').substring(0, 8).toUpperCase()}`;

    await createNotification({
      destinataireId: transport.auteurId,
      type: 'reservation_request',
      titre: '🚐 Nouvelle réservation de transport',
      message: `${userStore.prenom} ${userStore.nom} demande une réservation pour ${transport.villeDepart} → ${transport.villeArrivee}`,
      status: 'pending',
      actionUrl: '/transport-pending-demands',
      donnees: {
        transportId: transport.id,
        titre,
        prix: prixTotalTTC,
        message: message.trim(),
      },
    });

    // Montant final = backend price (déjà × 2 côté Edge si A/R) × nbPlaces.
    const montantPaiement = routeResult
      ? (routeResult.totalPrice * nbPlaces).toFixed(2)
      : prixTotalTTC.toFixed(2);

    router.push({
      pathname: '/paiement-transport',
      params: {
        reservationId: created.id,
        titre,
        montant: montantPaiement,
        nbPlaces: String(created.nbPlaces),
        villeDepart: transport.villeDepart,
        villeArrivee: transport.villeArrivee,
        reference: transportRef,
      },
    } as any);
  }

  const datesDispoAvailableForSelection = (transport.datesDisponibles || [])
    .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()));

  const canSubmit = isTrajet
    ? (!showRoutePricing || routeResult !== null)
    : selectedDates.length > 0;

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

        {/* Récap annonce */}
        <View style={s.transportCard}>
          <View style={s.routeSection}>
            <View>
              <Text style={s.routeDepart}>{transport.villeDepart}</Text>
              <Text style={s.routeArrow}>↓</Text>
              <Text style={s.routeArrivee}>{transport.villeArrivee}</Text>
            </View>
            <View style={s.priceBadge}>
              {!isTrajet ? (
                <>
                  <Text style={s.priceHT}>{transport.prixHT}€/jour TTC</Text>
                  <Text style={s.priceTTC}>km inclus: {transport.kmInclus}</Text>
                </>
              ) : showRoutePricing ? (
                <>
                  <Text style={s.priceHT}>{transport.pricePerKm ?? 0.8}€/km</Text>
                  <Text style={s.priceTTC}>prix au kilomètre</Text>
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
            <Text style={s.infoLabel}>📅 {!isTrajet ? 'Type' : 'Date'}</Text>
            <Text style={s.infoValue}>
              {!isTrajet ? 'Location du transport seul' : transport.dateTrajet.toLocaleDateString('fr-FR')}
            </Text>
          </View>
          {isTrajet && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>🐴 Places restantes</Text>
              <Text style={s.infoValue}>{transport.nbPlacesDisponibles}/{transport.nbPlacesTotal}</Text>
            </View>
          )}
          {!isTrajet && (
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

        {/* Nombre de places (trajet) */}
        {isTrajet && (
          <View style={s.field}>
            <Text style={s.fieldLabel}>Nombre de places</Text>
            <View style={s.row}>
              <TouchableOpacity style={s.minusBtn} onPress={() => setNbPlaces(Math.max(1, nbPlaces - 1))}>
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
        )}

        {/* Dates (location) */}
        {!isTrajet && (
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

        {/* ─── MODULE ROUTE PRICING (trajets uniquement) ─────────────────── */}
        {showRoutePricing && (
          <View style={s.routePricingCard}>
            <Text style={s.routePricingTitle}>📍 Votre adresse de prise en charge</Text>
            <Text style={s.routePricingHint}>
              Le prix est calculé sur la distance totale : propriétaire → vous → concours.
            </Text>

            {/* Champ adresse */}
            <View
              // @ts-ignore — title devient un tooltip HTML sur le web
              title={pickupSource === 'geolocation' && pickupAddress
                ? `${pickupAddress}${geoLabel ? '\n' + geoLabel : ''}`
                : undefined}
            >
              <AddressAutocomplete
                value={pickupAddress}
                onChange={(addr, lat, lng) => {
                  setPickupAddress(addr);
                  setPickupSource('manual');
                  setRouteResult(null);
                  setRouteError(null);
                  geoCoords.current = lat != null && lng != null ? { lat, lng } : null;
                }}
                placeholder="Ex: 12 rue du Moulin, 38000 Grenoble"
                disabled={pickupSource === 'geolocation'}
              />

              {/* Nom du lieu détecté */}
              {geoLabel && (
                <Text style={s.geoLabelText}>📍 {geoLabel}</Text>
              )}
            </View>

            {/* Bouton géolocalisation */}
            <TouchableOpacity
              style={[s.geoBtn, geoLoading && s.geoBtnDisabled]}
              onPress={handleUseLocation}
              disabled={geoLoading}
              activeOpacity={0.8}
            >
              {geoLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={s.geoBtnText}>📍 Utiliser ma position actuelle</Text>
              )}
            </TouchableOpacity>

            {/* Reset géo */}
            {pickupSource === 'geolocation' && (
              <TouchableOpacity onPress={resetGeo} activeOpacity={0.7}>
                <Text style={s.resetGeoText}>✕ Saisir une adresse manuellement</Text>
              </TouchableOpacity>
            )}

            {/* Message d'erreur */}
            {routeError && (
              <View style={s.routeErrorBox}>
                <Text style={s.routeErrorText}>{routeError}</Text>
              </View>
            )}

            {/* Bouton calcul */}
            <TouchableOpacity
              style={[s.calcBtn, (!pickupAddress.trim() || calcLoading) && s.calcBtnDisabled]}
              onPress={handleCalculatePrice}
              disabled={!pickupAddress.trim() || calcLoading}
              activeOpacity={0.85}
            >
              {calcLoading ? (
                <View style={s.calcBtnInner}>
                  <ActivityIndicator size="small" color={Colors.textInverse} />
                  <Text style={s.calcBtnText}>Calcul en cours...</Text>
                </View>
              ) : (
                <Text style={s.calcBtnText}>Calculer mon prix</Text>
              )}
            </TouchableOpacity>

            {/* Résultat */}
            {routeResult && (
              <View style={s.routeResultCard}>
                <Text style={s.routeResultTitle}>Estimation du trajet</Text>

                <View style={s.routeResultRow}>
                  <Text style={s.routeResultLabel}>Propriétaire → vous</Text>
                  <Text style={s.routeResultVal}>{routeResult.distanceOwnerToPickupKm} km</Text>
                </View>
                <View style={s.routeResultRow}>
                  <Text style={s.routeResultLabel}>Vous → concours</Text>
                  <Text style={s.routeResultVal}>{routeResult.distancePickupToDestinationKm} km</Text>
                </View>
                <View style={[s.routeResultRow, s.routeResultDivider]}>
                  <Text style={s.routeResultLabelBold}>Distance totale</Text>
                  <Text style={s.routeResultValBold}>{routeResult.totalDistanceKm} km</Text>
                </View>
                <View style={s.routeResultRow}>
                  <Text style={s.routeResultLabel}>Durée estimée</Text>
                  <Text style={s.routeResultVal}>{routeResult.estimatedDurationMinutes} min</Text>
                </View>
                <View style={s.routeResultRow}>
                  <Text style={s.routeResultLabel}>Prix au km</Text>
                  <Text style={s.routeResultVal}>{routeResult.pricePerKm.toFixed(2)} €</Text>
                </View>
                {nbPlaces > 1 && (
                  <View style={s.routeResultRow}>
                    <Text style={s.routeResultLabel}>Prix × {nbPlaces} places</Text>
                    <Text style={s.routeResultVal}>{(routeResult.totalPrice * nbPlaces).toFixed(2)} €</Text>
                  </View>
                )}
                <View style={[s.routeResultRow, s.routeResultTotal]}>
                  <Text style={s.routeResultTotalLabel}>Prix total</Text>
                  <Text style={s.routeResultTotalVal}>
                    {(routeResult.totalPrice * nbPlaces).toFixed(2)} €
                  </Text>
                </View>
                <Text style={s.routeResultNote}>
                  * Ce prix sera confirmé avant le paiement.
                </Text>
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

        {/* Récap prix */}
        <View style={s.prixCard}>
          {!isTrajet ? (
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
          ) : showRoutePricing ? (
            routeResult ? (
              <>
                <View style={s.prixRow}>
                  <Text style={s.prixLabel}>Distance totale</Text>
                  <Text style={s.prixVal}>{routeResult.totalDistanceKm} km</Text>
                </View>
                <View style={s.prixRow}>
                  <Text style={s.prixLabel}>Prix au km</Text>
                  <Text style={s.prixVal}>{routeResult.pricePerKm.toFixed(2)}€</Text>
                </View>
                <View style={s.prixRow}>
                  <Text style={s.prixLabel}>× {nbPlaces} place(s)</Text>
                  <Text style={s.prixVal}>{prixTotalTTC.toFixed(2)}€</Text>
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
            ) : (
              <View style={s.prixPlaceholder}>
                <Text style={s.prixPlaceholderText}>
                  Calculez votre trajet ci-dessus pour voir le prix.
                </Text>
              </View>
            )
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

        {/* Bouton soumettre — toujours cliquable, submit() affiche un alert si calc manquant */}
        <TouchableOpacity
          style={[s.submitBtn, (showRoutePricing && !routeResult) && s.submitBtnDisabled]}
          onPress={submit}
          activeOpacity={0.85}
        >
          <Text style={s.submitText}>
            {showRoutePricing && !routeResult
              ? 'Calculez votre trajet pour continuer'
              : 'Valider la demande et payer...'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal confirmation */}
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
              {!isTrajet ? (
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
                    <Text style={s.detailText}>{prixTotalTTC.toFixed(2)}€ TTC (à confirmer)</Text>
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

      {!isTrajet && (
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  backBtn2: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4, alignItems: 'center', minWidth: 120,
  },
  backText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg },
  errorText: { fontSize: FontSize.lg, color: Colors.textSecondary },
  container: { padding: Spacing.lg, gap: Spacing.lg },

  // Transport card
  transportCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.card,
  },
  routeSection: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.md,
  },
  routeDepart: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  routeArrow: { fontSize: 20, color: Colors.textSecondary, marginVertical: 4 },
  routeArrivee: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  priceBadge: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  priceHT: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  priceTTC: { fontSize: FontSize.xs, color: Colors.primary },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  infoLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },

  // Champs
  field: { gap: Spacing.sm },
  fieldLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  minusBtn: {
    width: 44, height: 44, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  minusBtnText: { fontSize: 24, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  nbPlacesInput: {
    fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary,
    minWidth: 60, textAlign: 'center',
  },
  plusBtn: {
    width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  plusBtnText: { fontSize: 24, color: Colors.textInverse, fontWeight: FontWeight.bold },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface,
  },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  inputGeo: { borderColor: Colors.success, backgroundColor: '#F0FDF4', color: Colors.textSecondary },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  // Route pricing module
  routePricingCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.primaryBorder, gap: Spacing.md,
  },
  routePricingTitle: {
    fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary,
  },
  routePricingHint: {
    fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18,
  },
  geoBtn: {
    borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2, alignItems: 'center',
    backgroundColor: Colors.primaryLight, minHeight: 42, justifyContent: 'center',
  },
  geoBtnDisabled: { opacity: 0.5 },
  geoBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  resetGeoText: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center' },
  geoLabelText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 4 },
  routeErrorBox: {
    backgroundColor: '#FEF2F2', borderRadius: Radius.md, padding: Spacing.sm,
    borderWidth: 1, borderColor: '#FECACA',
  },
  routeErrorText: { fontSize: FontSize.sm, color: '#DC2626' },
  calcBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, alignItems: 'center', minHeight: 48,
    justifyContent: 'center',
  },
  calcBtnDisabled: { opacity: 0.4 },
  calcBtnInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  calcBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },

  // Résultat route
  routeResultCard: {
    backgroundColor: '#F0FDF4', borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: '#86EFAC', gap: Spacing.sm,
  },
  routeResultTitle: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  routeResultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  routeResultDivider: {
    borderTopWidth: 1, borderTopColor: '#86EFAC', paddingTop: Spacing.sm, marginTop: 2,
  },
  routeResultLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  routeResultVal: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  routeResultLabelBold: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  routeResultValBold: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  routeResultTotal: {
    borderTopWidth: 1, borderTopColor: '#86EFAC', paddingTop: Spacing.sm, marginTop: 2,
  },
  routeResultTotalLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  routeResultTotalVal: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.success },
  routeResultNote: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic' },

  // Prix récap
  prixCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  prixRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prixLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  prixVal: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  prixTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs },
  prixTotalLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  prixTotalVal: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.primary },
  prixPlaceholder: { paddingVertical: Spacing.md, alignItems: 'center' },
  prixPlaceholderText: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center' },

  // Submit
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },

  // Modal confirmation
  confirmationBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  confirmationCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl,
    alignItems: 'center', marginHorizontal: Spacing.lg, ...Shadow.card,
  },
  confirmationIcon: { fontSize: 64, marginBottom: Spacing.lg },
  confirmationTitle: {
    fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary,
    marginBottom: Spacing.sm, textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg,
  },
  confirmationDetails: {
    width: '100%', backgroundColor: Colors.background, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.lg, gap: Spacing.sm,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  detailIcon: { fontSize: 18, width: 28 },
  detailText: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  confirmationButtons: { width: '100%', gap: Spacing.md },
  confirmationBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 4, alignItems: 'center',
  },
  confirmationBtnText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },

  // Dates location
  datePickerBtn: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface, alignItems: 'center',
  },
  datePickerBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  datePickerBtnText: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  datePickerBtnTextActive: { color: Colors.primary },
  datesListContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  dateTag: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.primary,
  },
  dateTagText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
});
