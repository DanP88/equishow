// ─────────────────────────────────────────────────────────────────────────────
// _shared/email.ts — Envoi d'emails transactionnels (Resend) + idempotence.
//
// Utilisé en service_role par webhook-stripe (paiements) et par l'Edge Function
// send-reservation-email (réservation confirmée). GARANTIES :
//   - ne throw JAMAIS (le webhook ne doit jamais être bloqué par l'email) ;
//   - idempotent via email_events.event_key (UNIQUE) : un 2e appel = skip ;
//   - aucun calcul de montant/commission (affichage seulement).
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildEventKey,
  renderEmail,
  type EmailEventType,
  type EmailModule,
  type EmailRole,
  type EmailTemplateData,
} from "./email-templates.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Equishow <no-reply@equishow.app>";
const EMAIL_REPLY_TO = Deno.env.get("EMAIL_REPLY_TO") ?? "";

export interface SendParams {
  supabase: any; // client service_role (bypass RLS)
  eventType: EmailEventType;
  module: EmailModule;
  role: EmailRole;
  idemId: string; // stripe_event_id (paiement) ou id réservation (accept)
  recipientId?: string | null;
  recipientEmail: string;
  relatedPaymentId?: string | null;
  relatedEntityId?: string | null;
  data: EmailTemplateData;
}

export interface SendResult {
  status: "sent" | "skipped" | "failed";
  error?: string;
}

async function markFailed(supabase: any, eventKey: string, error: string): Promise<void> {
  try {
    await supabase
      .from("email_events")
      .update({ status: "failed", error_message: error.slice(0, 500) })
      .eq("event_key", eventKey);
  } catch (_) {
    // best-effort
  }
}

/**
 * Envoie un email transactionnel idempotent. Ne lève jamais d'exception :
 * retourne toujours un SendResult, même en cas d'erreur réseau/provider.
 */
export async function sendTransactional(p: SendParams): Promise<SendResult> {
  const eventKey = buildEventKey(p.eventType, p.module, p.idemId, p.role);
  try {
    if (!p.recipientEmail) return { status: "failed", error: "recipientEmail manquant" };

    // 1) Idempotence : on pose la ligne `pending`. Conflit UNIQUE => déjà traité.
    const { error: insErr } = await p.supabase.from("email_events").insert({
      event_key: eventKey,
      event_type: p.eventType,
      module: p.module,
      recipient_id: p.recipientId ?? null,
      recipient_role: p.role,
      recipient_email: p.recipientEmail,
      related_payment_id: p.relatedPaymentId ?? null,
      related_entity_id: p.relatedEntityId ?? null,
      status: "pending",
    });
    if (insErr) {
      if ((insErr as { code?: string }).code === "23505") return { status: "skipped" };
      return { status: "failed", error: insErr.message };
    }

    // 2) Envoi via Resend.
    if (!RESEND_API_KEY) {
      await markFailed(p.supabase, eventKey, "RESEND_API_KEY manquant");
      return { status: "failed", error: "RESEND_API_KEY manquant" };
    }
    const mail = renderEmail(p.eventType, p.module, p.role, p.data);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [p.recipientEmail],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      await markFailed(p.supabase, eventKey, `Resend ${res.status}: ${body.slice(0, 200)}`);
      return { status: "failed", error: `Resend ${res.status}` };
    }
    const json = await res.json().catch(() => ({} as { id?: string }));
    await p.supabase
      .from("email_events")
      .update({
        status: "sent",
        provider_message_id: json.id ?? null,
        sent_at: new Date().toISOString(),
      })
      .eq("event_key", eventKey);
    return { status: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await markFailed(p.supabase, eventKey, msg);
    return { status: "failed", error: msg };
  }
}

/**
 * Résout (email, nom affichable) d'un user en service_role. Ne throw jamais.
 */
export async function getUserContact(
  supabase: any,
  userId: string | null | undefined,
): Promise<{ email: string | null; name: string }> {
  if (!userId) return { email: null, name: "" };
  try {
    const { data } = await supabase
      .from("users")
      .select("email, prenom, nom")
      .eq("id", userId)
      .single();
    if (!data) return { email: null, name: "" };
    const name = `${data.prenom ?? ""} ${data.nom ?? ""}`.trim();
    return { email: data.email ?? null, name };
  } catch (_) {
    return { email: null, name: "" };
  }
}
