import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface CheckoutRequest {
  demandId?: string;
  reservationId?: string;
  type: 'course' | 'stage';
}

interface CheckoutResponse {
  sessionId: string;
  checkoutUrl: string;
  paymentId: string;
}

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// ============================================================================
// HELPER: Serialize nested objects to form-urlencoded for Stripe
// ============================================================================

function serializeForStripe(obj: any, prefix = ""): URLSearchParams {
  const params = new URLSearchParams();

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const fullKey = prefix ? `${prefix}[${key}]` : key;

      if (value === null || value === undefined) {
        continue;
      } else if (Array.isArray(value)) {
        // Handle arrays
        value.forEach((item, index) => {
          const arrayKey = `${fullKey}[${index}]`;
          if (typeof item === "object" && item !== null) {
            const nested = serializeForStripe(item, arrayKey);
            nested.forEach((v, k) => params.append(k, v));
          } else {
            params.append(arrayKey, String(item));
          }
        });
      } else if (typeof value === "object") {
        // Handle nested objects
        const nested = serializeForStripe(value, fullKey);
        nested.forEach((v, k) => params.append(k, v));
      } else {
        // Handle primitives
        params.append(fullKey, String(value));
      }
    }
  }

  return params;
}

// ============================================================================
// HELPER: Fetch from Stripe API
// ============================================================================

async function callStripeAPI(
  endpoint: string,
  method: string = "POST",
  data?: Record<string, any>
): Promise<any> {
  const url = `https://api.stripe.com/v1${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };

  if (data) {
    options.body = serializeForStripe(data).toString();
  }

  const response = await fetch(url, options);
  return response.json();
}

// ============================================================================
// HANDLER
// ============================================================================

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Parse request
    const body: CheckoutRequest = await req.json();

    if (!body.type || !((body.demandId && body.type === 'course') || (body.reservationId && body.type === 'stage'))) {
      return new Response(
        JSON.stringify({
          error: "Missing or invalid: demandId/reservationId and type",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // Initialize Supabase
    // ========================================================================

    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 1: Fetch demand/reservation from database
    // ========================================================================

    let demandData: any;
    let sellerId: string;

    if (body.type === 'course') {
      const { data, error } = await supabase
        .from("course_demands")
        .select("*")
        .eq("id", body.demandId)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Course demand not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      demandData = data;
      sellerId = data.coach_id;

      // Verify buyer is the one making the request
      if (data.cavalier_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: not the buyer" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify status is pending
      if (data.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: "Demand is not pending" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      const { data, error } = await supabase
        .from("stage_reservations")
        .select("*")
        .eq("id", body.reservationId)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Stage reservation not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      demandData = data;
      sellerId = data.coach_id;

      if (data.cavalier_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: not the buyer" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (data.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: "Reservation is not pending" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========================================================================
    // STEP 2: Verify seller has Stripe account enabled
    // ========================================================================

    const { data: seller, error: sellerError } = await supabase
      .from("users")
      .select("stripe_account_id, stripe_charges_enabled")
      .eq("id", sellerId)
      .single();

    if (sellerError || !seller) {
      return new Response(
        JSON.stringify({ error: "Seller not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!seller.stripe_account_id || !seller.stripe_charges_enabled) {
      return new Response(
        JSON.stringify({
          error: "Seller is not ready to accept payments",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 3: Create Stripe Checkout Session
    // ========================================================================

    const lineItems = {
      0: {
        price_data: {
          currency: "eur",
          product_data: {
            name: demandData.title,
            description: body.type === 'course'
              ? `${demandData.discipline} · ${demandData.level}`
              : `Stage · ${demandData.nb_participants} participant(s)`,
          },
          unit_amount: demandData.total_amount_ttc, // In cents
        },
        quantity: 1,
      },
    };

    // Create payment record FIRST to get payment ID
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        buyer_id: user.id,
        seller_id: sellerId,
        type: body.type,
        course_demand_id: body.type === 'course' ? body.demandId : null,
        stage_reservation_id: body.type === 'stage' ? body.reservationId : null,
        amount_buyer_ttc: demandData.total_amount_ttc,
        amount_platform_fee: demandData.platform_commission,
        amount_seller_ht: demandData.total_amount_ht - demandData.platform_commission,
        currency: "eur",
        commission_rate: 5.0,
        payment_status: "pending",
        stripe_metadata: {
          demand_type: body.type,
          created_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: "Failed to create payment record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkoutSession = await callStripeAPI("/checkout/sessions", "POST", {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      customer_email: user.email ?? "",
      client_reference_id: payment.id,
      success_url: `${SUPABASE_URL}/../checkout-success?sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SUPABASE_URL}/../reserver-${body.type === 'course' ? 'coach' : 'stage'}?cancelled=true`,
      metadata: {
        payment_id: payment.id,
        demand_id: body.demandId || body.reservationId,
        type: body.type,
        buyer_id: user.id,
        seller_id: sellerId,
      },
    });

    if (!checkoutSession.id) {
      return new Response(
        JSON.stringify({ error: "Failed to create Stripe session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 4: Update payment with Stripe session ID
    // ========================================================================

    await supabase
      .from("payments")
      .update({
        stripe_checkout_session_id: checkoutSession.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    // ========================================================================
    // STEP 5: Return checkout details
    // ========================================================================

    return new Response(
      JSON.stringify({
        sessionId: checkoutSession.id,
        checkoutUrl: checkoutSession.url,
        paymentId: payment.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in create-checkout-session:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

Deno.serve(handler);
