/**
 * Types pour les structures de base de données Stripe
 * Ces types correspondent aux tables dans Supabase
 */

// ============================================================================
// DATABASE TYPES - course_demands
// ============================================================================

export interface CourseDemandDB {
  id: string;
  annonce_id: string;
  coach_id: string;
  cavalier_id: string;
  title: string;
  discipline: string;
  level: string;
  horse_name: string;
  message: string;
  date_debut: string; // Date ISO
  date_fin: string;   // Date ISO
  nb_jours: number;
  price_per_day_ttc: number; // In cents (e.g., 5000 = 50€)
  total_amount_ht: number;
  platform_commission: number;
  total_amount_ttc: number;
  status: 'pending' | 'accepted' | 'rejected' | 'paid' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DATABASE TYPES - stage_reservations
// ============================================================================

export interface StageReservationDB {
  id: string;
  stage_id: string;
  coach_id: string;
  cavalier_id: string;
  title: string;
  nb_participants: number;
  message: string;
  price_total_ht: number;
  platform_commission: number;
  price_total_ttc: number;
  status: 'pending' | 'accepted' | 'paid' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DATABASE TYPES - payments
// ============================================================================

export interface PaymentDB {
  id: string;
  buyer_id: string;
  seller_id: string;
  type: 'course' | 'stage' | 'transport' | 'box';
  course_demand_id: string | null;
  stage_reservation_id: string | null;
  amount_buyer_ttc: number; // In cents
  amount_platform_fee: number; // In cents
  amount_seller_ht: number; // In cents
  currency: string; // 'eur'
  commission_rate: number; // 5.00 = 5%
  payment_status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_refund_id: string | null;
  stripe_metadata: Record<string, any> | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface CreateCheckoutSessionResponse {
  sessionId: string;
  checkoutUrl: string;
  paymentId: string;
}

export interface VerifyCheckoutSessionResponse {
  id: string;
  payment_status: string;
  type: string;
  amount_buyer_ttc: number;
  amount_seller_ht: number;
  amount_platform_fee: number;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  paid_at: string | null;
}

export interface CreateStripeOnboardingLinkResponse {
  onboarding_url: string;
  stripe_account_id: string;
}

export interface CompleteSellerOnboardingResponse {
  success: boolean;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  status: string;
  pending_requirements: string[];
  message: string;
}

export interface CheckSellerStatusResponse {
  has_account: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  pending_requirements: string[];
  status: 'ready' | 'pending' | 'restricted' | 'no_account';
}

export interface CalculateCoursePrice {
  price_per_day_ttc: number;
  total_amount_ht: number;
  platform_commission: number;
  total_amount_ttc: number;
  commission_rate: number;
  vat_amount: number;
}

export interface ProcessRefundResponse {
  success: boolean;
  refund_id: string;
  refunded_amount: number;
  status: string;
  message: string;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Helper pour convertir de cents à euros
 */
export function centsToEuros(cents: number): number {
  return cents / 100;
}

/**
 * Helper pour convertir d'euros à cents
 */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

/**
 * Helper pour formater une quantité d'argent
 */
export function formatMoney(cents: number, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(centsToEuros(cents));
}
