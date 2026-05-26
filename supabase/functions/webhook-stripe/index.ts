import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
// NB : pas d'import std/crypto — on utilise le WebCrypto GLOBAL de Deno.
// L'ancien `import * as crypto from "std/crypto/mod.ts"` exposait `crypto.subtle`
// = undefined (le module exporte `crypto`, pas `subtle`) → verifyStripeSignature
// throwait → 401 systématique → aucun webhook jamais validé. Bug corrigé ici.
import { sendTransactional, getUserContact } from "../_shared/email.ts";
import type { EmailEventType, EmailModule } from "../_shared/email-templates.ts";
import {
  computeReleaseDueAt,
  holdHoursForType,
  isEscrowEnabled,
  loadEscrowSettings,
  type EscrowModule,
} from "../_shared/escrow.ts";

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
// EMAILS TRANSACTIONNELS (best-effort — ne bloque JAMAIS le webhook)
// ============================================================================

// Mapping module → table d'entité + colonne FK sur payments (pour le contenu).
const MODULE_ENTITY: Record<string, { table: string; fk: string }> = {
  course: { table: "course_demands", fk: "course_demand_id" },
  stage: { table: "stage_reservations", fk: "stage_reservation_id" },
  transport: { table: "transport_reservations", fk: "transport_reservation_id" },
  box: { table: "box_reservations", fk: "box_reservation_id" },
};

