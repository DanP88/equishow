import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface OnboardingRequest {
  seller_id?: string;
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
    const body: OnboardingRequest = await req.json();

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

    // Use seller_id from request or current user
    const sellerId = body.seller_id || user.id;

    // ========================================================================
    // STEP 1: Fetch seller from database
    // ========================================================================

    const { data: seller, error: sellerError } = await supabase
      .from("users")
      .select("id, stripe_account_id, email")
      .eq("id", sellerId)
      .single();

    if (sellerError || !seller) {
      return new Response(
        JSON.stringify({ error: "Seller not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 2: Create or get Stripe account
    // ========================================================================

    let stripeAccountId = seller.stripe_account_id;

    if (!stripeAccountId) {
      // Create new Stripe Connect account (Express)
      const newAccount = await callStripeAPI("/accounts", "POST", {
        type: "express",
        country: "FR",
        email: seller.email,
        business_type: "individual",
        metadata: {
          seller_id: sellerId,
          created_at: new Date().toISOString(),
        },
      });

      if (!newAccount.id) {
        return new Response(
          JSON.stringify({ error: "Failed to create Stripe account" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      stripeAccountId = newAccount.id;

      // Update user record with new account ID
      await supabase
        .from("users")
        .update({
          stripe_account_id: stripeAccountId,
          stripe_account_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sellerId);
    }

    // ========================================================================
    // STEP 3: Create account link for onboarding
    // ========================================================================

    const accountLink = await callStripeAPI("/account_links", "POST", {
      account: stripeAccountId,
      type: "account_onboarding",
      return_url: `${SUPABASE_URL}/../stripe-onboarding`,
      refresh_url: `${SUPABASE_URL}/../stripe-onboarding`,
      collect: "eventually_due",
    });

    if (!accountLink.url) {
      return new Response(
        JSON.stringify({ error: "Failed to create onboarding link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 4: Return onboarding URL
    // ========================================================================

    return new Response(
      JSON.stringify({
        onboarding_url: accountLink.url,
        stripe_account_id: stripeAccountId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in create-stripe-onboarding-link:", error);

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
