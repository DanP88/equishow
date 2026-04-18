import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// ============================================================================
// STRIPE API HELPER
// ============================================================================

async function callStripeAPI(
  endpoint: string,
  method: string = "GET"
): Promise<any> {
  const url = `https://api.stripe.com/v1${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
    },
  });
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

    // Get current user (seller)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 1: Fetch seller's Stripe account ID
    // ========================================================================

    const { data: seller, error: sellerError } = await supabase
      .from("users")
      .select("stripe_account_id")
      .eq("id", user.id)
      .single();

    if (sellerError || !seller) {
      return new Response(
        JSON.stringify({ error: "Seller profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!seller.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: "No Stripe account linked" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 2: Get account status from Stripe
    // ========================================================================

    const stripeAccount = await callStripeAPI(`/accounts/${seller.stripe_account_id}`);

    if (stripeAccount.error) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch account from Stripe",
          details: stripeAccount.error.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 3: Update seller record with current status
    // ========================================================================

    const requirements = stripeAccount.requirements || {};
    const status = stripeAccount.charges_enabled && stripeAccount.payouts_enabled
      ? "active"
      : requirements.pending_verification?.length > 0
        ? "pending"
        : "restricted";

    const { error: updateError } = await supabase
      .from("users")
      .update({
        stripe_charges_enabled: stripeAccount.charges_enabled,
        stripe_payouts_enabled: stripeAccount.payouts_enabled,
        stripe_account_status: status,
        stripe_requirements_json: {
          pending_verification: requirements.pending_verification || [],
          currently_due: requirements.currently_due || [],
          eventually_due: requirements.eventually_due || [],
        },
        stripe_details_submitted: true,
        stripe_last_updated: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update seller profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 4: Return updated status
    // ========================================================================

    return new Response(
      JSON.stringify({
        success: true,
        stripe_account_id: seller.stripe_account_id,
        charges_enabled: stripeAccount.charges_enabled,
        payouts_enabled: stripeAccount.payouts_enabled,
        status,
        pending_requirements: requirements.pending_verification || [],
        message: status === "active"
          ? "Your account is ready to accept payments!"
          : status === "pending"
            ? "Your account is being verified. This usually takes 24-48 hours."
            : "Your account has restrictions. Please review Stripe for details.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in complete-seller-onboarding:", error);

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
