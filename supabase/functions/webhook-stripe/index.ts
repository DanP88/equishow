import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
// NB : pas d'import std/crypto — on utilise le WebCrypto GLOBAL de Deno.
// L'ancien `import * as crypto from "std/crypto/mod.ts"` exposait `crypto.subtle`
// = undefined (le module exporte `crypto`, pas `subtle`) → verifyStripeSignature
// throwait → 401 systématique → aucun webhook jamais validé. Bug corrigé ici.
import { sendTransactional, getUserContact } from "../_shared/email.ts";
import type { EmailEventType, EmailModule } from "../_shared/email-templates.ts";
import {
  computeReleaseDueAt,
  disputeResolution,
  holdHoursForType,
  isEscrowEnabled,
  loadEscrowSettings,
  shouldBlockOnDispute,
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

// Envoi des emails hors critical path : la réponse 200 est renvoyée
// immédiatement et l'envoi Resend (séquentiel buyer→seller, 2-6s) ne retarde
// plus la confirmation côté verify-checkout-session. waitUntil maintient le
// process Deno vivant jusqu'à la résolution. Fallback await si EdgeRuntime
// indisponible (ex. tests locaux Node).
function scheduleEmail(job: Promise<void>): Promise<void> {
  // @ts-ignore — EdgeRuntime est fourni par le runtime Supabase Edge.
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(job);
    return Promise.resolve();
  }
  return job;
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

  // Mise à jour de la notification « 💳 Paiement en cours » côté vendeur :
  // bascule vers « 💰 Paiement reçu (séquestre) » avec le montant NET (HT
  // seller, jamais le TTC cavalier — confidentialité business : le coach ne
  // doit pas voir la commission). Match via l'id réservation/demande stocké en
  // donnees côté front (useStagePayment / useCoursePayment / pending-*). Best-
  // effort : si la notif n'a jamais été créée (ancien flow), no-op silencieux.
  try {
    const FK_TO_DONNEES_KEY: Record<string, { fk: string; key: string }> = {
      course: { fk: "course_demand_id", key: "courseDemandId" },
      stage: { fk: "stage_reservation_id", key: "stageReservationId" },
      box: { fk: "box_reservation_id", key: "boxReservationId" },
      transport: { fk: "transport_reservation_id", key: "transportReservationId" },
    };
    const cfg = FK_TO_DONNEES_KEY[payment.type as string];
    const entityId = cfg ? payment[cfg.fk] : null;
    if (cfg && entityId) {
      const amountNetEur =
        typeof payment.amount_seller_ht === "number" ? payment.amount_seller_ht / 100 : null;
      const heldNote = escrowOn ? " (en séquestre jusqu'à la prestation)" : "";
      const { data: notifs } = await supabase
        .from("notifications")
        .select("id, donnees")
        .eq("destinataire_id", payment.seller_id)
        .eq("status", "pending")
        .filter("donnees->>" + cfg.key, "eq", String(entityId))
        .limit(5);
      for (const n of notifs ?? []) {
        const donneesNext = { ...(n.donnees ?? {}), prix: amountNetEur };
        await supabase
          .from("notifications")
          .update({
            titre: "💰 Paiement reçu" + heldNote,
            status: "accepted",
            donnees: donneesNext,
          })
          .eq("id", n.id);
      }
    }
  } catch (e) {
    console.error("notif seller update (non bloquant):", e instanceof Error ? e.message : e);
  }

  // Destination charge (transfer_data.destination ou application_fee_amount set) :
  // Stripe a déjà créé le Transfer automatiquement ; charge.transfer peut être
  // null dans l'event charge.succeeded initial puis populé ultérieurement. NE
  // PAS créer de transfer manuel — Stripe refuse (« charge has transfer_data »)
  // et on perd 1-3s sync sur le critical path du webhook pour rien. Le
  // stripe_transfer_id sera récupérable côté Stripe via expand au refund.
  const isDestinationCharge =
    !!charge.transfer_data?.destination || !!charge.application_fee_amount;

  // Fallback manuel : SEULEMENT pour legacy non-destination-charge (cas
  // historique). escrowOn ON → libération différée via release-payment.
  if (!charge.transfer && !escrowOn && !isDestinationCharge) {
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
      } else {
        console.error("Manual transfer failed for payment", payment.id, transferResponse);
      }
    }
  }

  // Emails « paiement confirmé » aux 2 parties — hors critical path.
  await scheduleEmail(emailPaymentBothParties(supabase, payment, "payment_succeeded", event.id));
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

    // Email « paiement échoué » — hors critical path.
    await scheduleEmail(emailPaymentBothParties(supabase, payment, "payment_failed", event.id));
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

  // Séquestre : un paiement déjà versé ('released') puis remboursé doit refléter
  // 'reversed' (le Transfer a été annulé via process-refund). Le webhook et
  // process-refund écrivent tous deux cette ligne sur un refund ; on converge ici
  // vers l'état escrow correct quel que soit l'ordre. Legacy 'not_applicable' →
  // transfer_state laissé tel quel (COMPORTEMENT INCHANGÉ).
  const refundPatch: Record<string, unknown> = {
    payment_status: "refunded",
    refunded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  // Ne jamais écraser un refund id existant avec undefined (charge.refunds n'est
  // pas toujours étendu dans le payload webhook).
  const refundId = firstRefund?.id ?? payment.stripe_refund_id ?? null;
  if (refundId) refundPatch.stripe_refund_id = refundId;
  if (payment.transfer_state === "released" || payment.transfer_state === "reversed") {
    refundPatch.transfer_state = "reversed";
    refundPatch.transfer_reversed_at = payment.transfer_reversed_at ?? new Date().toISOString();
  }

  await supabase
    .from("payments")
    .update(refundPatch)
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

  // Email « remboursement » — hors critical path.
  await scheduleEmail(emailPaymentBothParties(supabase, payment, "payment_refunded", event.id));
}

