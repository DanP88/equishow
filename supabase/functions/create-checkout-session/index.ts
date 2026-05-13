import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

// Audit P1+P2+P3 :
// - JWT obligatoire (P3)
// - montants & seller chargés depuis la DB, pas du body (P1)
// - row `payments` insérée AVANT Stripe pour que le webhook puisse la retrouver (P2)
// - métadonnées Stripe portent payment_id pour matcher dans charge.metadata
// - Stripe Connect Option A : transfer_data.destination + application_fee_amount
//   pour que le seller soit crédité atomiquement par Stripe.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://equishow.vercel.app";

type CheckoutType = "course" | "box" | "stage" | "transport";

interface ItemConfig {
  table: string;
  buyerCol: string;
  sellerCol: string;
  htCol: string;
  ttcCol: string;
  feeCol: string;
  fkCol: keyof PaymentInsert;
}

interface PaymentInsert {
  buyer_id: string;
  seller_id: string;
  type: CheckoutType;
  course_demand_id?: string | null;
  stage_reservation_id?: string | null;
  box_reservation_id?: string | null;
  transport_reservation_id?: string | null;
  amount_buyer_ttc: number;
  amount_platform_fee: number;
  amount_seller_ht: number;
  currency: string;
  commission_rate: number;
  commission_amount: number;
  payment_status: string;
}

