import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

// ─────────────────────────────────────────────────────────────────────────────
// create-boost-checkout — Stripe Checkout pour Boost Coach (4,90€/30j)
//
// Logique 100% séparée de create-checkout-session :
// - pas de Stripe Connect / pas de transfer_data (plateforme garde tout)
// - écrit dans coach_boost_purchases (pas dans payments)
// - metadata.kind = 'boost' → routé par webhook-stripe vers fn_apply_boost
//
// Sécurité :
// - JWT obligatoire
// - User doit avoir role='coach'
// - Row purchase insérée AVANT Stripe (idempotence + audit)
// - Cleanup row si Stripe fail
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://equishow.vercel.app";

// Paramétrage produit (à externaliser dans une table config plus tard si besoin)
const BOOST_AMOUNT_CENTS = 490;       // 4,90€
const BOOST_DURATION_DAYS = 30;
const BOOST_LABEL = "Boost Coach Equishow — 30 jours";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. AuthN ─────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // ── 2. Vérifier rôle coach ──────────────────────────────────────────
    const { data: profile, error: profErr } = await supabase
      .from("users")
      .select("id, role, email")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr || !profile) {
      return jsonResponse({ error: "Profil introuvable" }, 404);
    }
    if (profile.role !== "coach" && profile.role !== "admin") {
      return jsonResponse(
        { error: "Le Boost est réservé aux coachs." },
        403,
      );
    }

    // ── 3. Vérifier qu'un coach_profile existe (sinon Boost sans effet) ──
    const { data: coachProf, error: cpErr } = await supabase
      .from("coach_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (cpErr || !coachProf) {
      return jsonResponse(
        { error: "Crée d'abord ton profil coach avant de booster." },
        409,
      );
    }

    // ── 4. Insérer la row purchase (pending) AVANT Stripe ───────────────
    const { data: inserted, error: insertErr } = await supabase
      .from("coach_boost_purchases")
      .insert({
        user_id: user.id,
        amount_cents: BOOST_AMOUNT_CENTS,
        duration_days: BOOST_DURATION_DAYS,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("Boost purchase insert failed:", insertErr?.message);
      return jsonResponse({ error: "Impossible de créer l'achat" }, 500);
    }

    const purchaseId: string = inserted.id;

    // ── 5. Créer la session Stripe Checkout ─────────────────────────────
    const formData = new URLSearchParams();
    formData.append("mode", "payment");
    formData.append("payment_method_types[]", "card");
    formData.append(
      "success_url",
      `${APP_URL}/boost-success?session_id={CHECKOUT_SESSION_ID}`,
    );
    formData.append("cancel_url", `${APP_URL}/boost-cancelled`);
    if (profile.email) formData.append("customer_email", profile.email);

    formData.append("line_items[0][price_data][currency]", "eur");
    formData.append("line_items[0][price_data][product_data][name]", BOOST_LABEL);
    formData.append(
      "line_items[0][price_data][unit_amount]",
      String(BOOST_AMOUNT_CENTS),
    );
    formData.append("line_items[0][quantity]", "1");

    // Métadonnées indispensables pour le webhook (kind='boost' = router)
    formData.append("payment_intent_data[metadata][kind]", "boost");
    formData.append("payment_intent_data[metadata][boost_purchase_id]", purchaseId);
    formData.append("payment_intent_data[metadata][user_id]", user.id);
    formData.append("metadata[kind]", "boost");
    formData.append("metadata[boost_purchase_id]", purchaseId);
    formData.append("metadata[user_id]", user.id);

    const stripeResp = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      },
    );
    const stripeData = await stripeResp.json();

    if (!stripeResp.ok) {
      console.error("Stripe Boost session failed:", stripeData?.error?.code);
      // Cleanup row orpheline
      await supabase
        .from("coach_boost_purchases")
        .delete()
        .eq("id", purchaseId);
      return jsonResponse(
        { error: stripeData?.error?.message ?? "Erreur Stripe" },
        400,
      );
    }

    // ── 6. Marquer la purchase avec session_id Stripe ───────────────────
    await supabase
      .from("coach_boost_purchases")
      .update({
        stripe_checkout_session_id: stripeData.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchaseId);

    return jsonResponse(
      {
        sessionId: stripeData.id,
        checkoutUrl: stripeData.url,
        purchaseId,
        amountCents: BOOST_AMOUNT_CENTS,
        durationDays: BOOST_DURATION_DAYS,
      },
      200,
    );
  } catch (error) {
    console.error(
      "create-boost-checkout error:",
      error instanceof Error ? error.message : "unknown",
    );
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
}

Deno.serve(handler);
