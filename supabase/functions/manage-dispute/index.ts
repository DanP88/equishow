// ─────────────────────────────────────────────────────────────────────────────
// manage-dispute — Workflow backend litiges (V2 séquestre, PHASE 6).
//
// Actions :
//   • open    : le CAVALIER (acheteur) ou un ADMIN ouvre un litige interne.
//               → trace payment_disputes + bloque la libération si fonds retenus.
//   • resolve : ADMIN uniquement. outcome='release' (débloque) ou 'refund'
//               (marque résolu, reste bloqué ; le remboursement passe par
//               process-refund).
//
// Le VENDEUR ne peut jamais agir ici. Aucun impact legacy : sur un paiement
// 'not_applicable' (destination charge), on ne bloque pas (shouldBlockOnDispute
// = false) — seul l'audit est créé. Pas de front, pas de cron.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { shouldBlockOnDispute } from "../_shared/escrow.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { payment_id, action, outcome, reason } = (await req.json()) as {
      payment_id?: string;
      action?: "open" | "resolve";
      outcome?: "release" | "refund";
      reason?: string;
    };
    if (!payment_id) return json({ error: "Missing payment_id" }, 400);
    if (action !== "open" && action !== "resolve") return json({ error: "Invalid action" }, 400);

    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .select("id, buyer_id, seller_id, transfer_state, dispute_status")
      .eq("id", payment_id)
      .maybeSingle();
    if (payErr || !payment) return json({ error: "Payment not found" }, 404);

    const { data: callerRow } = await supabase
      .from("users").select("role").eq("id", user.id).maybeSingle();
    const isAdmin = callerRow?.role === "admin";

    // Le vendeur ne peut JAMAIS agir sur un litige de son propre paiement.
    if (user.id === payment.seller_id) return json({ error: "seller_forbidden" }, 403);

    if (action === "open") {
      // Acheteur (le sien) ou admin.
      if (!isAdmin && user.id !== payment.buyer_id) return json({ error: "forbidden" }, 403);

      // Idempotence : pas de doublon si un litige est déjà ouvert.
      const { data: existing } = await supabase
        .from("payment_disputes")
        .select("id").eq("payment_id", payment_id).eq("status", "open").limit(1);
      if (!existing || existing.length === 0) {
        await supabase.from("payment_disputes").insert({
          payment_id,
          source: isAdmin ? "admin" : "buyer",
          status: "open",
          reason: reason ?? null,
          opened_by: user.id,
        });
      }
      // Bloque la libération si les fonds sont encore retenus (escrow).
      if (shouldBlockOnDispute(payment.transfer_state)) {
        await supabase
          .from("payments")
          .update({ dispute_status: "open", release_blocked_reason: "dispute" })
          .eq("id", payment_id);
      }
      return json({ ok: true, blocked: shouldBlockOnDispute(payment.transfer_state) }, 200);
    }

    // action === "resolve" → ADMIN uniquement
    if (!isAdmin) return json({ error: "admin_only" }, 403);

    if (outcome === "release") {
      // Débloque UNIQUEMENT un litige INTERNE ('dispute'). Un blocage 'chargeback'
      // (litige bancaire Stripe en cours) ne peut PAS être levé par l'admin ici —
      // il se résout via charge.dispute.closed (won). Sécurité anti-versement
      // pendant un chargeback ouvert.
      await supabase
        .from("payments")
        .update({ dispute_status: null, release_blocked_reason: null })
        .eq("id", payment_id)
        .eq("release_blocked_reason", "dispute");
      await supabase
        .from("payment_disputes")
        .update({ status: "resolved_release", resolved_at: new Date().toISOString(), resolved_by: user.id })
        .eq("payment_id", payment_id).eq("status", "open");
      return json({ ok: true, resolution: "release" }, 200);
    }
    if (outcome === "refund") {
      // Marque résolu en faveur du remboursement ; reste bloqué (pas de release).
      // Le remboursement effectif passe par process-refund (reverse_transfer si released).
      await supabase
        .from("payment_disputes")
        .update({ status: "resolved_refund", resolved_at: new Date().toISOString(), resolved_by: user.id })
        .eq("payment_id", payment_id).eq("status", "open");
      return json({ ok: true, resolution: "refund", note: "call process-refund to actually refund" }, 200);
    }
    return json({ error: "Invalid outcome" }, 400);
  } catch (e) {
    console.error("manage-dispute error:", e instanceof Error ? e.message : e);
    return json({ error: "internal" }, 500);
  }
}

Deno.serve(handler);
