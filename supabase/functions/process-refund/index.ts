import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { needsTransferReversal, refundFlagsFor } from "../_shared/escrow.ts";

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
  data?: Record<string, any>,
  idempotencyKey?: string
): Promise<any> {
  const url = `https://api.stripe.com/v1${endpoint}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const options: RequestInit = {
    method,
    headers,
  };

  if (data) {
    options.body = new URLSearchParams(data).toString();
  }

  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message ?? `Stripe error ${response.status}`);
  }
  return result;
}

const VALID_REFUND_REASONS = ["duplicate", "fraudulent", "requested_by_customer"];

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
    // STEP 2: Verify requester is the buyer (only buyers can request refunds)
    // ========================================================================

    if (user.id !== payment.buyer_id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: only the buyer can request a refund" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // STEP 3: Verify payment can be refunded
    // ========================================================================

    // Idempotency: already refunded
    if (payment.payment_status === "refunded" || payment.stripe_refund_id) {
      return new Response(
        JSON.stringify({ error: "Payment has already been refunded" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Validate reason against Stripe enum
    const reason = VALID_REFUND_REASONS.includes(body.reason ?? "")
      ? body.reason!
      : "requested_by_customer";

    // ========================================================================
    // STEP 4: Create refund with Stripe (P4)
    // Flags choisis selon l'état séquestre (refundFlagsFor) :
    //  - legacy 'not_applicable' (destination charge) : refund_application_fee +
    //    reverse_transfer (COMPORTEMENT ACTUEL INCHANGÉ).
    //  - 'released' (séquestre versé) : reverse_transfer seul.
    //  - 'held'/… : refund SIMPLE (ni reverse_transfer ni refund_application_fee).
    // ========================================================================

    const flags = refundFlagsFor(payment.transfer_state);

    // Séquestre versé ('released') : annuler le Transfer AUTONOME avant le refund.
    // Un transfert créé via /v1/transfers (Separate Charges & Transfers) n'est pas
    // annulable par le flag reverse_transfer du refund — il faut un Transfer
    // Reversal explicite. Idempotent (Idempotency-Key) → rejouable sans double
    // reversal. N'affecte JAMAIS le legacy 'not_applicable' (destination charge).
    if (needsTransferReversal(payment.transfer_state, payment.stripe_transfer_id)) {
      await callStripeAPI(
        `/transfers/${payment.stripe_transfer_id}/reversals`,
        "POST",
        {
          "metadata[payment_id]": body.paymentId,
          "metadata[reason]": reason,
        },
        `reversal:${body.paymentId}`
      );
    }

    const refundParams: Record<string, string> = {
      charge: payment.stripe_charge_id,
      reason,
      "metadata[payment_id]": body.paymentId,
      "metadata[reason]": reason,
      "metadata[refunded_by]": user.id,
      "metadata[refunded_at]": new Date().toISOString(),
    };
    if (flags.reverse_transfer) refundParams.reverse_transfer = "true";
    if (flags.refund_application_fee) refundParams.refund_application_fee = "true";

    const refundResponse = await callStripeAPI("/refunds", "POST", refundParams);

    // ========================================================================
    // STEP 5: Update payment record in database
    // ========================================================================
    //
    // Le refund Stripe (STEP 4) est IRRÉVERSIBLE : on ne peut donc pas garantir
    // une atomicité parfaite avec la BD. Stratégie « cohérent autant que possible » :
    //   - on enregistre chaque échec dans `warnings` (renvoyé au client) ;
    //   - on loggue chaque échec en JSON structuré (recherche/alerting faciles) ;
    //   - aucun update n'est en fire-and-forget silencieux.
    // Le webhook Stripe `charge.refunded` reste le filet de réconciliation ultime.

    const warnings: string[] = [];

    const refundUpdate: Record<string, unknown> = {
      payment_status: "refunded",
      stripe_refund_id: refundResponse.id,
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Séquestre : marquer 'reversed' (fonds rendus) pour bloquer toute libération
    // future. Legacy 'not_applicable' → transfer_state laissé tel quel (inchangé).
    if (payment.transfer_state && payment.transfer_state !== "not_applicable") {
      refundUpdate.transfer_state = "reversed";
      refundUpdate.transfer_reversed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("payments")
      .update(refundUpdate)
      .eq("id", body.paymentId);

    if (updateError) {
      // CRITIQUE : Stripe a remboursé mais la BD ne reflète pas `refunded`.
      // L'idempotence (STEP 3 via stripe_refund_id) est donc affaiblie — d'où le
      // niveau `critical` pour l'alerting. Le webhook charge.refunded réconcilie.
      console.error(JSON.stringify({
        level: "critical",
        fn: "process-refund",
        step: "payment_update",
        paymentId: body.paymentId,
        stripe_refund_id: refundResponse.id,
        error: updateError.message,
      }));
      warnings.push("payment_db_update_failed");
    }

    // ========================================================================
    // STEP 6: Annuler la réservation liée — synchro de statut explicite
    // ========================================================================
    //
    // Objectif : éviter « payment = refunded » + « réservation = paid ».
    // Un paiement n'est lié qu'à UNE réservation. On résout sa cible (table +
    // colonne de statut : `status` partout sauf transport en FR `statut`), puis
    // on tente l'update avec un retry (aléa réseau transitoire). Tout échec
    // définitif est loggué ET remonté dans `warnings` — jamais avalé.

    type ResaTarget = { table: string; column: "status" | "statut"; id: string };
    let resa: ResaTarget | null = null;
    if (payment.course_demand_id) {
      resa = { table: "course_demands", column: "status", id: payment.course_demand_id };
    } else if (payment.stage_reservation_id) {
      resa = { table: "stage_reservations", column: "status", id: payment.stage_reservation_id };
    } else if (payment.box_reservation_id) {
      resa = { table: "box_reservations", column: "status", id: payment.box_reservation_id };
    } else if (payment.transport_reservation_id) {
      // Colonne FR `statut` — 'cancelled' autorisé depuis la migration 043.
      resa = { table: "transport_reservations", column: "statut", id: payment.transport_reservation_id };
    }

    if (resa) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      patch[resa.column] = "cancelled";

      let resaError: string | null = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const { error } = await supabase.from(resa.table).update(patch).eq("id", resa.id);
        if (!error) { resaError = null; break; }
        resaError = error.message;
        console.error(JSON.stringify({
          level: attempt === 2 ? "error" : "warn",
          fn: "process-refund",
          step: "reservation_cancel",
          attempt,
          paymentId: body.paymentId,
          table: resa.table,
          reservationId: resa.id,
          error: error.message,
        }));
      }
      if (resaError) {
        // Refund + payment OK, mais la réservation reste 'paid' : incohérence
        // visible côté UI (badge). Le warning permet la réconciliation manuelle.
        warnings.push(`reservation_cancel_failed:${resa.table}:${resa.id}`);
      }
    } else {
      // Paiement sans réservation liée : anormal pour un flux séquestre — à tracer.
      console.warn(JSON.stringify({
        level: "warn",
        fn: "process-refund",
        step: "reservation_cancel",
        paymentId: body.paymentId,
        message: "no linked reservation on payment",
      }));
      warnings.push("no_linked_reservation");
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
        // Le refund a réussi (success:true) ; `warnings` signale toute désynchro
        // BD résiduelle à réconcilier (payment ou réservation).
        warnings: warnings.length ? warnings : undefined,
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