// Envoie l'email de paiement aux 2 parties. idemId = stripe_event_id (adossé à
// l'idempotence Stripe). N'altère aucun montant : amountEur en affichage seul.
async function emailPaymentBothParties(
  supabase: any,
  payment: any,
  eventType: EmailEventType,
  stripeEventId: string,
): Promise<void> {
  try {
    const module = payment?.type as string;
    const cfg = MODULE_ENTITY[module];
    if (!cfg) return; // boost / type inconnu → pas d'email

    // Contenu (titre/lieu/date) — défensif, jamais bloquant.
    let entityTitle: string | undefined;
    let lieu: string | undefined;
    let dateLabel: string | undefined;
    try {
      const entityId = payment[cfg.fk];
      if (entityId) {
        const { data: ent } = await supabase
          .from(cfg.table)
          .select("*")
          .eq("id", entityId)
          .maybeSingle();
        if (ent) {
          entityTitle = ent.title ?? ent.stage_titre;
          lieu = ent.lieu ?? ent.concours_nom;
          const dv = ent.date_debut ?? ent.date_trajet ?? ent.date_reservation;
          if (dv) {
            const d = new Date(dv);
            if (!Number.isNaN(d.getTime())) {
              dateLabel = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
            }
          }
        }
      }
    } catch (_) { /* contenu best-effort */ }

    const amountEur =
      typeof payment.amount_buyer_ttc === "number" ? payment.amount_buyer_ttc / 100 : undefined;
    const relatedEntityId = payment[cfg.fk] ? String(payment[cfg.fk]) : null;

    const [buyer, seller] = await Promise.all([
      getUserContact(supabase, payment.buyer_id),
      getUserContact(supabase, payment.seller_id),
    ]);

    if (buyer.email) {
      await sendTransactional({
        supabase, eventType, module: module as EmailModule, role: "buyer",
        idemId: stripeEventId, recipientId: payment.buyer_id, recipientEmail: buyer.email,
        relatedPaymentId: payment.id, relatedEntityId,
        data: { recipientName: buyer.name, counterpartName: seller.name, entityTitle, lieu, dateLabel, amountEur },
      });
    }
    if (seller.email) {
      await sendTransactional({
        supabase, eventType, module: module as EmailModule, role: "seller",
        idemId: stripeEventId, recipientId: payment.seller_id, recipientEmail: seller.email,
        relatedPaymentId: payment.id, relatedEntityId,
        data: { recipientName: seller.name, counterpartName: buyer.name, entityTitle, lieu, dateLabel, amountEur },
      });
    }
  } catch (e) {
    console.error("emailPaymentBothParties (non bloquant):", e instanceof Error ? e.message : e);
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

// ── Boost handler (séparé : kind='boost' routé ici) ─────────────────────────
async function handleBoostChargeSucceeded(
  supabase: any,
  charge: any
) {
  const purchaseId = charge.metadata?.boost_purchase_id
    ?? charge.payment_intent_data?.metadata?.boost_purchase_id;

  if (!purchaseId) {
    console.log("Boost charge sans boost_purchase_id metadata:", charge.id);
    return;
  }

  // fn_apply_boost est idempotent (return si déjà paid) + cumul expiration
  const { error } = await supabase.rpc("fn_apply_boost", {
    p_purchase_id: purchaseId,
    p_stripe_charge_id: charge.id,
    p_stripe_pi_id: charge.payment_intent ?? null,
  });

  if (error) {
    console.error("fn_apply_boost failed:", error.message);
    throw new Error(`Boost apply failed: ${error.message}`);
  }
  console.log("Boost applied for purchase:", purchaseId);
}

// Date de fin de prestation (pour calculer release_due_at en mode séquestre).
// Lecture défensive ; null si introuvable → fallback sur la date de paiement.
async function getPrestationEndAt(supabase: any, payment: any): Promise<string | null> {
  try {
    if (payment.type === "stage" && payment.stage_reservation_id) {
      const { data: sr } = await supabase
        .from("stage_reservations")
        .select("stage_id, date_reservation")
        .eq("id", payment.stage_reservation_id)
        .maybeSingle();
      if (sr?.stage_id) {
        const { data: st } = await supabase
          .from("stages")
          .select("date_fin, date_debut")
          .eq("id", sr.stage_id)
          .maybeSingle();
        return st?.date_fin ?? st?.date_debut ?? sr?.date_reservation ?? null;
      }
      return sr?.date_reservation ?? null;
    }
    const TBL: Record<string, { table: string; fk: string }> = {
      course: { table: "course_demands", fk: "course_demand_id" },
      box: { table: "box_reservations", fk: "box_reservation_id" },
      transport: { table: "transport_reservations", fk: "transport_reservation_id" },
    };
    const cfg = TBL[payment.type];
    if (!cfg || !payment[cfg.fk]) return null;
    const { data } = await supabase.from(cfg.table).select("*").eq("id", payment[cfg.fk]).maybeSingle();
    if (!data) return null;
    return data.date_fin ?? data.date_trajet ?? data.date_debut ?? data.date_reservation ?? null;
  } catch (_) {
    return null;
  }
}

async function handleChargeSucceeded(
  supabase: any,
  event: any
) {
  const charge = event.data.object;

  // Router : Boost a sa propre logique (table dédiée, pas de transfer Connect)
  if (charge.metadata?.kind === "boost") {
    await handleBoostChargeSucceeded(supabase, charge);
    return;
  }

  // Find payment by payment_id from metadata
  const paymentMetaId = charge.metadata?.payment_id
    ?? charge.payment_intent_data?.metadata?.payment_id;

  if (!paymentMetaId) {
    console.log("Charge without payment_id metadata:", charge.id);
    return;
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentMetaId)
    .limit(1);

  if (!payments || payments.length === 0) {
    console.log("Payment not found for charge:", charge.id);
    return;
  }

  const payment = payments[0];

  // V2 séquestre : activé pour ce module ? (flag OFF → escrowOn=false → legacy)
  const escrowSettings = await loadEscrowSettings(supabase);
  const escrowOn = isEscrowEnabled(escrowSettings, payment.type as EscrowModule);

  // Update payment status + propagate transfer_id if Stripe auto-transferred
  // (Connect destination charge with transfer_data → charge.transfer is set).
  const updateFields: Record<string, unknown> = {
    payment_status: "succeeded",
    stripe_charge_id: charge.id,
    paid_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (charge.transfer) {
    updateFields.stripe_transfer_id = charge.transfer;
  }

  // En séquestre : on retient les fonds (held) et on calcule la date de
  // libération auto = fin de prestation + délai du module. AUCUN transfert ici.
  if (escrowOn) {
    const prestationEnd = await getPrestationEndAt(supabase, payment);
    const baseMs = prestationEnd ? Date.parse(prestationEnd) : Date.now();
    const holdH = holdHoursForType(payment.type as EscrowModule, escrowSettings);
    updateFields.transfer_state = "held";
    updateFields.prestation_end_at = prestationEnd;
    updateFields.release_due_at = computeReleaseDueAt(Number.isFinite(baseMs) ? baseMs : Date.now(), holdH);
  }
  await supabase
    .from("payments")
    .update(updateFields)
    .eq("id", payment.id);

  // Update demand or reservation status to 'paid'
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
  } else if (payment.box_reservation_id) {
    await supabase
      .from("box_reservations")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", payment.box_reservation_id);
  } else if (payment.transport_reservation_id) {
    await supabase
      .from("transport_reservations")
      .update({ statut: "paid" })
      .eq("id", payment.transport_reservation_id);
  }

  // If Stripe didn't auto-transfer (legacy non-Connect or transfer_data absent),
  // fall back to manual transfer creation.
  // V2 séquestre : on NE transfère JAMAIS ici (libération différée). escrowOn
  // OFF → condition legacy EXACTE inchangée.
  if (!charge.transfer && !escrowOn) {
    const { data: seller } = await supabase
      .from("users")
      .select("stripe_account_id")
      .eq("id", payment.seller_id)
      .single();

    if (seller?.stripe_account_id) {
      const transferResponse = await callStripeAPI("/transfers", "POST", {
        amount: payment.amount_seller_ht.toString(),
        currency: "eur",
        destination: seller.stripe_account_id,
        description: `Equishow payment ${payment.id}`,
        "metadata[payment_id]": payment.id,
        "metadata[charge_id]": charge.id,
      });

      if (transferResponse.id) {
        await supabase
          .from("payments")
          .update({
            stripe_transfer_id: transferResponse.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);
      }
    }
  }

  // Emails « paiement confirmé » aux 2 parties — best-effort, après les MAJ DB.
  await emailPaymentBothParties(supabase, payment, "payment_succeeded", event.id);
}

async function handleChargeFailed(
  supabase: any,
  event: any
) {
  const charge = event.data.object;

  // Boost route — table séparée
  if (charge.metadata?.kind === "boost") {
    const purchaseId = charge.metadata?.boost_purchase_id;
    if (purchaseId) {
      await supabase
        .from("coach_boost_purchases")
        .update({
          status: "failed",
          error_message: charge.failure_message ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", purchaseId);
      console.log("Boost purchase marked failed:", purchaseId);
    }
    return;
  }

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

    // Email « paiement échoué » — best-effort.
    await emailPaymentBothParties(supabase, payment, "payment_failed", event.id);
  }
}

async function handleChargeRefunded(
  supabase: any,
  event: any
) {
  const charge = event.data.object;

  // Boost route — marque refunded mais ne révoque pas auto le boost.
  // (Décision admin : politique remboursement boost à définir.)
  if (charge.metadata?.kind === "boost") {
    const purchaseId = charge.metadata?.boost_purchase_id;
    const firstRefund = charge.refunds?.data?.[0];
    if (purchaseId) {
      await supabase
        .from("coach_boost_purchases")
        .update({
          status: "refunded",
          stripe_refund_id: firstRefund?.id ?? null,
          refunded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", purchaseId);
      console.log("Boost purchase marked refunded:", purchaseId);
    }
    return;
  }

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

  // Email « remboursement » — best-effort.
  await emailPaymentBothParties(supabase, payment, "payment_refunded", event.id);
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
