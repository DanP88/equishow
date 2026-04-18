import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    // Extract seller ID from URL
    const url = new URL(req.url);
    const sellerId = url.pathname.split("/").pop();

    if (!sellerId) {
      return new Response(
        JSON.stringify({ error: "Missing seller ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 1: Fetch seller from database
    // ========================================================================

    const { data: seller, error: sellerError } = await supabase
      .from("users")
      .select("stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_account_status, stripe_requirements_json")
      .eq("id", sellerId)
      .single();

    if (sellerError || !seller) {
      return new Response(
        JSON.stringify({ error: "Seller not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no account, return 'no_account'
    if (!seller.stripe_account_id) {
      return new Response(
        JSON.stringify({
          has_account: false,
          charges_enabled: false,
          payouts_enabled: false,
          pending_requirements: [],
          status: "no_account",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 2: Check status with Stripe API
    // ========================================================================

    const stripeAccount = await callStripeAPI(`/accounts/${seller.stripe_account_id}`);

    if (stripeAccount.error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch account status from Stripe" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 3: Update local cache if status changed
    // ========================================================================

    const requirements = stripeAccount.requirements?.pending_verification || [];

    const updatedStatus = stripeAccount.charges_enabled && stripeAccount.payouts_enabled
      ? "ready"
      : requirements.length > 0
        ? "pending"
        : "restricted";

    if (
      seller.stripe_charges_enabled !== stripeAccount.charges_enabled ||
      seller.stripe_payouts_enabled !== stripeAccount.payouts_enabled ||
      seller.stripe_account_status !== updatedStatus
    ) {
      await supabase
        .from("users")
        .update({
          stripe_charges_enabled: stripeAccount.charges_enabled,
          stripe_payouts_enabled: stripeAccount.payouts_enabled,
          stripe_account_status: updatedStatus,
          stripe_requirements_json: {
            pending_verification: requirements,
            currently_due: stripeAccount.requirements?.currently_due || [],
            eventually_due: stripeAccount.requirements?.eventually_due || [],
          },
          stripe_last_updated: new Date().toISOString(),
        })
        .eq("id", sellerId);
    }

    // ========================================================================
    // STEP 4: Return current status
    // ========================================================================

    return new Response(
      JSON.stringify({
        has_account: true,
        charges_enabled: stripeAccount.charges_enabled,
        payouts_enabled: stripeAccount.payouts_enabled,
        pending_requirements: requirements,
        status: updatedStatus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-seller-status:", error);

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
