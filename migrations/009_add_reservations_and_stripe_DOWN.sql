-- ============================================================================
-- ROLLBACK MIGRATION 009
-- ============================================================================

-- Supprimer les triggers
DROP TRIGGER IF EXISTS update_stripe_webhook_events_updated_at ON stripe_webhook_events;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS update_stage_reservations_updated_at ON stage_reservations;
DROP TRIGGER IF EXISTS update_course_demands_updated_at ON course_demands;

-- Supprimer les tables
DROP TABLE IF EXISTS stripe_webhook_events CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS stage_reservations CASCADE;
DROP TABLE IF EXISTS course_demands CASCADE;

-- Supprimer colonnes Stripe de users
ALTER TABLE users
DROP COLUMN IF EXISTS stripe_last_updated,
DROP COLUMN IF EXISTS stripe_requirements_json,
DROP COLUMN IF EXISTS stripe_account_status,
DROP COLUMN IF EXISTS stripe_payouts_enabled,
DROP COLUMN IF EXISTS stripe_charges_enabled,
DROP COLUMN IF EXISTS stripe_details_submitted,
DROP COLUMN IF EXISTS stripe_onboarding_complete,
DROP COLUMN IF EXISTS stripe_account_id;

