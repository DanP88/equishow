import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RateLimitRequest {
  action: "login" | "signup" | "api" | "password-reset";
  identifier: string;
}

interface RateLimitResponse {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  message?: string;
}

const LIMITS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  signup: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
  api: { maxAttempts: 100, windowMs: 60 * 1000 },
  "password-reset": { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
} as const;

const MESSAGES: Record<string, string> = {
  login: "Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.",
  signup: "Trop de tentatives d'inscription. Veuillez réessayer dans 1 heure.",
  api: "Trop de requêtes. Veuillez réessayer dans 1 minute.",
  "password-reset": "Trop de tentatives de réinitialisation. Veuillez réessayer dans 1 heure.",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as RateLimitRequest;
    const { action, identifier } = body;

    if (!action || !identifier || !LIMITS[action]) {
      return new Response(
        JSON.stringify({ error: "Invalid action or missing identifier" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const limit = LIMITS[action];
    const kvKey = ["rate-limit", action, identifier];
    const now = Date.now();

    const kv = await Deno.openKv();
    const record = await kv.get<{ count: number; resetAt: number }>(kvKey);

    let { count, resetAt } = record.value ?? { count: 0, resetAt: now + limit.windowMs };

    // Reset if window has expired
    if (now > resetAt) {
      count = 0;
      resetAt = now + limit.windowMs;
    }

    const isLimited = count >= limit.maxAttempts;

    if (!isLimited) {
      count += 1;
      const ttl = resetAt - now;
      await kv.set(kvKey, { count, resetAt }, { expireIn: ttl });
    }

    const response: RateLimitResponse = {
      allowed: !isLimited,
      remaining: Math.max(0, limit.maxAttempts - count),
      resetAt,
      ...(isLimited && { message: MESSAGES[action] }),
    };

    return new Response(JSON.stringify(response), {
      status: isLimited ? 429 : 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-RateLimit-Limit": limit.maxAttempts.toString(),
        "X-RateLimit-Remaining": response.remaining.toString(),
        "X-RateLimit-Reset": resetAt.toString(),
      },
    });
  } catch (error) {
    console.error("Rate limit error:", error);
    // Fail open — don't block legitimate requests on internal error
    return new Response(
      JSON.stringify({ allowed: true, remaining: -1, resetAt: 0 } as RateLimitResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
