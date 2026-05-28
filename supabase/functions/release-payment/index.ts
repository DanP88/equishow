// ─────────────────────────────────────────────────────────────────────────────
// release-payment — Libère les fonds vendeur (Stripe Transfer) pour un paiement
// en séquestre. V2 escrow / Separate Charges & Transfers.
//
// GARANTIES :
//   • Montant = amount_seller_ht UNIQUEMENT (jamais de recalcul de commission).
//   • Idempotency-Key `transfer:{payment_id}` + verrou optimiste DB (held→releasing)
//     → AUCUN double transfert, même en concurrence.
//   • Refuse si transfer_state != 'held', si litige/blocage, si vendeur non onboardé.
//   • Retryable sur balance_insufficient (reste 'held'). Le vendeur ne peut jamais
//     se payer lui-même (403).
//   • N'affecte RIEN tant qu'aucun paiement n'est 'held' (escrow off → inerte).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import {
  canReleasePayment,
  classifyTransferError,
  reservationIdOf,
  transferAmountCents,
  transferIdempotencyKey,
  type ReleaseCaller,
} from "../_shared/escrow.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Appel Stripe form-urlencoded avec Idempotency-Key. Renvoie { ok, data }.
async function stripeTransfer(
  data: Record<string, string>,
  idempotencyKey: string,
): Promise<{ ok: boolean; status: number; data: any }> {
  const resp = await fetch("https://api.stripe.com/v1/transfers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    },
    body: new URLSearchParams(data).toString(),
  });
  const json = await resp.json();
  return { ok: resp.ok, status: resp.status, data: json };
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── 1. AuthN ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // ── 2. Body ───────────────────────────────────────────────────────────────
    const { payment_id } = (await req.json()) as { payment_id?: string };
    if (!payment_id) return json({ error: "Missing payment_id" }, 400);

    // ── 3. Charger paiement + rôle appelant ──────────────────────────────────
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .select("*")
      .eq("id", payment_id)
      .maybeSingle();
    if (payErr || !payment) return json({ error: "Payment not found" }, 404);

    const { data: callerRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const caller: ReleaseCaller = {
      id: user.id,
      isAdmin: callerRow?.role === "admin",
    };

    // ── 4. Garde-fous purs (authz + état + litige) ───────────────────────────
    const guard = canReleasePayment(payment, caller, Date.now());
    if (!guard.ok) return json({ error: guard.code }, guard.status);

    // ── 5. Vendeur onboardé ? (sinon on bloque proprement, fonds intacts) ─────
    const { data: seller } = await supabase
      .from("users")
      .select("stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled")
      .eq("id", payment.seller_id)
      .maybeSingle();
    const sellerReady =
      !!seller?.stripe_account_id &&
      seller?.stripe_charges_enabled !== false &&
      seller?.stripe_payouts_enabled !== false;
    if (!sellerReady) {
      await supabase
        .from("payments")
        .update({ release_blocked_reason: "seller_not_onboarded" })
        .eq("id", payment_id)
        .eq("transfer_state", "held");
      return json({ error: "seller_not_onboarded" }, 409);
    }

    // source_transaction = la charge d'origine (gère la dispo des fonds).
    if (!payment.stripe_charge_id) return json({ error: "no_charge_id" }, 409);

    // ── 6. Verrou optimiste anti-double : held → releasing ───────────────────
    const { data: locked } = await supabase
      .from("payments")
      .update({
        transfer_state: "releasing",
        release_attempts: (payment.release_attempts ?? 0) + 1,
        release_trigger: caller.isAdmin ? "admin" : "manual_buyer",
      })
      .eq("id", payment_id)
      .eq("transfer_state", "held")
      .is("stripe_transfer_id", null)
      .select("id");
    if (!locked || locked.length === 0) {
      // Déjà en cours / déjà libéré → ne PAS retenter (idempotent).
      return json({ error: "not_held_or_in_progress" }, 409);
    }

    // ── 7. Stripe Transfer (montant = amount_seller_ht, idempotent) ──────────
    const resv = reservationIdOf(payment);
    const tr = await stripeTransfer(
      {
        amount: String(transferAmountCents(payment)),
        currency: "eur",
        destination: seller!.stripe_account_id as string,
        source_transaction: payment.stripe_charge_id,
        "metadata[payment_id]": payment_id,
        "metadata[reservation_id]": resv.id ?? "",
        "metadata[type]": payment.type ?? "",
      },
      transferIdempotencyKey(payment_id),
    );

    // ── 8. Résultat ──────────────────────────────────────────────────────────
    if (tr.ok && tr.data?.id) {
      const buyerConfirmed = !caller.isAdmin && caller.id === payment.buyer_id;
      await supabase
        .from("payments")
        .update({
          transfer_state: "released",
          stripe_transfer_id: tr.data.id,
          released_at: new Date().toISOString(),
          last_release_error: null,
          ...(buyerConfirmed ? { buyer_confirmed_at: new Date().toISOString() } : {}),
        })
        .eq("id", payment_id);
      return json({ ok: true, transfer_id: tr.data.id, amount: transferAmountCents(payment) }, 200);
    }

    // Échec : classer et revenir à un état cohérent.
    const errCode: string | undefined = tr.data?.error?.code;
    const errMsg: string | undefined = tr.data?.error?.message;
    const klass = classifyTransferError(errCode, errMsg);
    const patch: Record<string, unknown> = { last_release_error: `${errCode ?? "?"}: ${errMsg ?? ""}`.slice(0, 500) };
    if (klass === "retryable") {
      patch.transfer_state = "held"; // on réessaiera (balance/dispo)
    } else if (klass === "blocked") {
      patch.transfer_state = "held";
      patch.release_blocked_reason = "transfer_blocked";
    } else {
      patch.transfer_state = "failed";
    }
    await supabase.from("payments").update(patch).eq("id", payment_id);
    return json({ error: "transfer_failed", class: klass, detail: errCode ?? errMsg }, klass === "fatal" ? 500 : 409);
  } catch (e) {
    console.error("release-payment error:", e instanceof Error ? e.message : e);
    return json({ error: "internal" }, 500);
  }
}

Deno.serve(handler);