const ITEM_CONFIG: Record<CheckoutType, ItemConfig> = {
  course: {
    table: "course_demands",
    buyerCol: "cavalier_id",
    sellerCol: "coach_id",
    htCol: "total_amount_ht",
    ttcCol: "total_amount_ttc",
    feeCol: "platform_commission",
    fkCol: "course_demand_id",
  },
  stage: {
    table: "stage_reservations",
    buyerCol: "cavalier_id",
    sellerCol: "coach_id",
    htCol: "price_total_ht",
    ttcCol: "price_total_ttc",
    feeCol: "platform_commission",
    fkCol: "stage_reservation_id",
  },
  box: {
    table: "box_reservations",
    buyerCol: "buyer_id",
    sellerCol: "seller_id",
    htCol: "price_total_ht",
    ttcCol: "price_total_ttc",
    feeCol: "platform_commission",
    fkCol: "box_reservation_id",
  },
  transport: {
    table: "transport_reservations",
    buyerCol: "buyer_id",
    sellerCol: "seller_id",
    htCol: "prix_total_ht",
    ttcCol: "prix_total_ttc",
    feeCol: "commission_plateforme",
    fkCol: "transport_reservation_id",
  },
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function eurToCents(eur: number): number {
  return Math.round(Number(eur) * 100);
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. AuthN obligatoire (P3) ────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // ── 2. Parsing & validation body ────────────────────────────────────
    const body = await req.json();
    const { type, demandId, reservationId, description } = body as {
      type?: CheckoutType;
      demandId?: string;
      reservationId?: string;
      description?: string;
    };

    if (!type || !ITEM_CONFIG[type]) {
      return jsonResponse({ error: "Invalid type" }, 400);
    }
    const itemId = type === "course" ? demandId : reservationId;
    if (!itemId) {
      return jsonResponse({ error: "Missing item id" }, 400);
    }

    const cfg = ITEM_CONFIG[type];

    // ── 3. Charger l'item depuis la DB (source unique de vérité) (P1) ───
    const { data: item, error: itemErr } = await supabase
      .from(cfg.table)
      .select("*")
      .eq("id", itemId)
      .maybeSingle();

    if (itemErr || !item) {
      return jsonResponse({ error: "Item not found" }, 404);
    }

    // ── 4. Verif ownership : le buyer doit être le caller ───────────────
    const buyerId = item[cfg.buyerCol] as string | null;
    const sellerId = item[cfg.sellerCol] as string | null;
    if (!buyerId || !sellerId) {
      return jsonResponse({ error: "Item has no buyer/seller" }, 400);
    }
    if (buyerId !== user.id) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    // ── 5. Lire les montants strictement depuis la row DB ───────────────
    const totalHt = Number(item[cfg.htCol]);
    const totalTtc = Number(item[cfg.ttcCol]);
    const platformCommission = Number(item[cfg.feeCol]);
    if (!isFinite(totalTtc) || totalTtc <= 0) {
      return jsonResponse({ error: "Invalid item amount" }, 400);
    }

    const amountBuyerCents = eurToCents(totalTtc);
    const amountSellerCents = eurToCents(totalHt);
    const platformFeeCents = eurToCents(platformCommission);
    if (platformFeeCents > amountBuyerCents) {
      return jsonResponse({ error: "Inconsistent amounts" }, 400);
    }
    const commissionRatePct = totalHt > 0
      ? Math.round((platformCommission / totalHt) * 10000) / 100
      : 0;

    // ── 6. Charger le compte Stripe du seller ───────────────────────────
    const { data: seller, error: sellerErr } = await supabase
      .from("users")
      .select("id, stripe_account_id, stripe_charges_enabled")
      .eq("id", sellerId)
      .maybeSingle();

    if (sellerErr || !seller) {
      return jsonResponse({ error: "Seller not found" }, 404);
    }

    // En mode test Stripe (`sk_test_*`), on autorise un seller sans compte
    // Connect configuré — le paiement se fait sans transfer_data, ce qui
    // permet de tester le flow E2E sans onboarding réel.
    const isStripeTestMode = STRIPE_SECRET_KEY.startsWith("sk_test_");
    const sellerHasConnect = !!seller.stripe_account_id && !!seller.stripe_charges_enabled;

    if (!isStripeTestMode && !sellerHasConnect) {
      return jsonResponse(
        { error: "Le vendeur n'a pas finalisé ses paiements." },
        409
      );
    }

    // ── 7. Insérer row payments (status pending) AVANT Stripe (P2) ──────
    const paymentRow: PaymentInsert = {
      buyer_id: user.id,
      seller_id: sellerId,
      type,
      [cfg.fkCol]: itemId,
      amount_buyer_ttc: amountBuyerCents,
      amount_platform_fee: platformFeeCents,
      amount_seller_ht: amountSellerCents,
      currency: "EUR",
      commission_rate: commissionRatePct,
      commission_amount: platformFeeCents,
      payment_status: "pending",
    };

    const { data: paymentInserted, error: paymentInsertErr } = await supabase
      .from("payments")
      .insert(paymentRow)
      .select("id")
      .single();

    if (paymentInsertErr || !paymentInserted) {
      console.error("Payment insert failed");
      return jsonResponse({ error: "Could not create payment record" }, 500);
    }

    const paymentId: string = paymentInserted.id;

    // ── 8. Créer la session Stripe ──────────────────────────────────────
    const formData = new URLSearchParams();
    formData.append("mode", "payment");
    formData.append("payment_method_types[]", "card");
    formData.append("success_url", `${APP_URL}/checkout-success?session_id={CHECKOUT_SESSION_ID}`);
    formData.append("cancel_url", `${APP_URL}/cancelled`);
    if (user.email) formData.append("customer_email", user.email);

    formData.append("line_items[0][price_data][currency]", "eur");
    formData.append(
      "line_items[0][price_data][product_data][name]",
      description?.slice(0, 250) || `Equishow ${type}`
    );
    formData.append("line_items[0][price_data][unit_amount]", String(amountBuyerCents));
    formData.append("line_items[0][quantity]", "1");

    // Stripe Connect Option A : transfer auto + application_fee.
    // Skip si test mode et seller pas onboardé → paiement direct (testable).
    if (sellerHasConnect) {
      formData.append(
        "payment_intent_data[transfer_data][destination]",
        seller.stripe_account_id!,
      );
      formData.append(
        "payment_intent_data[application_fee_amount]",
        String(platformFeeCents)
      );
    }

    // Métadonnées indispensables pour le webhook
    formData.append("payment_intent_data[metadata][payment_id]", paymentId);
    formData.append("payment_intent_data[metadata][type]", type);
    formData.append("payment_intent_data[metadata][buyer_id]", user.id);
    formData.append("payment_intent_data[metadata][seller_id]", sellerId);
    formData.append("metadata[payment_id]", paymentId);
    formData.append("metadata[type]", type);

    const stripeResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
    const stripeData = await stripeResp.json();

    if (!stripeResp.ok) {
      console.error("Stripe session create failed:", stripeData?.error?.code);
      // Cleanup : supprimer la row payments orpheline
      await supabase.from("payments").delete().eq("id", paymentId);
      return jsonResponse(
        { error: stripeData?.error?.message ?? "Stripe error" },
        400
      );
    }

    // ── 9. Marquer le payment avec l'id de session Stripe ───────────────
    await supabase
      .from("payments")
      .update({
        stripe_checkout_session_id: stripeData.id,
        stripe_metadata: { session_object: { id: stripeData.id } },
      })
      .eq("id", paymentId);

    return jsonResponse(
      {
        sessionId: stripeData.id,
        checkoutUrl: stripeData.url,
        paymentId,
      },
      200
    );
  } catch (error) {
    console.error("create-checkout-session error:",
      error instanceof Error ? error.message : "unknown");
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
}

Deno.serve(handler);
