-- ============================================================================
-- MIGRATION 009: Ajouter persistance des réservations et colonnes Stripe
-- ============================================================================

-- ============================================================================
-- 1. AJOUTER COLONNES STRIPE À USERS
-- ============================================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_account_status VARCHAR(50) DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS stripe_requirements_json JSONB,
ADD COLUMN IF NOT EXISTS stripe_last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_account_id ON users(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_payouts_enabled ON users(stripe_payouts_enabled);

-- ============================================================================
-- 2. TABLE PERSISTENTE POUR DEMANDES DE COURS (CourseDemande)
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_demands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Références
  annonce_id UUID NOT NULL REFERENCES coach_annonces(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cavalier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Infos demande
  title VARCHAR(255) NOT NULL,
  discipline VARCHAR(100),
  level VARCHAR(50),
  horse_name VARCHAR(100),
  message TEXT,
  
  -- Dates
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  nb_jours INT NOT NULL DEFAULT 1,
  
  -- Prix (HT + commission + TTC)
  price_per_day_ttc DECIMAL(10,2) NOT NULL,
  total_amount_ht DECIMAL(10,2) NOT NULL,
  platform_commission DECIMAL(10,2) NOT NULL,
  total_amount_ttc DECIMAL(10,2) NOT NULL,
  
  -- Statut
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'paid', 'completed', 'cancelled')),
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_course_demands_coach_id ON course_demands(coach_id);
CREATE INDEX IF NOT EXISTS idx_course_demands_cavalier_id ON course_demands(cavalier_id);
CREATE INDEX IF NOT EXISTS idx_course_demands_status ON course_demands(status);
CREATE INDEX IF NOT EXISTS idx_course_demands_annonce_id ON course_demands(annonce_id);

-- ============================================================================
-- 3. TABLE PERSISTENTE POUR RÉSERVATIONS DE STAGES (StageReservation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS stage_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Références
  stage_id UUID NOT NULL,
  coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cavalier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Infos réservation
  title VARCHAR(255) NOT NULL,
  nb_participants INT DEFAULT 1,
  message TEXT,
  
  -- Prix
  price_total_ht DECIMAL(10,2) NOT NULL,
  platform_commission DECIMAL(10,2) NOT NULL,
  price_total_ttc DECIMAL(10,2) NOT NULL,
  
  -- Statut
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'paid', 'completed', 'cancelled')),
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stage_reservations_coach_id ON stage_reservations(coach_id);
CREATE INDEX IF NOT EXISTS idx_stage_reservations_cavalier_id ON stage_reservations(cavalier_id);
CREATE INDEX IF NOT EXISTS idx_stage_reservations_status ON stage_reservations(status);

-- ============================================================================
-- 4. TABLE PAIEMENTS (Stripe + metadata)
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Références
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Type de paiement
  type VARCHAR(50) NOT NULL CHECK (type IN ('course', 'stage', 'transport', 'box')),
  
  -- Références métier
  course_demand_id UUID REFERENCES course_demands(id) ON DELETE SET NULL,
  stage_reservation_id UUID REFERENCES stage_reservations(id) ON DELETE SET NULL,
  
  -- Montants (tous en EUR, cents)
  amount_buyer_ttc INT NOT NULL,           -- Ce que paie l'acheteur (centimes)
  amount_platform_fee INT NOT NULL,       -- Commission plateforme (centimes)
  amount_seller_ht INT NOT NULL,          -- Ce que reçoit le vendeur HT (centimes)
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Commission (pour traçabilité)
  commission_rate DECIMAL(5,2) NOT NULL,   -- % commission (ex: 5.00)
  commission_amount INT NOT NULL,          -- Montant commission (centimes)
  
  -- Statut paiement
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'succeeded', 'failed', 'refunded', 'cancelled')),
  
  -- Références Stripe
  stripe_checkout_session_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  stripe_transfer_id VARCHAR(255),         -- Transfer au vendeur
  stripe_refund_id VARCHAR(255),
  
  -- Metadata brut Stripe
  stripe_metadata JSONB,
  
  -- Timestamps
  paid_at TIMESTAMP,
  refunded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_buyer_id ON payments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_payments_seller_id ON payments(seller_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON payments(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_course_demand ON payments(course_demand_id);
CREATE INDEX IF NOT EXISTS idx_payments_stage_reservation ON payments(stage_reservation_id);

-- ============================================================================
-- 5. TABLE WEBHOOK EVENTS (audit + idempotence)
-- ============================================================================

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identifiant Stripe
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  
  -- Payload
  event_payload JSONB NOT NULL,
  
  -- Traitement
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  error_message TEXT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);

-- ============================================================================
-- 6. TRIGGERS POUR updated_at
-- ============================================================================

CREATE TRIGGER update_course_demands_updated_at 
BEFORE UPDATE ON course_demands 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stage_reservations_updated_at 
BEFORE UPDATE ON stage_reservations 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at 
BEFORE UPDATE ON payments 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_webhook_events_updated_at 
BEFORE UPDATE ON stripe_webhook_events 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. COMMENTS POUR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE course_demands IS 'Demandes de cours persistantes - remplace le store en mémoire';
COMMENT ON COLUMN course_demands.price_per_day_ttc IS 'Prix par jour TTC proposé par le coach';
COMMENT ON COLUMN course_demands.total_amount_ht IS 'Montant total HT (avant commission/TVA plateforme)';
COMMENT ON COLUMN course_demands.platform_commission IS 'Commission plateforme calculée côté serveur';
COMMENT ON COLUMN course_demands.total_amount_ttc IS 'Montant total TTC que le cavalier paiera';

COMMENT ON TABLE stage_reservations IS 'Réservations de stages persistantes - remplace le store en mémoire';
COMMENT ON TABLE payments IS 'Table centralisée des paiements Stripe avec traçabilité complète';
COMMENT ON COLUMN payments.amount_buyer_ttc IS 'Montant que l''acheteur paie (en centimes, ex: 10050 = 100.50 EUR)';
COMMENT ON COLUMN payments.amount_seller_ht IS 'Montant que le vendeur reçoit HT (avant frais Stripe)';
COMMENT ON TABLE stripe_webhook_events IS 'Audit complet des webhooks Stripe pour idempotence et debug';

