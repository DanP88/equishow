const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type, demandId, reservationId, amount, description } = body;

    if (!type) {
      return new Response(
        JSON.stringify({ error: "Missing type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For now, create a simple checkout session
    const checkoutData = {
      payment_method_types: ["card"],
      mode: "payment",
      success_url: `https://equishow.com/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://equishow.com/cancelled`,
      line_items: {
        0: {
          price_data: {
            currency: "eur",
            product_data: {
              name: description || `Payment for ${type}`,
            },
            unit_amount: Math.round((amount || 0) * 100),
          },
          quantity: 1,
        },
      },
    };

    // Call Stripe API
    const formData = new URLSearchParams();
    formData.append("payment_method_types[]", "card");
    formData.append("mode", "payment");
    formData.append("success_url", checkoutData.success_url);
    formData.append("cancel_url", checkoutData.cancel_url);
    formData.append("line_items[0][price_data][currency]", "eur");
    formData.append("line_items[0][price_data][product_data][name]", checkoutData.line_items[0].price_data.product_data.name);
    formData.append("line_items[0][price_data][unit_amount]", String(checkoutData.line_items[0].price_data.unit_amount));
    formData.append("line_items[0][quantity]", "1");

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const stripeData = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error("Stripe error:", stripeData);
      return new Response(
        JSON.stringify({ error: stripeData.error?.message || "Stripe error" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        sessionId: stripeData.id,
        checkoutUrl: stripeData.url,
        paymentId: stripeData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
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
