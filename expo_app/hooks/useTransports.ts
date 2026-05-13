import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { TransportAnnonce, TransportReservation } from '../types/service';

// ── DB row shapes (snake_case) ─────────────────────────────────────────────
interface TransportAnnonceRow {
  id: string;
  auteur_id: string | null;
  auteur_nom: string | null;
  auteur_pseudo: string | null;
  auteur_initiales: string | null;
  auteur_couleur: string | null;
  date_trajet: string | null;
  ville_depart: string;
  ville_arrivee: string | null;
  nb_places_total: number | null;
  nb_places_disponibles: number | null;
  prix_ht: number;
  price_per_km: number;
  concours: string | null;
  description: string | null;
  type_transport: string;
  adresse_van: string | null;
  start_lat: number | null;
  start_lng: number | null;
  adresse_arrivee: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
  heure_depart: string | null;
  aller_retour: boolean | null;
  date_retour: string | null;
  km_inclus: number | null;
  tarif_km_supplementaire: number | null;
  caution_reparation: number | null;
  caution_nettoyage: number | null;
  dates_disponibles: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

function rowToAnnonce(r: TransportAnnonceRow): TransportAnnonce {
  return {
    id: r.id,
    auteurId: r.auteur_id ?? '',
    auteurNom: r.auteur_nom ?? '',
    auteurPseudo: r.auteur_pseudo ?? '',
    auteurInitiales: r.auteur_initiales ?? '',
    auteurCouleur: r.auteur_couleur ?? '',
    dateTrajet: r.date_trajet ? new Date(r.date_trajet) : new Date(),
    villeDepart: r.ville_depart,
    villeArrivee: r.ville_arrivee ?? '',
    nbPlacesTotal: r.nb_places_total ?? 0,
    nbPlacesDisponibles: r.nb_places_disponibles ?? 0,
    prixHT: r.prix_ht,
    pricePerKm: r.price_per_km ?? undefined,
    concours: r.concours ?? undefined,
    description: r.description ?? undefined,
    typeTransport: (r.type_transport ?? 'trajet') as 'trajet' | 'location',
    adresseVan: r.adresse_van ?? undefined,
    startLat: r.start_lat ?? undefined,
    startLng: r.start_lng ?? undefined,
    adresseArrivee: r.adresse_arrivee ?? undefined,
    destinationLat: r.destination_lat ?? undefined,
    destinationLng: r.destination_lng ?? undefined,
    heureDepart: r.heure_depart ?? undefined,
    allerRetour: r.aller_retour ?? undefined,
    dateRetour: r.date_retour ? new Date(r.date_retour) : undefined,
    kmInclus: r.km_inclus ?? undefined,
    tarifKmSupplémentaire: r.tarif_km_supplementaire ?? undefined,
    cautionRéparation: r.caution_reparation ?? undefined,
    cautionNettoyage: r.caution_nettoyage ?? undefined,
    datesDisponibles: r.dates_disponibles ? r.dates_disponibles.map((d) => new Date(d)) : undefined,
  };
}

function annonceToRowPatch(a: Partial<TransportAnnonce>): Partial<TransportAnnonceRow> {
  const p: Partial<TransportAnnonceRow> = {};
  if (a.dateTrajet !== undefined)              p.date_trajet = a.dateTrajet.toISOString();
  if (a.villeDepart !== undefined)             p.ville_depart = a.villeDepart;
  if (a.villeArrivee !== undefined)            p.ville_arrivee = a.villeArrivee || null;
  if (a.nbPlacesTotal !== undefined)           p.nb_places_total = a.nbPlacesTotal;
  if (a.nbPlacesDisponibles !== undefined)     p.nb_places_disponibles = a.nbPlacesDisponibles;
  if (a.prixHT !== undefined)                  p.prix_ht = a.prixHT;
  if (a.pricePerKm !== undefined)              p.price_per_km = a.pricePerKm ?? 0;
  if (a.concours !== undefined)                p.concours = a.concours ?? null;
  if (a.description !== undefined)             p.description = a.description ?? null;
  if (a.typeTransport !== undefined)           p.type_transport = a.typeTransport;
  if (a.adresseVan !== undefined)              p.adresse_van = a.adresseVan ?? null;
  if (a.startLat !== undefined)                p.start_lat = a.startLat ?? null;
  if (a.startLng !== undefined)                p.start_lng = a.startLng ?? null;
  if (a.adresseArrivee !== undefined)          p.adresse_arrivee = a.adresseArrivee ?? null;
  if (a.destinationLat !== undefined)          p.destination_lat = a.destinationLat ?? null;
  if (a.destinationLng !== undefined)          p.destination_lng = a.destinationLng ?? null;
  if (a.heureDepart !== undefined)             p.heure_depart = a.heureDepart ?? null;
  if (a.allerRetour !== undefined)             p.aller_retour = a.allerRetour ?? null;
  if (a.dateRetour !== undefined)              p.date_retour = a.dateRetour ? a.dateRetour.toISOString() : null;
  if (a.kmInclus !== undefined)                p.km_inclus = a.kmInclus ?? null;
  if (a.tarifKmSupplémentaire !== undefined)   p.tarif_km_supplementaire = a.tarifKmSupplémentaire ?? null;
  if (a.cautionRéparation !== undefined)       p.caution_reparation = a.cautionRéparation ?? null;
  if (a.cautionNettoyage !== undefined)        p.caution_nettoyage = a.cautionNettoyage ?? null;
  if (a.datesDisponibles !== undefined) {
    p.dates_disponibles = a.datesDisponibles ? a.datesDisponibles.map((d) => d.toISOString().slice(0, 10)) : [];
  }
  return p;
}

interface AnnonceResult {
  data: TransportAnnonce | null;
  error: string | null;
}

// ── Hook : toutes les annonces transport (marketplace) ─────────────────────
export function useTransportAnnonces() {
  const channelId = useId();
  const [list, setList] = useState<TransportAnnonce[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error: qErr } = await supabase
      .from('transport_annonces')
      .select('*')
      .order('date_trajet', { ascending: false });
    if (qErr) {
      setError(qErr.message);
      setList([]);
    } else {
      setError(null);
      setList(((data ?? []) as TransportAnnonceRow[]).map(rowToAnnonce));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`transport-annonces-all-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transport_annonces' },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { transports: list, isLoading, error, reload: load };
}

// ── Hook : annonces du user courant + create/update/delete ─────────────────
export function useMyTransportAnnonces() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<TransportAnnonce[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setList([]);
      return;
    }
    setIsLoading(true);
    const { data, error: qErr } = await supabase
      .from('transport_annonces')
      .select('*')
      .eq('auteur_id', profile.id)
      .order('created_at', { ascending: false });
    if (qErr) {
      setError(qErr.message);
      setList([]);
    } else {
      setError(null);
      setList(((data ?? []) as TransportAnnonceRow[]).map(rowToAnnonce));
    }
    setIsLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`transport-annonces-${profile.id}-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transport_annonces',
          filter: `auteur_id=eq.${profile.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, load]);

  const createAnnonce = useCallback(
    async (input: Partial<TransportAnnonce>): Promise<AnnonceResult> => {
      if (!profile?.id) return { data: null, error: 'Non authentifié' };
      const patch = annonceToRowPatch(input);
      const { data, error: insErr } = await supabase
        .from('transport_annonces')
        .insert({
          auteur_id: profile.id,
          type_transport: input.typeTransport ?? 'trajet',
          ville_depart: input.villeDepart ?? '',
          prix_ht: input.prixHT ?? 0,
          price_per_km: input.pricePerKm ?? 0,
          ...patch,
        })
        .select('*')
        .single();
      if (insErr || !data) return { data: null, error: insErr?.message ?? 'Erreur création' };
      return { data: rowToAnnonce(data as TransportAnnonceRow), error: null };
    },
    [profile?.id],
  );

  const updateAnnonce = useCallback(
    async (id: string, updates: Partial<TransportAnnonce>): Promise<AnnonceResult> => {
      const patch = annonceToRowPatch(updates);
      const { data, error: upErr } = await supabase
        .from('transport_annonces')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (upErr || !data) return { data: null, error: upErr?.message ?? 'Erreur mise à jour' };
      return { data: rowToAnnonce(data as TransportAnnonceRow), error: null };
    },
    [],
  );

  const deleteAnnonce = useCallback(async (id: string): Promise<{ error: string | null }> => {
    const { error: dErr } = await supabase.from('transport_annonces').delete().eq('id', id);
    return { error: dErr?.message ?? null };
  }, []);

  return {
    annonces: list,
    isLoading,
    error,
    createAnnonce,
    updateAnnonce,
    deleteAnnonce,
    reload: load,
  };
}

// ── DB row : transport_reservations ────────────────────────────────────────
interface TransportReservationRow {
  id: string;
  transport_id: string | null;
  seller_id: string | null;
  buyer_id: string | null;
  titre: string | null;
  ville_depart: string | null;
  ville_arrivee: string | null;
  nb_places: number | null;
  message: string | null;
  prix_total_ht: number;
  commission_plateforme: number;
  prix_total_ttc: number;
  statut: string | null;
  date_creation: string | null;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_source: string | null;
  distance_owner_to_pickup_km: number | null;
  distance_pickup_to_destination_km: number | null;
  total_distance_km: number | null;
  estimated_duration_minutes: number | null;
  price_per_km_snapshot: number | null;
  calculated_transport_price: number | null;
  final_price: number | null;
  route_provider: string | null;
  route_snapshot_json: unknown;
  route_pricing_status: string | null;
}

function rowToReservation(r: TransportReservationRow): TransportReservation {
  return {
    id: r.id,
    transportId: r.transport_id ?? '',
    sellerId: r.seller_id ?? '',
    buyerId: r.buyer_id ?? '',
    titre: r.titre ?? '',
    villeDepart: r.ville_depart ?? '',
    villeArrivee: r.ville_arrivee ?? '',
    nbPlaces: r.nb_places ?? 1,
    message: r.message ?? '',
    prixTotalHT: r.prix_total_ht,
    commissionPlateform: r.commission_plateforme,
    prixTotalTTC: r.prix_total_ttc,
    statut: (r.statut ?? 'pending') as TransportReservation['statut'],
    dateCreation: r.date_creation ? new Date(r.date_creation) : new Date(),
    pickupAddress: r.pickup_address ?? undefined,
    pickupLat: r.pickup_lat ?? undefined,
    pickupLng: r.pickup_lng ?? undefined,
    pickupSource: (r.pickup_source ?? undefined) as TransportReservation['pickupSource'],
    distanceOwnerToPickupKm: r.distance_owner_to_pickup_km ?? undefined,
    distancePickupToDestinationKm: r.distance_pickup_to_destination_km ?? undefined,
    totalDistanceKm: r.total_distance_km ?? undefined,
    estimatedDurationMinutes: r.estimated_duration_minutes ?? undefined,
    pricePerKmSnapshot: r.price_per_km_snapshot ?? undefined,
    calculatedTransportPrice: r.calculated_transport_price ?? undefined,
    finalPrice: r.final_price ?? undefined,
    routeProvider: r.route_provider ?? undefined,
    routeSnapshotJson: r.route_snapshot_json ?? undefined,
    routePricingStatus: (r.route_pricing_status ?? undefined) as TransportReservation['routePricingStatus'],
  };
}

export interface CreateTransportReservationInput {
  transportId: string;
  sellerId: string;
  titre: string;
  villeDepart: string;
  villeArrivee: string;
  nbPlaces: number;
  message: string;
  prixTotalHT: number;
  commissionPlateform: number;
  prixTotalTTC: number;
  // Route snapshot (optionnel)
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupSource?: 'manual' | 'geolocation';
  distanceOwnerToPickupKm?: number;
  distancePickupToDestinationKm?: number;
  totalDistanceKm?: number;
  estimatedDurationMinutes?: number;
  pricePerKmSnapshot?: number;
  calculatedTransportPrice?: number;
  finalPrice?: number;
  routeProvider?: string;
  routeSnapshotJson?: unknown;
  routePricingStatus?: 'pending' | 'calculated' | 'skipped';
}

// ── Hook : réservations transport pour le user courant (buyer + seller) ────
export function useMyTransportReservations() {
  const { profile } = useAuth();
  const channelId = useId();
  const [list, setList] = useState<TransportReservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setList([]);
      return;
    }
    setIsLoading(true);
    const { data, error: qErr } = await supabase
      .from('transport_reservations')
      .select('*')
      .or(`buyer_id.eq.${profile.id},seller_id.eq.${profile.id}`)
      .order('date_creation', { ascending: false });
    if (qErr) {
      setError(qErr.message);
      setList([]);
    } else {
      setError(null);
      setList(((data ?? []) as TransportReservationRow[]).map(rowToReservation));
    }
    setIsLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    // Realtime : 2 filtres (buyer/seller). Supabase ne supporte pas OR dans filter,
    // donc on s'abonne à toute la table et on reload — la RLS borne déjà côté DB.
    const channel = supabase
      .channel(`transport-reservations-${profile.id}-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transport_reservations' },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, load]);

  const createReservation = useCallback(
    async (input: CreateTransportReservationInput): Promise<{ data: TransportReservation | null; error: string | null }> => {
      if (!profile?.id) return { data: null, error: 'Non authentifié' };
      const { data, error: insErr } = await supabase
        .from('transport_reservations')
        .insert({
          transport_id: input.transportId,
          buyer_id: profile.id,
          seller_id: input.sellerId,
          titre: input.titre,
          ville_depart: input.villeDepart,
          ville_arrivee: input.villeArrivee,
          nb_places: input.nbPlaces,
          message: input.message,
          prix_total_ht: input.prixTotalHT,
          commission_plateforme: input.commissionPlateform,
          prix_total_ttc: input.prixTotalTTC,
          statut: 'pending',
          pickup_address: input.pickupAddress ?? null,
          pickup_lat: input.pickupLat ?? null,
          pickup_lng: input.pickupLng ?? null,
          pickup_source: input.pickupSource ?? null,
          distance_owner_to_pickup_km: input.distanceOwnerToPickupKm ?? null,
          distance_pickup_to_destination_km: input.distancePickupToDestinationKm ?? null,
          total_distance_km: input.totalDistanceKm ?? null,
          estimated_duration_minutes: input.estimatedDurationMinutes ?? null,
          price_per_km_snapshot: input.pricePerKmSnapshot ?? null,
          calculated_transport_price: input.calculatedTransportPrice ?? null,
          final_price: input.finalPrice ?? null,
          route_provider: input.routeProvider ?? null,
          route_snapshot_json: input.routeSnapshotJson ?? null,
          route_pricing_status: input.routePricingStatus ?? null,
        })
        .select('*')
        .single();
      if (insErr || !data) return { data: null, error: insErr?.message ?? 'Erreur création' };
      return { data: rowToReservation(data as TransportReservationRow), error: null };
    },
    [profile?.id],
  );

  const updateStatut = useCallback(
    async (id: string, statut: TransportReservation['statut']): Promise<{ error: string | null }> => {
      const { error: upErr } = await supabase
        .from('transport_reservations')
        .update({ statut })
        .eq('id', id);
      return { error: upErr?.message ?? null };
    },
    [],
  );

  return {
    reservations: list,
    isLoading,
    error,
    createReservation,
    updateStatut,
    reload: load,
  };
}
