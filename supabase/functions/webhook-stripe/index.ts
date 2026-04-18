import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import * as crypto from "https://deno.land/std@0.208.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// ============================================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================================

async function verifyStripeSignature(
  body: string,
  signature: string
): Promise<boolean> {
  try {
    const [timestamp, signedContent] = signature.split(",").map(part => {
      const [key, value] = part.split("=");
      return value;
    });

    const message = `${timestamp}.${body}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(STRIPE_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signature_bytes = new Uint8Array(
      signedContent.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      signature_bytes,
      encoder.encode(message)
    );

    return verified;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

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
// EVENT HANDLERS
// ============================================================================

async function handleChargeSucceeded(
  supabase: any,
  event: any
) {
  const charge = event.data.object;

  // Find payment by payment_id from metadata
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("id", charge.metadata?.payment_id)
    .limit(1);

  if (!payments || payments.length === 0) {
    console.log("Payment not found for charge:", charge.id);
    return;
  }

  const payment = payments[0];

  // Update payment status
  await supabase
    .from("payments")
    .update({
      payment_status: "succeeded",
      stripe_charge_id: charge.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  // Update demand or reservation status to 'paid'
  if (payment.course_demand_id) {
    await supabase
      .from("course_demands")
      .update({
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.course_demand_id);
  } else if (payment.stage_reservation_id) {
    await supabase
      .from("stage_reservations")
      .update({
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.stage_reservation_id);
  }

  // Get seller's Stripe account
  const { data: seller } = await supabase
    .from("users")
    .select("stripe_account_id")
    .eq("id", payment.seller_id)
    .single();

  if (seller?.stripe_account_id) {
    // Create Stripe Transfer to seller
    const transferResponse = await callStripeAPI("/transfers", "POST", {
      amount: payment.amount_seller_ht.toString(),
      currency: "eur",
      destination: seller.stripe_account_id,
      description: `Payment from Equishow - ${payment.id}`,
      metadata: {
        payment_id: payment.id,
        charge_id: charge.id,
      },
    });

    if (transferResponse.id) {
      await supabase
        .from("payments")
        .update({
          stripe_transfer_id: transferResponse.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      console.log("Transfer created:", transferResponse.id);
    }
  }
}

async function handleChargeFailed(
  supabase: any,
  event: any
) {
  const charge = event.data.object;

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("stripe_charge_id", charge.id)
    .limit(1);

  if (payments && payments.length > 0) {
    const payment = payments[0];
    await supabase
      .from("payments")
      .update({
        payment_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    console.log("Payment marked as failed:", payment.id);
  }
}

async function handleChargeRefunded(
  supabase: any,
  event: any
) {
  const charge = event.data.object;

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("stripe_charge_id", charge.id)
    .limit(1);

  if (!payments || payments.length === 0) {
    console.log("Payment not found for refund:", charge.id);
    return;
  }

  const payment = payments[0];
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

  // Update demand/reservation to cancelled
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

  console.log("Payment refunded:", payment.id);
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
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify webhook signature
    const isValid = await verifyStripeSignature(body, signature);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const event = JSON.parse(body);
    const stripeEventId = event.id;

    // Initialize Supabase
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ========================================================================
    // IDEMPOTENCY CHECK
    // ========================================================================

    const { data: existingEvent } = await supabase
      .from("stripe_webhook_events")
      .select("*")
      .eq("stripe_event_id", stripeEventId)
      .single();

    if (existingEvent?.processed) {
      console.log("Event already processed:", stripeEventId);
      return new Response(
        JSON.stringify({ received: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ========================================================================
    // PROCESS EVENT
    // ========================================================================

    try {
      switch (event.type) {
        case "charge.succeeded":
          console.log("Processing charge.succeeded");
          await handleChargeSucceeded(supabase, event);
          break;

        case "charge.failed":
          console.log("Processing charge.failed");
          await handleChargeFailed(supabase, event);
          break;

        case "charge.refunded":
          console.log("Processing charge.refunded");
          await handleChargeRefunded(supabase, event);
          break;

        default:
          console.log("Unhandled event type:", event.type);
      }

      // Mark event as processed
      await supabase
        .from("stripe_webhook_events")
        .upsert(
          {
            stripe_event_id: stripeEventId,
            event_type: event.type,
            event_payload: event,
            processed: true,
            processed_at: new Date().toISOString(),
          },
          { onConflict: "stripe_event_id" }
        );

      console.log("Event processed successfully:", stripeEventId);

      return new Response(
        JSON.stringify({ received: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Event processing error:", error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Store error but mark as processed to prevent infinite retries
      await supabase
        .from("stripe_webhook_events")
        .upsert(
          {
            stripe_event_id: stripeEventId,
            event_type: event.type,
            event_payload: event,
            processed: true,
            processed_at: new Date().toISOString(),
            error_message: errorMessage,
          },
          { onConflict: "stripe_event_id" }
        );

      // Still return 200 to acknowledge receipt
      return new Response(
        JSON.stringify({ received: true, error: errorMessage }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

Deno.serve(handler);
