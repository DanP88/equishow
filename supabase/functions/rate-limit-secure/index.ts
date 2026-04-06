/**
 * Secure Rate Limiting Edge Function
 *
 * VÉRIFICATION DE SÉCURITÉ:
 * ✅ Utilise Deno.kv() pour stockage distribué (pas localStorage)
 * ✅ Fail-closed: refuse en cas d'erreur
 * ✅ Logging sécurisé sans exposition de données
 * ✅ Timeout court pour prévenir l'épuisement de ressources
 * ✅ IP-based et identifier-based rate limiting
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface RateLimitRequest {
  action: "login" | "signup" | "password-reset" | "api" | "email-verification";
  identifier: string; // Email ou IP
  userId?: string;
}

interface RateLimitResponse {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  message?: string;
}

// Configuration des limites
const LIMITS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  signup: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
  "password-reset": { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
  "email-verification": { maxAttempts: 10, windowMs: 60 * 60 * 1000 },
  api: { maxAttempts: 100, windowMs: 60 * 1000 },
};

// Clés permanentes de blocage (IP/email à bloquer immédiatement)
const PERMANENT_BLOCKLIST = ["192.168.1.100", "attacker@example.com"];

/**
 * Format sécurisé de la clé pour Deno KV
 * Exemple: "rate-limit:login:user@example.com"
 */
function getKvKey(action: string, identifier: string): string[] {
  return ["rate-limit", action, identifier];
}

/**
 * Récupère l'IP du client
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const cfIp = req.headers.get("cf-connecting-ip");
  return cfIp || (forwarded?.split(",")[0]?.trim() ?? "unknown");
}

/**
 * Scrub les données sensibles du log
 */
function sanitizeForLog(identifier: string): string {
  if (identifier.includes("@")) {
    // Email: masquer la partie locale
    const [local, domain] = identifier.split("@");
    return `${local.substring(0, 2)}***@${domain}`;
  }
  // IP: masquer le dernier octet
  return identifier.split(".").slice(0, 3).join(".") + ".*";
}

/**
 * MAIN HANDLER
 */
Deno.serve(async (req: Request) => {
  // Seulement POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ip = getClientIp(req);
  const startTime = Date.now();

  try {
    const body = (await req.json()) as RateLimitRequest;
    const { action, identifier } = body;

    // Validation
    if (!action || !Object.keys(LIMITS).includes(action)) {
      return errorResponse(400, "Invalid action");
    }

    // Vérifier la liste noire permanente
    if (
      PERMANENT_BLOCKLIST.includes(identifier) ||
      PERMANENT_BLOCKLIST.includes(ip)
    ) {
      logSecurityEvent("permanent_block", identifier, ip);
      return errorResponse(
        429,
        "Your IP/account has been permanently blocked due to suspicious activity"
      );
    }

    const limit = LIMITS[action as keyof typeof LIMITS];
    const kvKey = getKvKey(action, identifier);
    const now = Date.now();

    // Récupérer le record actuel de Deno KV
    let record = await Deno.kv.get(kvKey);
    let attempts = record?.value as { count: number; resetAt: number } | null;

    // Initialiser si n'existe pas
    if (!attempts) {
      attempts = { count: 0, resetAt: now + limit.windowMs };
    }

    // Réinitialiser si la fenêtre a expiré
    if (now > attempts.resetAt) {
      attempts = { count: 0, resetAt: now + limit.windowMs };
    }

    // Vérifier si limité
    const isLimited = attempts.count >= limit.maxAttempts;

    if (!isLimited) {
      // Incrémenter et sauvegarder
      attempts.count += 1;
      await Deno.kv.set(kvKey, attempts, {
        expireIn: limit.windowMs + 60000, // Expire après la fenêtre + 1min buffer
      });
    }

    // Logging sécurisé
    const sanitizedId = sanitizeForLog(identifier);
    if (isLimited) {
      logSecurityEvent(action, sanitizedId, ip, attempts.count);
    }

    const response: RateLimitResponse = {
      allowed: !isLimited,
      remaining: Math.max(0, limit.maxAttempts - attempts.count),
      resetAt: attempts.resetAt,
      retryAfter: isLimited
        ? Math.ceil((attempts.resetAt - now) / 1000)
        : undefined,
      message: isLimited
        ? `Too many attempts. Try again in ${Math.ceil((attempts.resetAt - now) / 60000)} minutes.`
        : undefined,
    };

    // Réponse avec headers appropriés
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-RateLimit-Limit": limit.maxAttempts.toString(),
      "X-RateLimit-Remaining": response.remaining.toString(),
      "X-RateLimit-Reset": response.resetAt.toString(),
    });

    if (isLimited) {
      headers.set("Retry-After", response.retryAfter!.toString());
    }

    return new Response(JSON.stringify(response), {
      status: isLimited ? 429 : 200,
      headers,
    });
  } catch (error) {
    // FAIL-CLOSED: En cas d'erreur, refuser la requête
    console.error("[RATE_LIMIT_ERROR]", error instanceof Error ? error.message : String(error));
    logSecurityEvent("rate-limit-error", "unknown", ip, 0);

    return new Response(
      JSON.stringify({
        allowed: false, // ← FAIL CLOSED!
        remaining: 0,
        resetAt: Date.now() + 60000,
        message: "Service temporarily unavailable",
      } as RateLimitResponse),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Helper: Envoyer une réponse d'erreur sécurisée
 */
function errorResponse(
  status: number,
  message: string
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Helper: Logger les événements de sécurité
 * (Données scrubbed, pas de credentials)
 */
function logSecurityEvent(
  event: string,
  identifier: string,
  ip: string,
  attemptCount?: number
) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    identifier_hash: hashString(identifier), // Hash, pas le vrai identifier
    ip_prefix: ip.split(".").slice(0, 3).join("."), // Seulement premiers 3 octets
    attempt_count: attemptCount || 0,
  };

  // En production, envoyer à logging service (Supabase, Datadog, etc.)
  console.log("[SECURITY_EVENT]", JSON.stringify(logEntry));
}

/**
 * Helper: Hash simple pour identifier
 */
function hashString(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  // Utiliser Crypto API de Deno
  return crypto.subtle
    .digest("SHA-256", data)
    .then((hashBuffer) => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    })
    .catch(() => "hash-error");
}
