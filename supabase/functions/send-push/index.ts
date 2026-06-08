// ─────────────────────────────────────────────────────────────────────────────
// send-push — Lot P0 (serveur). Relaie une notification vers l'Expo Push API.
//
// Appelée par le trigger DB `trg_zz_push_on_message` (mig 059) via pg_net, à
// chaque notification de type 'message'. Reçoit { notification_id }.
//
// Sécurité : déployée --no-verify-jwt (appel interne pg_net, pas de session
// utilisateur). AuthN = header `x-push-secret` == PUSH_DISPATCH_SECRET.
//
// GARANTIES (P0) :
//   - ne throw JAMAIS (toujours un JSON + 200) ;
//   - 0 token actif → { status: 'skipped' } proprement ;
//   - ne traite QUE type='message' (garde-fou en plus du trigger) ;
//   - invalide les tokens morts (ticket Expo DeviceNotRegistered → active=false) ;
//   - aucun email, aucune préférence, aucune file, aucun receipt (hors P0).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUSH_SECRET = Deno.env.get("PUSH_DISPATCH_SECRET") ?? "";
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method !== "POST") return json({ status: "failed", error: "method" });

    // AuthN : secret partagé (pas de JWT, appel pg_net interne).
    if (!PUSH_SECRET || req.headers.get("x-push-secret") !== PUSH_SECRET) {
      console.warn("send-push: secret invalide ou manquant");
      return json({ status: "failed", error: "unauthorized" });
    }

    const { notification_id } = await req.json().catch(() => ({}));
    if (!notification_id) return json({ status: "failed", error: "notification_id manquant" });

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Charger la notification (service_role → bypass RLS).
    const { data: notif } = await sb
      .from("notifications")
      .select("id, destinataire_id, titre, message, type, action_url")
      .eq("id", notification_id)
      .single();
    if (!notif) return json({ status: "skipped", reason: "notif introuvable" });
    if (notif.type !== "message") return json({ status: "skipped", reason: "type non-message" });

    // 2) Tokens actifs du destinataire (multi-appareils).
    const { data: tokens } = await sb
      .from("push_tokens")
      .select("token")
      .eq("user_id", notif.destinataire_id)
      .eq("active", true);
    if (!tokens || tokens.length === 0) {
      return json({ status: "skipped", reason: "0 token actif" });
    }

    // 3) Construire le batch Expo (≤100 ici, volume P0 faible).
    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      title: notif.titre ?? "Equishow",
      body: notif.message ?? "Nouveau message",
      data: { actionUrl: notif.action_url ?? "/messagerie" },
      sound: "default",
      channelId: "default",
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`send-push: Expo ${res.status}: ${body.slice(0, 200)}`);
      return json({ status: "failed", error: `expo ${res.status}` });
    }

    const out = await res.json().catch(() => ({} as Record<string, unknown>));
    const tickets = Array.isArray((out as { data?: unknown }).data)
      ? (out as { data: Array<{ status?: string; details?: { error?: string } }> }).data
      : [];

    // 4) Invalider les tokens morts (DeviceNotRegistered).
    const dead: string[] = [];
    tickets.forEach((tk, i) => {
      if (tk?.status === "error" && tk?.details?.error === "DeviceNotRegistered") {
        dead.push(messages[i].to);
      }
    });
    if (dead.length > 0) {
      await sb.from("push_tokens").update({ active: false }).in("token", dead);
    }

    return json({ status: "sent", count: messages.length, invalidated: dead.length });
  } catch (e) {
    // Ne jamais throw : log + 200.
    console.error("send-push error:", e instanceof Error ? e.message : e);
    return json({ status: "failed", error: "internal" });
  }
});
