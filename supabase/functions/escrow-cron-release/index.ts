// ─────────────────────────────────────────────────────────────────────────────
// escrow-cron-release — Backstop de libération automatique (V2 séquestre).
//
// Appelé par pg_cron (via pg_net) — PAS par un utilisateur. AuthN par en-tête
// `x-cron-secret` (== env CRON_SECRET). Déployer avec --no-verify-jwt.
//
// Rôle : empêcher qu'un paiement reste 'held' indéfiniment. Libère (Stripe
// Transfer) tous les paiements séquestre :
//   • transfer_state = 'held', non bloqués (pas de litige/chargeback),
//   • dont la date de libération est échue (release_due_at <= now), OU à défaut
//     dont paid_at + escrow_hard_cap_days est dépassé (filet ultime).
//
// Réutilise EXACTEMENT les invariants de release-payment :
//   • montant = amount_seller_ht (jamais recalculé),
//   • Idempotency-Key transfer:{payment_id} + verrou optimiste held→releasing,
//   • vendeur onboardé requis, sinon on laisse 'held' (release_blocked_reason).
// Inerte tant qu'aucun paiement n'est 'held' (escrow off → aucune ligne).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import {
  canReleasePayment,
  classifyTransferError,
  isReleaseDue,
  loadEscrowSettings,
  reservationIdOf,
  transferAmountCents,
  transferIdempotencyKey,
} from "../_shared/escrow.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const DAY_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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
  const j = await resp.json();
  return { ok: resp.ok, status: resp.status, data: j };
}

const CRON_CALLER = { id: "__cron__", isAdmin: false, isCron: true as const };

// Libère un paiement (verrou + Stripe Transfer + update). Renvoie un statut court.
async function releaseOne(supabase: any, payment: any, nowMs: number): Promise<string> {
  // Garde-fous purs (état + litige + timing cron via release_due_at).
  const guard = canReleasePayment(payment, CRON_CALLER, nowMs);
  if (!guard.ok) return `skip:${guard.code}`;

  // Vendeur onboardé ? sinon on laisse 'held', motif tracé (retentable).
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
      .eq("id", payment.id)
      .eq("transfer_state", "held");
    return "skip:seller_not_onboarded";
  }
  if (!payment.stripe_charge_id) return "skip:no_charge_id";

  // Verrou optimiste anti-double : held → releasing.
  const { data: locked } = await supabase
    .from("payments")
    .update({
      transfer_state: "releasing",
      release_attempts: (payment.release_attempts ?? 0) + 1,
      release_trigger: "cron",
    })
    .eq("id", payment.id)
    .eq("transfer_state", "held")
    .is("stripe_transfer_id", null)
    .select("id");
  if (!locked || locked.length === 0) return "skip:not_held_or_in_progress";

  const resv = reservationIdOf(payment);
  const tr = await stripeTransfer(
    {
      amount: String(transferAmountCents(payment)),
      currency: "eur",
      destination: seller!.stripe_account_id as string,
      source_transaction: payment.stripe_charge_id,
      "metadata[payment_id]": payment.id,
      "metadata[reservation_id]": resv.id ?? "",
      "metadata[type]": payment.type ?? "",
    },
    transferIdempotencyKey(payment.id),
  );

  if (tr.ok && tr.data?.id) {
    await supabase
      .from("payments")
      .update({
        transfer_state: "released",
        stripe_transfer_id: tr.data.id,
        released_at: new Date().toISOString(),
        last_release_error: null,
      })
      .eq("id", payment.id);
    return "released";
  }

  // Échec → état cohérent (même classification que release-payment).
  const errCode: string | undefined = tr.data?.error?.code;
  const errMsg: string | undefined = tr.data?.error?.message;
  const klass = classifyTransferError(errCode, errMsg);
  const patch: Record<string, unknown> = {
    last_release_error: `${errCode ?? "?"}: ${errMsg ?? ""}`.slice(0, 500),
  };
  if (klass === "retryable") patch.transfer_state = "held";
  else if (klass === "blocked") {
    patch.transfer_state = "held";
    patch.release_blocked_reason = "transfer_blocked";
  } else patch.transfer_state = "failed";
  await supabase.from("payments").update(patch).eq("id", payment.id);
  return `error:${klass}:${errCode ?? errMsg ?? "?"}`;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok");

  // AuthN : secret cron uniquement (pas de JWT utilisateur).
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const nowMs = Date.now();

    const settings = await loadEscrowSettings(supabase);
    const hardCapDays = Number(settings["escrow_hard_cap_days"] ?? 14) || 14;

    // Candidats : held, succeeded, non versés, non bloqués, sans litige ouvert.
    const { data: candidates, error } = await supabase
      .from("payments")
      .select("*")
      .eq("transfer_state", "held")
      .eq("payment_status", "succeeded")
      .is("stripe_transfer_id", null)
      .is("release_blocked_reason", null)
      .is("dispute_status", null)
      .limit(200);
    if (error) return json({ error: "query_failed", detail: error.message }, 500);

    const results: Record<string, number> = {};
    const releasedIds: string[] = [];

    for (const p of candidates ?? []) {
      if (!isReleaseDue(p, hardCapDays, nowMs)) {
        results["skip:not_due"] = (results["skip:not_due"] ?? 0) + 1;
        continue;
      }
      // Hard-cap (pas de release_due_at) : synthétise une date échue pour que la
      // garde timing cron de canReleasePayment passe (la décision d'échéance a
      // déjà été prise par isReleaseDue).
      let payment = p;
      if (!p.release_due_at) {
        const baseMs = Date.parse(p.paid_at ?? p.created_at ?? "");
        payment = { ...p, release_due_at: new Date(baseMs + hardCapDays * DAY_MS).toISOString() };
      }

      const r = await releaseOne(supabase, payment, nowMs);
      results[r] = (results[r] ?? 0) + 1;
      if (r === "released") releasedIds.push(p.id);
    }

    return json(
      { ok: true, scanned: candidates?.length ?? 0, results, released: releasedIds },
      200,
    );
  } catch (e) {
    console.error("escrow-cron-release error:", e instanceof Error ? e.message : e);
    return json({ error: "internal" }, 500);
  }
}

Deno.serve(handler);
