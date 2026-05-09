-- ============================================================
-- 004_route_pricing.sql
-- Module : calcul de trajet routier pour les annonces transport
-- ============================================================
-- SQL UP (run this to enable)
-- SQL DOWN at the bottom (prefixed with -- DOWN:)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLE : transport_annonces
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transport_annonces (
  id                    TEXT PRIMARY KEY,
  auteur_id             UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type_transport        TEXT NOT NULL CHECK (type_transport IN ('trajet', 'location')),
  ville_depart          TEXT NOT NULL,
  ville_arrivee         TEXT,
  date_trajet           TIMESTAMPTZ,
  heure_depart          TEXT,
  aller_retour          BOOLEAN DEFAULT FALSE,
  date_retour           TIMESTAMPTZ,
  nb_places_total       INTEGER,
  nb_places_disponibles INTEGER,
  prix_ht               NUMERIC(10,2),
  concours              TEXT,
  description           TEXT,
  adresse_van           TEXT,

  -- Route pricing fields
  start_address         TEXT,
  start_lat             DOUBLE PRECISION,
  start_lng             DOUBLE PRECISION,
  destination_address   TEXT,
  destination_lat       DOUBLE PRECISION,
  destination_lng       DOUBLE PRECISION,
  price_per_km          NUMERIC(10,2),

  -- Location-only fields
  km_inclus             INTEGER,
  tarif_km_supplementaire NUMERIC(10,2),
  caution_reparation    NUMERIC(10,2),
  caution_nettoyage     NUMERIC(10,2),

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- TABLE : transport_reservations
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transport_reservations (
  id                               TEXT PRIMARY KEY,
  transport_id                     TEXT REFERENCES public.transport_annonces(id) ON DELETE SET NULL,
  seller_id                        UUID REFERENCES public.profiles(id),
  buyer_id                         UUID REFERENCES public.profiles(id),
  titre                            TEXT,
  ville_depart                     TEXT,
  ville_arrivee                    TEXT,
  nb_places                        INTEGER DEFAULT 1,
  message                          TEXT,
  prix_total_ht                    NUMERIC(10,2),
  commission_plateforme            NUMERIC(10,2),
  prix_total_ttc                   NUMERIC(10,2),
  statut                           TEXT DEFAULT 'pending'
                                     CHECK (statut IN ('pending','accepted','rejected','awaiting_payment','paid')),

  -- Route pricing snapshot (frozen at reservation time)
  pickup_address                   TEXT,
  pickup_lat                       DOUBLE PRECISION,
  pickup_lng                       DOUBLE PRECISION,
  pickup_source                    TEXT DEFAULT 'manual'
                                     CHECK (pickup_source IN ('manual','geolocation')),
  distance_owner_to_pickup_km      NUMERIC(10,2),
  distance_pickup_to_destination_km NUMERIC(10,2),
  total_distance_km                NUMERIC(10,2),
  estimated_duration_minutes       INTEGER,
  price_per_km_snapshot            NUMERIC(10,2),
  calculated_transport_price       NUMERIC(10,2),
  final_price                      NUMERIC(10,2),
  route_provider                   TEXT DEFAULT 'openrouteservice',
  route_snapshot_json              JSONB,
  route_pricing_status             TEXT DEFAULT 'pending'
                                     CHECK (route_pricing_status IN ('pending','calculated','skipped')),

  date_creation                    TIMESTAMPTZ DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.transport_annonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_reservations ENABLE ROW LEVEL SECURITY;

-- Annonces : lecture publique, écriture propriétaire
CREATE POLICY "transport_annonces_select_all"
  ON public.transport_annonces FOR SELECT USING (true);
CREATE POLICY "transport_annonces_insert_own"
  ON public.transport_annonces FOR INSERT WITH CHECK (auteur_id = auth.uid());
CREATE POLICY "transport_annonces_update_own"
  ON public.transport_annonces FOR UPDATE USING (auteur_id = auth.uid());
CREATE POLICY "transport_annonces_delete_own"
  ON public.transport_annonces FOR DELETE USING (auteur_id = auth.uid());

-- Réservations : visible par acheteur et vendeur uniquement
CREATE POLICY "transport_reservations_select_own"
  ON public.transport_reservations FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE POLICY "transport_reservations_insert_buyer"
  ON public.transport_reservations FOR INSERT
  WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "transport_reservations_update_parties"
  ON public.transport_reservations FOR UPDATE
  USING (seller_id = auth.uid() OR buyer_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- DOWN (rollback — exécuter manuellement si besoin)
-- ────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.transport_reservations;
-- DROP TABLE IF EXISTS public.transport_annonces;
