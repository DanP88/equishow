import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

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
    // 1. VALIDER LE JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return failClosed("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      logSecurityEvent("password_change_unauthorized", "unknown", "invalid_token");
      return failClosed("Unauthorized");
    }

    // 2. VÉRIFIER RATE LIMITING
    const rateLimitKey = ["rate-limit", "password-change", user.id];
    const rateLimitRecord = await Deno.kv.get(rateLimitKey);
    const attempts = (rateLimitRecord?.value as { count: number; resetAt: number }) || {
      count: 0,
      resetAt: Date.now() + 60 * 60 * 1000,
    };

    if (Date.now() < attempts.resetAt && attempts.count >= 3) {
      logSecurityEvent("password_change_rate_limited", user.id, "exceeded_3_per_hour");
      return new Response(
        JSON.stringify({ success: false, error: "Too many attempts. Try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. PARSER LE BODY
    const body = (await req.json()) as ChangePasswordRequest;
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "currentPassword and newPassword are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. VÉRIFIER L'ANCIEN MOT DE PASSE via Supabase Auth
    // signInWithPassword est la seule façon correcte de vérifier le mot de passe
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      attempts.count += 1;
      await Deno.kv.set(rateLimitKey, attempts, { expireIn: 60 * 60 * 1000 });
      logSecurityEvent("password_change_invalid_password", user.id, `attempt_${attempts.count}`);
      return new Response(
        JSON.stringify({ success: false, error: "Le mot de passe actuel est incorrect" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. VALIDER LE NOUVEAU MOT DE PASSE
    const validation = validateNewPassword(newPassword, currentPassword);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. CHANGER LE MOT DE PASSE VIA SUPABASE AUTH ADMIN
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      logSecurityEvent("password_change_update_failed", user.id, updateError.message);
      return failClosed("Password update failed");
    }

    // 7. LOG D'AUDIT
    try {
      await supabaseAdmin
        .from("security_audit_log")
        .insert({
          action: "password_change",
          user_id: user.id,
          ip_address: getClientIp(req),
          user_agent: req.headers.get("user-agent"),
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error("Failed to log security action:", error);
    }

    // 8. RÉINITIALISER RATE LIMIT APRÈS SUCCÈS
    attempts.count = 0;
    await Deno.kv.set(rateLimitKey, attempts);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Password change error:", error);
    return failClosed("Internal server error");
  }
});

function validateNewPassword(
  newPassword: string,
  oldPassword: string
): { valid: boolean; error?: string } {
  if (newPassword.length < 8) {
    return { valid: false, error: "Le mot de passe doit contenir au moins 8 caractères" };
  }
  if (newPassword === oldPassword) {
    return { valid: false, error: "Le nouveau mot de passe doit être différent" };
  }
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(newPassword);
  const complexity = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  if (complexity < 3) {
    return {
      valid: false,
      error: "Le mot de passe doit contenir majuscules, minuscules, chiffres et caractères spéciaux",
    };
  }
  return { valid: true };
}

function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  const forwarded = req.headers.get("x-forwarded-for");
  return cfIp || forwarded?.split(",")[0]?.trim() || "unknown";
}

function failClosed(message: string): Response {
  console.error("[SECURITY] Fail-closed:", message);
  return new Response(
    JSON.stringify({ success: false, error: "Service temporarily unavailable" }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function logSecurityEvent(event: string, userId: string, detail: string): void {
  console.log("[SECURITY_EVENT]", {
    timestamp: new Date().toISOString(),
    event,
    user_id_hash: userId.substring(0, 8),
    detail,
  });
}
