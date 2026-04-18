import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RefundRequest {
  paymentId: string;
  reason?: string;
}

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// ============================================================================
// STRIPE API HELPER
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
    options.body = new URLSearchParams(data).toString();
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
    const body: RefundRequest = await req.json();

    if (!body.paymentId) {
      return new Response(
        JSON.stringify({ error: "Missing paymentId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase
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
    // STEP 1: Fetch payment from database
    // ========================================================================

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", body.paymentId)
      .single();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: "Payment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 2: Verify requester is buyer or seller
    // ========================================================================

    if (user.id !== payment.buyer_id && user.id !== payment.seller_id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: not involved in this payment" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 3: Verify payment can be refunded
    // ========================================================================

    if (payment.payment_status !== "succeeded") {
      return new Response(
        JSON.stringify({
          error: `Cannot refund payment with status: ${payment.payment_status}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payment.stripe_charge_id) {
      return new Response(
        JSON.stringify({ error: "No charge found to refund" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 4: Create refund with Stripe
    // ========================================================================

    const refundResponse = await callStripeAPI("/refunds", "POST", {
      charge: payment.stripe_charge_id,
      reason: body.reason || "requested_by_customer",
      metadata: {
        payment_id: body.paymentId,
        reason: body.reason,
        refunded_by: user.id,
        refunded_at: new Date().toISOString(),
      },
    });

    if (refundResponse.error) {
      return new Response(
        JSON.stringify({
          error: "Failed to create refund in Stripe",
          details: refundResponse.error.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 5: Update payment record in database
    // ========================================================================

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        payment_status: "refunded",
        stripe_refund_id: refundResponse.id,
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.paymentId);

    if (updateError) {
      console.error("Failed to update payment after refund:", updateError);
      // Still return success since Stripe refund was created
    }

    // ========================================================================
    // STEP 6: Update demand/reservation to cancelled
    // ========================================================================

    if (payment.course_demand_id) {
      await supabase
        .from("course_demands")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.course_demand_id);
    } else if (payment.stage_reservation_id) {
      await supabase
        .from("stage_reservations")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.stage_reservation_id);
    }

    // ========================================================================
    // STEP 7: Return refund details
    // ========================================================================

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refundResponse.id,
        refunded_amount: refundResponse.amount,
        status: refundResponse.status,
        message: "Refund processed successfully. Money will return to card in 3-5 business days.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-refund:", error);

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
