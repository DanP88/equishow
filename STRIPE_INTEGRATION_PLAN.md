# Stripe Integration Implementation Plan
## Equishow Marketplace Payment System

**Status:** Critical Infrastructure ✓ | Full Implementation Plan Below  
**Last Updated:** April 15, 2026  
**Reversibility:** Full rollback via migration 009 DOWN

---

## 📋 Table of Contents
1. [Architecture & Justification](#1-architecture--justification)
2. [Complete Schema Documentation](#2-complete-schema-documentation)
3. [Files to Create/Modify](#3-files-to-createmodify)
4. [Environment Variables](#4-environment-variables)
5. [Backend: Edge Functions](#5-backend-edge-functions)
6. [Backend: Database Operations](#6-backend-database-operations)
7. [Frontend: UI Components](#7-frontend-ui-components)
8. [Webhook Handlers](#8-webhook-handlers)
9. [Seller Onboarding Flow](#9-seller-onboarding-flow)
10. [Buyer Payment Flow](#10-buyer-payment-flow)
11. [Test Checklist](#11-test-checklist)
12. [Production Deployment](#12-production-deployment)
13. [Reversibility & Rollback](#13-reversibility--rollback)

---

## 1. Architecture & Justification

### Why Stripe Connect + Checkout?

**Stripe Connect** (seller onboarding):
- ✅ Transfers money directly to seller bank accounts
- ✅ Handles regulatory/tax compliance per country
- ✅ Automatic payment scheduling
- ✅ Supports both Standard and Express accounts
- ✅ Built-in KYC/identity verification

**Stripe Checkout** (buyer payment):
- ✅ PCI-DSS compliant (no card data touches our servers)
- ✅ Supports 135+ payment methods
- ✅ Built-in fraud protection
- ✅ Automatic invoice/receipt emails
- ✅ Mobile-optimized checkout flow

**Why NOT Direct Transfers/Custom Payments?**
- ❌ PCI compliance complexity
- ❌ Manual KYC process = scaling nightmare
- ❌ No built-in fraud detection
- ❌ Regulatory compliance burden

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│ BUYER (Cavalier) - Expo App                             │
│ - Initiates course request / stage reservation          │
│ - View price breakdown (HT/TTC/Commission)              │
│ - Clicks "Confirmer & Payer"                            │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓ POST /create-checkout-session
        ┌──────────────────────────────────────┐
        │ Edge Function: create-checkout-session│
        │ - Fetch listing price from DB        │
        │ - Calculate amounts server-side      │
        │ - Call Stripe API                    │
        │ - Store in payments table            │
        │ - Return checkout URL                │
        └──────────────────┬───────────────────┘
                           │
                           ↓ stripe.com/pay/{SESSION_ID}
        ┌──────────────────────────────────────┐
        │ Stripe Checkout Page (Hosted)        │
        │ - Buyer enters payment method        │
        │ - 3D Secure / fraud checks           │
        │ - Automatic receipts                 │
        └──────────────────┬───────────────────┘
                           │
                           ↓ POST /webhook/stripe
        ┌──────────────────────────────────────┐
        │ Edge Function: webhook/stripe        │
        │ - Verify webhook signature           │
        │ - Idempotent processing              │
        │ - Update payment status              │
        │ - Create transfer to seller          │
        │ - Update demand/reservation status   │
        └──────────────────┬───────────────────┘
                           │
                ┌──────────┴──────────┐
                ↓                     ↓
        ┌─────────────────┐  ┌──────────────────┐
        │ SELLER BALANCE  │  │ BUYER RECEIPT    │
        │ (Stripe Account)│  │ (Email)          │
        └─────────────────┘  └──────────────────┘
```

### Commission Flow

```
Buyer Payment: 100€ TTC
    ├─ Net Price (HT): 83.33€
    ├─ Platform Commission (5%): 4.17€
    └─ VAT (20% on HT): 16.67€ (included in 100€)

Stripe Processing:
    ├─ Stripe Fee (~3% + 0.30€): ~3.30€ (charged to Equishow)
    └─ Net to Seller (79.16€) transferred to bank

Equishow Profit:
    = Platform Commission (4.17€) - Stripe Fee (3.30€)
    = 0.87€ per transaction
```

---

## 2. Complete Schema Documentation

### New Table: `stripe_accounts` (Users extensions)

```sql
-- Added to users table
stripe_account_id VARCHAR(255)               -- Stripe Account ID (acct_xxx)
stripe_onboarding_complete BOOLEAN DEFAULT false
stripe_details_submitted BOOLEAN DEFAULT false
stripe_charges_enabled BOOLEAN DEFAULT false  -- Can receive payments
stripe_payouts_enabled BOOLEAN DEFAULT false  -- Can transfer out
stripe_account_status VARCHAR(50)            -- 'active', 'pending', 'restricted'
stripe_requirements_json JSONB               -- Pending verification items
stripe_last_updated TIMESTAMP WITH TIME ZONE
```

### New Table: `course_demands`

```sql
id UUID PRIMARY KEY
annonce_id UUID NOT NULL (references coach_annonces)
coach_id UUID NOT NULL (references users)
cavalier_id UUID NOT NULL (references users)
title VARCHAR(255)                           -- e.g. "Cours dressage"
discipline VARCHAR(100)
level VARCHAR(100)
horse_name VARCHAR(255)
message TEXT
date_debut DATE
date_fin DATE
nb_jours INTEGER
price_per_day_ttc INTEGER                    -- In CENTS (e.g., 5000 = 50€)
total_amount_ht INTEGER                      -- HT in cents
platform_commission INTEGER                  -- Commission in cents
total_amount_ttc INTEGER                     -- TTC in cents
status VARCHAR(50)                           -- 'pending', 'accepted', 'rejected', 'paid', 'completed'
created_at TIMESTAMP WITH TIME ZONE
updated_at TIMESTAMP WITH TIME ZONE
```

### New Table: `stage_reservations`

```sql
id UUID PRIMARY KEY
stage_id UUID NOT NULL (references stages)
coach_id UUID NOT NULL (references users)
cavalier_id UUID NOT NULL (references users)
title VARCHAR(255)                           -- Stage name
nb_participants INTEGER
message TEXT
price_total_ht INTEGER                       -- HT in cents
platform_commission INTEGER                  -- Commission in cents
price_total_ttc INTEGER                      -- TTC in cents
status VARCHAR(50)                           -- 'pending', 'accepted', 'paid', 'completed'
created_at TIMESTAMP WITH TIME ZONE
updated_at TIMESTAMP WITH TIME ZONE
```

### New Table: `payments`

```sql
id UUID PRIMARY KEY
buyer_id UUID NOT NULL (references users)
seller_id UUID NOT NULL (references users)
type VARCHAR(50)                             -- 'course', 'stage', 'transport', 'box'
course_demand_id UUID (references course_demands)
stage_reservation_id UUID (references stage_reservations)
amount_buyer_ttc INTEGER                     -- What buyer paid (cents)
amount_platform_fee INTEGER                  -- Commission amount (cents)
amount_seller_ht INTEGER                     -- What seller gets after commission (cents)
currency VARCHAR(3) DEFAULT 'EUR'
commission_rate DECIMAL(5,2)                 -- 5.00 = 5%
payment_status VARCHAR(50)                   -- 'pending', 'succeeded', 'failed', 'refunded'
stripe_checkout_session_id VARCHAR(255)
stripe_payment_intent_id VARCHAR(255)
stripe_charge_id VARCHAR(255)
stripe_transfer_id VARCHAR(255)
stripe_refund_id VARCHAR(255)
stripe_metadata JSONB                        -- For tracking/debugging
paid_at TIMESTAMP WITH TIME ZONE
refunded_at TIMESTAMP WITH TIME ZONE
created_at TIMESTAMP WITH TIME ZONE
updated_at TIMESTAMP WITH TIME ZONE

-- Indexes
CREATE INDEX idx_payments_buyer_id ON payments(buyer_id)
CREATE INDEX idx_payments_seller_id ON payments(seller_id)
CREATE INDEX idx_payments_status ON payments(payment_status)
CREATE INDEX idx_payments_stripe_session ON payments(stripe_checkout_session_id)
```

### New Table: `stripe_webhook_events`

```sql
id UUID PRIMARY KEY
stripe_event_id VARCHAR(255) UNIQUE NOT NULL
event_type VARCHAR(100)                      -- 'charge.succeeded', 'transfer.created', etc
event_payload JSONB                          -- Full webhook payload
processed BOOLEAN DEFAULT false
processed_at TIMESTAMP WITH TIME ZONE
error_message TEXT
created_at TIMESTAMP WITH TIME ZONE

-- Index for deduplication
CREATE INDEX idx_webhook_stripe_event ON stripe_webhook_events(stripe_event_id)
```

---

## 3. Files to Create/Modify

### CREATE - New Files

```
supabase/functions/
├── create-checkout-session/
│   ├── index.ts                              ← Main checkout logic
│   └── deno.json
├── webhook-stripe/
│   ├── index.ts                              ← Webhook handler
│   └── deno.json
├── complete-seller-onboarding/
│   ├── index.ts                              ← Finalize seller setup
│   └── deno.json
├── check-seller-status/
│   ├── index.ts                              ← Check if ready to accept payments
│   └── deno.json
├── list-seller-transfers/
│   ├── index.ts                              ← For payout history
│   └── deno.json
└── process-refund/
    ├── index.ts                              ← Handle refunds
    └── deno.json

expo_app/
├── app/
│   ├── stripe-onboarding.tsx                 ← Seller onboarding redirect
│   └── checkout-success.tsx                  ← Payment confirmation page
├── components/
│   ├── StripeConnectButton.tsx              ← "Link Stripe Account" button
│   ├── SellerStatus.tsx                      ← Shows seller verification status
│   └── PaymentBreakdown.tsx                  ← Shows HT/Commission/VAT
└── hooks/
    ├── useStripeAccount.ts                   ← Manage seller account
    └── usePaymentCalculation.ts              ← Format amounts for display
```

### MODIFY - Existing Files

```
expo_app/data/store.ts
  - Replace in-memory courseDemandesStore with DB queries
  - Replace in-memory stageReservationsStore with DB queries
  
expo_app/app/reserver-coach.tsx
  - Call create-checkout-session instead of local calculation
  - Use PaymentBreakdown component
  - Redirect to Stripe Checkout URL
  
expo_app/app/reserver-stage.tsx
  - Similar changes as reserver-coach.tsx
  
expo_app/app/reserver-transport.tsx
  - Similar integration for transport payments
  
expo_app/app/reserver-box.tsx
  - Similar integration for box rentals
  
expo_app/app/proposer-coach-annonce.tsx
  - Show Stripe account status to seller
  - Alert if not onboarded yet
  
expo_app/components/CustomBottomBar.tsx
  - Add badge showing unread payment notifications
  
.env.local (create)
  - Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
  - Add SUPABASE_STRIPE_SECRET_KEY (backend only)
  - Add STRIPE_WEBHOOK_SECRET (backend only)
```

---

## 4. Environment Variables

### Frontend (.env.local) - Public

```env
# Existing
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# NEW - Stripe
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx
# or for testing: pk_test_xxxxxxxxxxxxxxxxxxxx
```

### Backend (Supabase Secrets) - Secret

```env
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
# or for testing: sk_test_xxxxxxxxxxxxxxxxxxxx

STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef
# Get from https://dashboard.stripe.com/webhooks after creating endpoint
```

### Setup Steps

1. Create Stripe account at https://stripe.com
2. Get publishable key: https://dashboard.stripe.com/apikeys
3. Get secret key: https://dashboard.stripe.com/apikeys (restricted key recommended)
4. Set webhook secret: https://dashboard.stripe.com/webhooks (endpoint: `{PROJECT_URL}/functions/v1/webhook-stripe`)
5. Add to Supabase: Project Settings → Edge Functions Secrets
6. Add to .env.local for Expo

---

## 5. Backend: Edge Functions

### A. `calculate-course-price` (Already Created) ✓

**Purpose:** Server-side price calculation (prevents frontend tampering)

**Implementation:** Already provided in conversation summary
- Fetches listing price from database
- Calculates HT from TTC
- Applies commission and VAT
- Returns breakdown for display

---

### B. `create-checkout-session` (NEW)

**Purpose:** Create Stripe Checkout session and store payment record

**Endpoint:** `POST /functions/v1/create-checkout-session`

**Request:**
```typescript
{
  demandId?: string;                    // For course_demands
  reservationId?: string;               // For stage_reservations
  type: 'course' | 'stage';             // Required
  // Amounts in cents
}
```

**Response:**
```typescript
{
  sessionId: string;                    // Stripe checkout session ID
  checkoutUrl: string;                  // URL to send buyer to
  paymentId: string;                    // Our internal payment ID
}
```

**Logic:**
1. Verify user is authenticated (buyer)
2. Fetch demand/reservation from database
3. Verify amount hasn't changed
4. Check seller has Stripe account
5. Create Stripe Checkout Session:
   - Line items with prices
   - Metadata includes our IDs
   - Success/cancel URLs
   - Restricted customer mode (one-time payment)
6. Create payment record in DB with `payment_status = 'pending'`
7. Return sessionId and Checkout URL

**Security Checks:**
- ✅ Verify buyer authentication
- ✅ Verify seller has Stripe account enabled
- ✅ Verify amount matches database (not user-submitted amount)
- ✅ Verify demand/reservation status is 'pending'

---

### C. `webhook-stripe` (NEW)

**Purpose:** Handle Stripe webhook events (idempotent)

**Endpoint:** `POST /functions/v1/webhook-stripe`

**Stripe Events to Handle:**
- `charge.succeeded` → Update payment status, create transfer
- `charge.failed` → Update payment status
- `charge.refunded` → Update payment status, refund database
- `transfer.created` → Log payout (informational)
- `transfer.paid` → Mark seller payout as complete

**Logic:**
1. Verify webhook signature (critical!)
2. Extract `stripe_event_id`
3. Check if already processed (idempotency):
   - Query `stripe_webhook_events` by `stripe_event_id`
   - If exists and `processed = true`, return 200 (already handled)
   - If exists with error, retry logic
4. Parse event type and payload
5. Handle each event:
   - **charge.succeeded:**
     - Find payment by `stripe_charge_id`
     - Update to `payment_status = 'succeeded'`
     - Update demand/reservation to `status = 'paid'`
     - Create Stripe Transfer to seller
     - Send notification to buyer + seller
   - **charge.failed:**
     - Update `payment_status = 'failed'`
     - Send email to buyer
   - **charge.refunded:**
     - Update `payment_status = 'refunded'`
     - Update demand/reservation to `status = 'cancelled'`
     - Send email to both parties
6. Mark event as processed in `stripe_webhook_events`
7. Return 200 OK

**Error Handling:**
- If processing fails, store error in `stripe_webhook_events.error_message`
- Set `processed = true` anyway (prevents infinite retries)
- Log to Sentry for monitoring
- Manual intervention via dashboard

---

### D. `complete-seller-onboarding` (NEW)

**Purpose:** Finalize seller account after Stripe redirect

**Endpoint:** `POST /functions/v1/complete-seller-onboarding`

**Context:** Called after seller returns from Stripe onboarding link (Stripe Express)

**Request:**
```typescript
{
  // No body needed - get seller ID from JWT
}
```

**Response:**
```typescript
{
  success: boolean;
  stripe_account_id?: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  pending_requirements?: string[];
}
```

**Logic:**
1. Get seller ID from JWT token
2. Call Stripe API: `GET /accounts/{stripe_account_id}`
3. Update user record:
   - `stripe_charges_enabled`: from Stripe response
   - `stripe_payouts_enabled`: from Stripe response
   - `stripe_account_status`: from Stripe response
   - `stripe_requirements_json`: from Stripe response
   - `stripe_last_updated`: now
   - `stripe_details_submitted`: true
4. Return current status

**Note:** Seller may still have pending requirements (identity verification, etc.) - this checks real-time status.

---

### E. `check-seller-status` (NEW)

**Purpose:** Check if seller can accept payments (real-time)

**Endpoint:** `GET /functions/v1/check-seller-status/{sellerId}`

**Response:**
```typescript
{
  has_account: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  pending_requirements: string[];
  status: 'ready' | 'pending' | 'restricted' | 'no_account';
}
```

**Logic:**
1. Fetch seller's stripe_account_id
2. If none, return `status = 'no_account'`
3. Call Stripe API to check current status
4. Update local cache if status changed
5. Return result

**Usage:** Before showing "Pay Now" button, check if seller is ready.

---

### F. `process-refund` (NEW)

**Purpose:** Handle refund requests (for cancellations)

**Endpoint:** `POST /functions/v1/process-refund`

**Request:**
```typescript
{
  paymentId: string;                    // UUID from payments table
  reason: string;                       // 'buyer_request', 'seller_cancel', etc
}
```

**Response:**
```typescript
{
  success: boolean;
  refund_id?: string;                   // Stripe refund ID
  refunded_amount: number;              // In cents
}
```

**Logic:**
1. Verify requester is buyer or seller of payment
2. Fetch payment record
3. Verify status is 'succeeded' (can't refund pending/failed)
4. Call Stripe API: Create Refund
5. Update payment record:
   - `payment_status = 'refunded'`
   - `stripe_refund_id`
   - `refunded_at = now`
6. Update demand/reservation to `status = 'cancelled'`
7. Send notifications

---

## 6. Backend: Database Operations

### Helper Functions (in Supabase SQL or as app utilities)

```typescript
// In supabase/functions/{function}/database.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

export async function createPaymentRecord(
  buyerId: string,
  sellerId: string,
  type: 'course' | 'stage',
  demandId: string | null,
  amounts: {
    buyer_ttc: number;      // cents
    commission: number;      // cents
    seller_ht: number;       // cents
  },
  stripeSessionId: string
) {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      type,
      course_demand_id: type === 'course' ? demandId : null,
      stage_reservation_id: type === 'stage' ? demandId : null,
      amount_buyer_ttc: amounts.buyer_ttc,
      amount_platform_fee: amounts.commission,
      amount_seller_ht: amounts.seller_ht,
      commission_rate: 5.0,
      payment_status: 'pending',
      stripe_checkout_session_id: stripeSessionId,
      stripe_metadata: {
        created_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();
    
  if (error) throw error;
  return data.id;
}

export async function updatePaymentStatus(
  paymentId: string,
  status: string,
  stripeData: {
    charge_id?: string;
    transfer_id?: string;
    refund_id?: string;
  }
) {
  const update: any = {
    payment_status: status,
    updated_at: new Date().toISOString(),
  };
  
  if (stripeData.charge_id) update.stripe_charge_id = stripeData.charge_id;
  if (stripeData.transfer_id) update.stripe_transfer_id = stripeData.transfer_id;
  if (stripeData.refund_id) {
    update.stripe_refund_id = stripeData.refund_id;
    update.refunded_at = new Date().toISOString();
  }
  
  const { error } = await supabase
    .from('payments')
    .update(update)
    .eq('id', paymentId);
    
  if (error) throw error;
}

export async function updateDemandStatus(
  demandId: string,
  status: string
) {
  const { error } = await supabase
    .from('course_demands')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', demandId);
    
  if (error) throw error;
}
```

---

## 7. Frontend: UI Components

### A. `PaymentBreakdown.tsx` (NEW)

Shows TTC/HT/Commission breakdown to buyer before payment.

```typescript
interface PaymentBreakdownProps {
  amountTtc: number;        // cents
  amountHt: number;         // cents
  commission: number;       // cents
  vat: number;              // cents
}

export function PaymentBreakdown({
  amountTtc,
  amountHt,
  commission,
  vat,
}: PaymentBreakdownProps) {
  const formatAmount = (cents: number) => {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Prix HT</Text>
        <Text style={styles.value}>{formatAmount(amountHt)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Commission (5%)</Text>
        <Text style={styles.value}>{formatAmount(commission)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>TVA (20%)</Text>
        <Text style={styles.value}>{formatAmount(vat)}</Text>
      </View>
      <View style={[styles.row, styles.total]}>
        <Text style={styles.totalLabel}>Total TTC</Text>
        <Text style={styles.totalValue}>{formatAmount(amountTtc)}</Text>
      </View>
    </View>
  );
}
```

### B. `StripeConnectButton.tsx` (NEW)

"Link your Stripe Account" button for sellers.

```typescript
interface StripeConnectButtonProps {
  sellerId: string;
  onSuccess?: () => void;
  disabled?: boolean;
}

export function StripeConnectButton({
  sellerId,
  onSuccess,
  disabled,
}: StripeConnectButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      // Step 1: Call Edge Function to create Stripe Connect link
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-stripe-onboarding-link`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ seller_id: sellerId }),
        }
      );

      const { onboarding_url } = await response.json();

      // Step 2: Open browser to Stripe onboarding
      await WebBrowser.openBrowserAsync(onboarding_url);

      // Step 3: When returns, check status
      setTimeout(() => {
        checkSellerStatus(sellerId);
        onSuccess?.();
      }, 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to start Stripe onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      onPress={handlePress}
      disabled={disabled || loading}
    >
      <Text style={styles.text}>
        {loading ? '⏳ Connexion en cours...' : '🔗 Lier mon compte Stripe'}
      </Text>
    </TouchableOpacity>
  );
}
```

### C. `SellerStatus.tsx` (NEW)

Shows seller's verification status and readiness to accept payments.

```typescript
interface SellerStatusProps {
  sellerId: string;
}

export function SellerStatus({ sellerId }: SellerStatusProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'pending' | 'no_account'>('loading');
  const [requirements, setRequirements] = useState<string[]>([]);

  useEffect(() => {
    checkStatus();
  }, [sellerId]);

  const checkStatus = async () => {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/check-seller-status/${sellerId}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    const data = await response.json();
    setStatus(data.status);
    setRequirements(data.pending_requirements);
  };

  if (status === 'ready') {
    return (
      <View style={[styles.container, styles.success]}>
        <Text style={styles.emoji}>✅</Text>
        <Text style={styles.text}>Compte Stripe prêt à recevoir des paiements</Text>
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={[styles.container, styles.warning]}>
        <Text style={styles.emoji}>⏳</Text>
        <Text style={styles.text}>Vérification en cours...</Text>
        {requirements.length > 0 && (
          <Text style={styles.details}>Éléments manquants: {requirements.join(', ')}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.error]}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={styles.text}>Compte Stripe non configuré</Text>
    </View>
  );
}
```

---

## 8. Webhook Handlers

### Complete Webhook Implementation

**Location:** `supabase/functions/webhook-stripe/index.ts`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import * as crypto from "https://deno.land/std@0.208.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "Content-Type",
};

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// ============================================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================================

async function verifyStripeSignature(
  body: string,
  signature: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(STRIPE_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const [timestamp, signedContent] = signature.split(",").map(item => item.split("=")[1]);
  const message = `${timestamp}.${body}`;

  const verified = await crypto.subtle.verify(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent),
    new TextEncoder().encode(message)
  );

  return verified;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

async function handleChargeSucceeded(event: any) {
  const charge = event.data.object;
  
  // Find payment by stripe_charge_id
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("*")
    .eq("stripe_charge_id", charge.id)
    .single();

  if (paymentError || !payment) {
    console.error("Payment not found for charge:", charge.id);
    return;
  }

  // Update payment status
  await supabase
    .from("payments")
    .update({
      payment_status: "succeeded",
      stripe_charge_id: charge.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  // Update demand or reservation status
  if (payment.course_demand_id) {
    await supabase
      .from("course_demands")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", payment.course_demand_id);
  } else if (payment.stage_reservation_id) {
    await supabase
      .from("stage_reservations")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", payment.stage_reservation_id);
  }

  // Create Stripe Transfer to seller (if seller has account)
  const { data: seller } = await supabase
    .from("users")
    .select("stripe_account_id")
    .eq("id", payment.seller_id)
    .single();

  if (seller?.stripe_account_id) {
    // Call Stripe to create transfer
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const transferResponse = await fetch("https://api.stripe.com/v1/transfers", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: payment.amount_seller_ht.toString(),
        currency: "eur",
        destination: seller.stripe_account_id,
        description: `Payment from Equishow - ${payment.id}`,
        metadata: {
          payment_id: payment.id,
          charge_id: charge.id,
        },
      }).toString(),
    });

    const transfer = await transferResponse.json();
    if (transfer.id) {
      await supabase
        .from("payments")
        .update({ stripe_transfer_id: transfer.id })
        .eq("id", payment.id);
    }
  }

  // Send notifications (to Expo app via push notifications or socket)
  // TODO: Implement push notification to buyer + seller
}

async function handleChargeFailed(event: any) {
  const charge = event.data.object;

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("stripe_charge_id", charge.id)
    .single();

  if (payment) {
    await supabase
      .from("payments")
      .update({
        payment_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    // Send email to buyer
    // TODO: Implement email notification
  }
}

async function handleChargeRefunded(event: any) {
  const charge = event.data.object;

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("stripe_charge_id", charge.id)
    .single();

  if (payment) {
    const firstRefund = charge.refunds?.data?.[0];
    await supabase
      .from("payments")
      .update({
        payment_status: "refunded",
        stripe_refund_id: firstRefund?.id,
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    // Update demand/reservation
    if (payment.course_demand_id) {
      await supabase
        .from("course_demands")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", payment.course_demand_id);
    }
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify signature
    const isValid = await verifyStripeSignature(body, signature);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(body);
    const stripeEventId = event.id;

    // ========================================================================
    // IDEMPOTENCY CHECK
    // ========================================================================

    const { data: existingEvent } = await supabase
      .from("stripe_webhook_events")
      .select("*")
      .eq("stripe_event_id", stripeEventId)
      .single();

    if (existingEvent?.processed) {
      // Already handled, return 200
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================================================
    // PROCESS EVENT
    // ========================================================================

    try {
      switch (event.type) {
        case "charge.succeeded":
          await handleChargeSucceeded(event);
          break;
        case "charge.failed":
          await handleChargeFailed(event);
          break;
        case "charge.refunded":
          await handleChargeRefunded(event);
          break;
        // Add more events as needed
      }

      // Mark as processed
      await supabase
        .from("stripe_webhook_events")
        .upsert({
          stripe_event_id: stripeEventId,
          event_type: event.type,
          event_payload: event,
          processed: true,
          processed_at: new Date().toISOString(),
        }, { onConflict: "stripe_event_id" });

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      // Store error but mark as processed to prevent infinite retries
      console.error("Webhook processing error:", error);
      
      await supabase
        .from("stripe_webhook_events")
        .upsert({
          stripe_event_id: stripeEventId,
          event_type: event.type,
          event_payload: event,
          processed: true,
          processed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : "Unknown error",
        }, { onConflict: "stripe_event_id" });

      return new Response(JSON.stringify({ error: "Processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
```

---

## 9. Seller Onboarding Flow

### Complete Seller Setup Flow

```
┌─────────────────────────────────────────┐
│ Coach's Profile or Settings Page        │
│ "Gérer les paiements" / "Stripe"        │
└────────────────┬────────────────────────┘
                 │
                 ↓
    ┌─────────────────────────────┐
    │ Show SellerStatus component  │
    │ - Not Setup / Pending / Ready│
    └────────────┬────────────────┘
                 │
           Is Ready? Yes → Skip to next
                 │
                 No ↓
    ┌─────────────────────────────────────┐
    │ Show StripeConnectButton             │
    │ "🔗 Lier mon compte Stripe"         │
    └────────────┬────────────────────────┘
                 │
                 ↓ User presses
    ┌─────────────────────────────────────┐
    │ Call create-stripe-onboarding-link   │
    │ - Get onboarding URL from backend    │
    └────────────┬────────────────────────┘
                 │
                 ↓
    ┌─────────────────────────────────────┐
    │ Open Browser to Stripe Express       │
    │ - Coach enters bank details          │
    │ - Verifies identity                  │
    │ - Agrees to terms                    │
    └────────────┬────────────────────────┘
                 │
                 ↓
    ┌─────────────────────────────────────┐
    │ Stripe redirects to app              │
    │ stripe-onboarding.tsx page           │
    └────────────┬────────────────────────┘
                 │
                 ↓
    ┌─────────────────────────────────────┐
    │ Call complete-seller-onboarding     │
    │ - Check current Stripe status        │
    │ - Update user record                 │
    └────────────┬────────────────────────┘
                 │
                 ↓
    ┌─────────────────────────────────────┐
    │ Show status                          │
    │ "✅ Prêt" or "⏳ Vérification..."   │
    │ "Vous pouvez maintenant recevoir     │
    │  des paiements"                      │
    └─────────────────────────────────────┘
```

### Implementation: `stripe-onboarding.tsx`

```typescript
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRoute, router } from 'expo-router';

export default function StripeOnboardingScreen() {
  const route = useRoute();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'success' | 'failed'>('loading');

  useEffect(() => {
    completeOnboarding();
  }, []);

  const completeOnboarding = async () => {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/complete-seller-onboarding`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setStatus('success');
      } else {
        setStatus('failed');
      }
    } catch (error) {
      setStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <>
          <Text style={styles.emoji}>⏳</Text>
          <Text style={styles.title}>Finalisation de votre compte Stripe...</Text>
        </>
      ) : status === 'success' ? (
        <>
          <Text style={styles.emoji}>✅</Text>
          <Text style={styles.title}>Prêt à recevoir des paiements!</Text>
          <Text style={styles.subtitle}>
            Vous pouvez maintenant accepter des demandes de cours et des réservations.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/(tabs)/coach-annonces')}
          >
            <Text style={styles.buttonText}>Retour aux annonces</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Vérification en cours...</Text>
          <Text style={styles.subtitle}>
            Stripe finalise votre compte. Vous recevrez un email de confirmation.
            En attendant, vous pouvez créer des annonces mais ne pourrez pas encore recevoir de paiements.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/(tabs)/coach-annonces')}
          >
            <Text style={styles.buttonText}>Retour</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
```

---

## 10. Buyer Payment Flow

### Complete Buyer Checkout Flow

```
┌──────────────────────────────────────┐
│ Reserver-Coach Screen                │
│ Shows: Course Details + Price         │
└────────────┬─────────────────────────┘
             │
             ↓
    ┌────────────────────────────────┐
    │ Show PaymentBreakdown component │
    │ - HT amount                     │
    │ - Commission (5%)               │
    │ - VAT (20%)                     │
    │ - Total TTC                     │
    └────────────┬────────────────────┘
             │
             ↓ User presses "Confirmer & Payer"
    ┌────────────────────────────────┐
    │ Call create-checkout-session    │
    │ Backend:                        │
    │ - Verify amount (from DB)       │
    │ - Create Stripe Checkout        │
    │ - Store payment record          │
    └────────────┬────────────────────┘
             │
             ↓
    ┌────────────────────────────────┐
    │ Open stripe.com checkout       │
    │ - Buyer enters card            │
    │ - 3D Secure if needed          │
    │ - Automatic receipt email      │
    └────────────┬────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ↓ Success     ↓ Cancel/Fail
    ┌──────────┐  ┌──────────────────┐
    │ Redirect │  │ Redirect to       │
    │ to /     │  │ checkout-failed   │
    │ checkout-│  │ Show error        │
    │ success  │  └──────────────────┘
    └────┬─────┘
         │
         ↓ Webhook processes payment
    ┌──────────────────────────────┐
    │ charge.succeeded event       │
    │ - Mark payment as succeeded  │
    │ - Transfer to seller         │
    │ - Send notifications         │
    └──────────────────────────────┘
```

### Implementation: `reserver-coach.tsx` (Modified)

Key changes:

```typescript
import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY } from '@env';
import { PaymentBreakdown } from '../../components/PaymentBreakdown';

export default function ReserverCoachScreen() {
  const [loading, setLoading] = useState(false);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown | null>(null);

  // ... existing code ...

  const handleReserveAndPay = async () => {
    setLoading(true);
    try {
      // Step 1: Create demand in database
      const demandResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/course_demands`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': EXPO_PUBLIC_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            annonce_id: annonceId,
            coach_id: coaching.coachId,
            cavalier_id: userStore.id,
            title: coaching.titre,
            discipline: coaching.discipline,
            level: coaching.niveau,
            horse_name: cavalierStore.selectedHorse?.nom,
            message: demandMessage,
            date_debut: selectedDates[0],
            date_fin: selectedDates[selectedDates.length - 1],
            nb_jours: selectedDates.length,
            status: 'pending',
          }),
        }
      );

      const demand = await demandResponse.json();

      // Step 2: Get payment breakdown from Edge Function
      const calculateResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/calculate-course-price`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            annonce_id: annonceId,
            nb_jours: selectedDates.length,
            commission_rate: 5,
          }),
        }
      );

      const breakdown = await calculateResponse.json();
      setPaymentBreakdown(breakdown);

      // Step 3: Create Checkout Session
      const checkoutResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            demandId: demand.id,
            type: 'course',
          }),
        }
      );

      const { checkoutUrl } = await checkoutResponse.json();

      // Step 4: Open Stripe Checkout
      await WebBrowser.openBrowserAsync(checkoutUrl);

    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer la réservation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView>
      {/* ... existing UI ... */}

      {paymentBreakdown && (
        <PaymentBreakdown
          amountTtc={paymentBreakdown.total_amount_ttc}
          amountHt={paymentBreakdown.total_amount_ht}
          commission={paymentBreakdown.platform_commission}
          vat={paymentBreakdown.vat_amount}
        />
      )}

      <TouchableOpacity
        style={styles.payButton}
        onPress={handleReserveAndPay}
        disabled={loading}
      >
        <Text style={styles.payButtonText}>
          {loading ? '⏳ Paiement...' : '✓ Confirmer & Payer'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

### Implementation: `checkout-success.tsx` (NEW)

```typescript
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRoute, router } from 'expo-router';

export default function CheckoutSuccessScreen() {
  const route = useRoute();
  const { sessionId } = route.params as any;
  const [confirming, setConfirming] = useState(true);

  useEffect(() => {
    confirmPayment();
  }, [sessionId]);

  const confirmPayment = async () => {
    try {
      // Verify payment succeeded
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/verify-payment/${sessionId}`,
        {
          headers: { 'Authorization': `Bearer ${authToken}` },
        }
      );

      const data = await response.json();
      setConfirming(false);

      if (data.status === 'succeeded') {
        // Success!
      } else {
        Alert.alert('Erreur', 'Le paiement n\'a pas abouti');
      }
    } catch (error) {
      setConfirming(false);
      Alert.alert('Erreur', 'Impossible de confirmer le paiement');
    }
  };

  return (
    <View style={styles.container}>
      {confirming ? (
        <>
          <Text style={styles.emoji}>✓</Text>
          <Text style={styles.title}>Paiement en cours de confirmation...</Text>
        </>
      ) : (
        <>
          <Text style={styles.emoji}>✅</Text>
          <Text style={styles.title}>Paiement confirmé!</Text>
          <Text style={styles.subtitle}>Vous recevrez un email de confirmation.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/(tabs)/coach-demandes')}
          >
            <Text style={styles.buttonText}>Voir mes demandes</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
```

---

## 11. Test Checklist

### Unit Tests

- [ ] **Price Calculation**
  - [ ] HT calculation from TTC
  - [ ] Commission on HT (5%)
  - [ ] VAT on HT (20%)
  - [ ] Total = HT + Commission + VAT

- [ ] **Webhook Idempotency**
  - [ ] Same webhook processed only once
  - [ ] Retry doesn't create duplicate transfers

- [ ] **Data Validation**
  - [ ] Invalid amounts rejected
  - [ ] Missing required fields caught
  - [ ] Negative amounts blocked

### Integration Tests

- [ ] **Seller Onboarding**
  - [ ] Stripe account created (✓ via Stripe API)
  - [ ] Account ID stored in database (✓)
  - [ ] Status updates after submission (✓)
  - [ ] Seller can see "Ready" status (✓)

- [ ] **Buyer Payment Flow**
  - [ ] Demand created in DB (✓)
  - [ ] Checkout session created (✓)
  - [ ] Correct amounts passed to Stripe (✓)
  - [ ] User redirected to Stripe (✓)
  - [ ] Payment intent created in DB (✓)

- [ ] **Webhook Processing**
  - [ ] charge.succeeded updates payment status (✓)
  - [ ] Transfer created to seller account (✓)
  - [ ] Demand marked as 'paid' (✓)
  - [ ] Seller notification sent (✓)
  - [ ] charge.failed updates payment (✓)
  - [ ] charge.refunded marks as refunded (✓)

- [ ] **Refund Flow**
  - [ ] Refund created in Stripe (✓)
  - [ ] Payment marked as refunded (✓)
  - [ ] Demand marked as cancelled (✓)
  - [ ] Money returned to buyer (✓)

### End-to-End Tests (Manual)

**Test Case 1: Complete Happy Path**
1. [ ] Coach signs up
2. [ ] Coach creates Stripe account (via StripeConnectButton)
3. [ ] Coach account shows "Ready" (via SellerStatus)
4. [ ] Cavalier browses coach's courses
5. [ ] Cavalier selects dates and presses "Confirmer & Payer"
6. [ ] PaymentBreakdown shown correctly
7. [ ] Redirected to Stripe Checkout
8. [ ] Enter test card: 4242 4242 4242 4242 (future date, any CVC)
9. [ ] Payment succeeds
10. [ ] Redirected to checkout-success
11. [ ] Cavalier sees "✅ Paiement confirmé"
12. [ ] Coach sees payment in coach-demandes
13. [ ] Check Stripe Dashboard - charge shows "Succeeded"
14. [ ] Check Supabase - payment record shows 'succeeded'
15. [ ] Check Supabase - course_demand shows status 'paid'

**Test Case 2: Seller Not Ready**
1. [ ] Coach with no Stripe account
2. [ ] Coach tries to create course demand
3. [ ] See message "Vous devez lier un compte Stripe"
4. [ ] Cannot proceed without Stripe

**Test Case 3: Refund Flow**
1. [ ] Complete Test Case 1
2. [ ] Coach cancels the course demand
3. [ ] Payment marked as refunded
4. [ ] Check Stripe - refund shows
5. [ ] Cavalier gets refund in 3-5 business days
6. [ ] Status shows "Cancelled" for both parties

**Test Case 4: Failed Payment**
1. [ ] Cavalier selects dates and presses "Confirmer & Payer"
2. [ ] Enter test card: 4000 0000 0000 0002 (decline)
3. [ ] Payment fails
4. [ ] See error message "Paiement refusé"
5. [ ] Can retry with different card

### Stripe Test Cards

```
Success:     4242 4242 4242 4242
Decline:     4000 0000 0000 0002
3D Secure:   4000 0025 0000 3155
```

---

## 12. Production Deployment

### Pre-Deployment Checklist

- [ ] **Stripe Account Setup**
  - [ ] Create Stripe account at stripe.com
  - [ ] Switch from Test to Live mode
  - [ ] Get Live publishable key (pk_live_xxx)
  - [ ] Get Live secret key (sk_live_xxx)
  - [ ] Setup webhook endpoint (https://yourapp.com/functions/v1/webhook-stripe)
  - [ ] Get webhook secret (whsec_xxx)
  - [ ] Enable Stripe Connect in Account Settings
  - [ ] Configure Express onboarding flow

- [ ] **Environment Variables**
  - [ ] Update .env.local with Live keys
  - [ ] Add Supabase function secrets
  - [ ] Verify no test keys in production

- [ ] **Database**
  - [ ] Run migration 009 (UP) in production Supabase
  - [ ] Verify all tables created
  - [ ] Verify indexes created
  - [ ] Check RLS policies

- [ ] **Edge Functions**
  - [ ] Deploy all functions to production
  - [ ] Test each function endpoint
  - [ ] Verify error handling

- [ ] **Frontend**
  - [ ] Build production APK/IPA
  - [ ] Verify links to checkout work
  - [ ] Test payment flow end-to-end
  - [ ] Verify notifications work

- [ ] **Monitoring**
  - [ ] Setup Sentry for error tracking
  - [ ] Setup Stripe event monitoring (Dashboard → Logs)
  - [ ] Setup database query logging
  - [ ] Create alerts for payment failures

### Deployment Steps

1. **Backup Production Database**
   ```bash
   # Via Supabase CLI
   supabase db pull --db-url postgresql://...
   ```

2. **Apply Migration to Production**
   ```bash
   supabase migrations push --linked
   # Or via Supabase UI: SQL Editor → paste migration 009 UP
   ```

3. **Deploy Edge Functions**
   ```bash
   supabase functions deploy calculate-course-price --no-verify-jwt
   supabase functions deploy create-checkout-session
   supabase functions deploy webhook-stripe
   supabase functions deploy complete-seller-onboarding
   supabase functions deploy check-seller-status
   supabase functions deploy process-refund
   ```

4. **Setup Stripe Webhook**
   - Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://{PROJECT_ID}.supabase.co/functions/v1/webhook-stripe`
   - Select events: `charge.succeeded`, `charge.failed`, `charge.refunded`
   - Get signing secret → Add to Supabase secrets

5. **Update Expo App**
   ```bash
   # Update .env.local with Live keys
   # Rebuild and publish
   eas build --platform ios --auto-submit
   eas build --platform android --auto-submit
   ```

6. **Test with Real Payments**
   - Have internal team test with real test cards
   - Process test refunds
   - Verify notifications sent

---

## 13. Reversibility & Rollback

### Full Rollback Process

If Stripe integration needs to be removed:

**Step 1: Stop Accepting Payments**
```sql
-- Disable checkout function (comment out in app)
-- Refund any pending payments
-- Notify users
```

**Step 2: Backup Data** (optional, for record-keeping)
```sql
-- Export payments table for archives
SELECT * FROM payments;
```

**Step 3: Run Rollback Migration**
```bash
# In Supabase SQL Editor:
supabase migration resolve 009 --revert
# Or manually paste 009_DOWN.sql content
```

This will:
- ✅ Drop all Stripe-related columns from users
- ✅ Drop course_demands table
- ✅ Drop stage_reservations table
- ✅ Drop payments table
- ✅ Drop stripe_webhook_events table
- ✅ Drop all indexes and triggers
- ✅ Return to pre-Stripe schema

**Step 4: Clean Up Code**
- Remove StripeConnectButton component
- Remove PaymentBreakdown component
- Remove create-checkout-session Edge Function
- Remove webhook-stripe Edge Function
- Revert reserver-coach.tsx to original
- Remove .env variables

**Step 5: Redeploy App**
- Build new APK/IPA without Stripe code
- Publish to app stores

### Why This is Safe

1. **Migration is atomic** - Either fully rolls back or fully applies
2. **No data migration loss** - Option to export before deletion
3. **Code is versioned** - Git history preserved
4. **Feature flag ready** - Can gate Stripe features behind boolean

---

## 📝 Summary

This implementation provides:

✅ **Secure** - Server-side price calculation, PCI compliance via Stripe  
✅ **Scalable** - Stripe handles compliance, KYC, regulatory requirements  
✅ **Reversible** - Complete rollback via migration 009 DOWN  
✅ **Transparent** - Clear payment breakdown for buyers  
✅ **Integrated** - Uses existing commission system (5%) and architecture  
✅ **Monitored** - Webhook audit trail, error logging, payment tracking  

---

## 🚀 Next Steps

1. Deploy migration 009 (UP)
2. Deploy all Edge Functions
3. Update frontend components
4. Test complete payment flow
5. Setup Stripe webhook
6. Monitor live payments
7. Celebrate! 🎉

---

**Questions?** Check the sections above for details on:
- `calculate-course-price` - Server-side math
- `create-checkout-session` - Payment initiation
- `webhook-stripe` - Payment confirmation
- Seller onboarding - Getting coaches ready
- Buyer checkout - Complete payment flow