// ============================================================================
// LITIGES / CHARGEBACKS (PHASE 6) — best-effort, n'affecte pas le legacy
// ============================================================================

async function findPaymentByCharge(supabase: any, chargeId: string): Promise<any | null> {
  const { data } = await supabase.from("payments").select("*").eq("stripe_charge_id", chargeId).limit(1);
  return data?.[0] ?? null;
}

// charge.dispute.created : trace le litige + bloque la libération si fonds
// encore retenus (escrow held/releasing). Legacy (not_applicable) : audit only,
// payment row NON modifiée (Stripe gère le chargeback nativement).
async function handleChargeDisputeCreated(supabase: any, event: any) {
  const dispute = event.data.object;
  const payment = await findPaymentByCharge(supabase, dispute.charge);
  if (!payment) {
    console.log("dispute.created : payment introuvable pour charge", dispute.charge);
    return;
  }
  await supabase.from("payment_disputes").insert({
    payment_id: payment.id,
    source: "stripe",
    status: "open",
    reason: dispute.reason ?? null,
    stripe_dispute_id: dispute.id,
  });
  if (shouldBlockOnDispute(payment.transfer_state)) {
    await supabase
      .from("payments")
      .update({ dispute_status: "open", release_blocked_reason: "chargeback" })
      .eq("id", payment.id);
    console.log("dispute.created : libération bloquée (chargeback) pour payment", payment.id);
  }
}

// charge.dispute.closed : débloque si gagné (et toujours bloqué par chargeback),
// sinon marque résolu. Ne débloque jamais un litige interne admin.
async function handleChargeDisputeClosed(supabase: any, event: any) {
  const dispute = event.data.object;
  const payment = await findPaymentByCharge(supabase, dispute.charge);
  if (!payment) return;
  const action = disputeResolution(dispute.status);
  if (action === "unblock") {
    await supabase
      .from("payments")
      .update({ dispute_status: null, release_blocked_reason: null })
      .eq("id", payment.id)
      .eq("release_blocked_reason", "chargeback");
    await supabase
      .from("payment_disputes")
      .update({ status: "resolved_release", resolved_at: new Date().toISOString() })
      .eq("stripe_dispute_id", dispute.id);
  } else if (action === "keep_blocked") {
    await supabase
      .from("payment_disputes")
      .update({ status: "resolved_refund", resolved_at: new Date().toISOString() })
      .eq("stripe_dispute_id", dispute.id);
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
      .select("processed")
      .eq("stripe_event_id", stripeEventId)
      .maybeSingle();

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

        case "charge.dispute.created":
          console.log("Processing charge.dispute.created");
          await handleChargeDisputeCreated(supabase, event);
          break;

        case "charge.dispute.closed":
          console.log("Processing charge.dispute.closed");
          await handleChargeDisputeClosed(supabase, event);
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
