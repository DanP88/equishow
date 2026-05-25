// ─────────────────────────────────────────────────────────────────────────────
// send-reservation-email — Email « réservation confirmée » aux DEUX parties.
//
// Appelée par le FRONT quand le vendeur (coach/loueur) valide une demande.
// NE TRAITE QUE l'événement reservation_confirmed — aucun email de paiement
// ne part d'ici (les paiements = webhook-stripe, source de vérité unique).
//
// Sécurité : verify_jwt + on vérifie que le caller est bien le vendeur de la
// réservation (sinon 403) → pas de spam. Emails résolus en service_role, jamais
// renvoyés au front. Échec d'email => 200 quand même (ne bloque pas le front).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { sendTransactional, getUserContact } from "../_shared/email.ts";
import type { EmailModule } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Mapping module → table + colonnes des deux parties.
const MODULE_CONFIG: Record<EmailModule, { table: string; buyerCol: string; sellerCol: string }> = {
  course: { table: "course_demands", buyerCol: "cavalier_id", sellerCol: "coach_id" },
  stage: { table: "stage_reservations", buyerCol: "cavalier_id", sellerCol: "coach_id" },
  transport: { table: "transport_reservations", buyerCol: "buyer_id", sellerCol: "seller_id" },
  box: { table: "box_reservations", buyerCol: "buyer_id", sellerCol: "seller_id" },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fmtDate(v: unknown): string | undefined {
  if (!v) return undefined;
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) AuthN
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    // 2) Body
    const { module, reservationId } = (await req.json()) as {
      module?: EmailModule;
      reservationId?: string;
    };
    if (!module || !MODULE_CONFIG[module]) return json({ error: "Invalid module" }, 400);
    if (!reservationId) return json({ error: "Missing reservationId" }, 400);

    const cfg = MODULE_CONFIG[module];

    // 3) Charger la réservation (service_role)
    const { data: item, error: itemErr } = await supabase
      .from(cfg.table)
      .select("*")
      .eq("id", reservationId)
      .maybeSingle();
    if (itemErr || !item) return json({ error: "Reservation not found" }, 404);

    const buyerId = item[cfg.buyerCol] as string | null;
    const sellerId = item[cfg.sellerCol] as string | null;
    if (!buyerId || !sellerId) return json({ error: "Reservation has no buyer/seller" }, 400);

    // 4) AuthZ : seul le vendeur (celui qui valide) peut déclencher l'email.
    if (sellerId !== user.id) return json({ error: "Forbidden" }, 403);

    // 5) Données d'affichage (lecture seule — aucun calcul de montant)
    const entityTitle = (item.title ?? item.stage_titre) as string | undefined;
    const lieu = (item.lieu ?? item.concours_nom) as string | undefined;
    const dateLabel = fmtDate(item.date_debut ?? item.date_trajet ?? item.date_reservation);
    const amountEur = (item.total_amount_ttc ?? item.price_total_ttc) as number | undefined;

    // 6) Résoudre les emails des deux parties
    const [buyer, seller] = await Promise.all([
      getUserContact(supabase, buyerId),
      getUserContact(supabase, sellerId),
    ]);

    // 7) Envoyer aux deux (best-effort, idempotent). idemId = reservationId.
    const results: Record<string, string> = {};
    if (buyer.email) {
      const r = await sendTransactional({
        supabase,
        eventType: "reservation_confirmed",
        module,
        role: "buyer",
        idemId: reservationId,
        recipientId: buyerId,
        recipientEmail: buyer.email,
        relatedEntityId: reservationId,
        data: { recipientName: buyer.name, counterpartName: seller.name, entityTitle, lieu, dateLabel, amountEur },
      });
      results.buyer = r.status;
    } else {
      results.buyer = "no_email";
    }
    if (seller.email) {
      const r = await sendTransactional({
        supabase,
        eventType: "reservation_confirmed",
        module,
        role: "seller",
        idemId: reservationId,
        recipientId: sellerId,
        recipientEmail: seller.email,
        relatedEntityId: reservationId,
        data: { recipientName: seller.name, counterpartName: buyer.name, entityTitle, lieu, dateLabel, amountEur },
      });
      results.seller = r.status;
    } else {
      results.seller = "no_email";
    }

    return json({ ok: true, results });
  } catch (e) {
    // Ne jamais bloquer le front : on log et on renvoie 200.
    console.error("send-reservation-email error:", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "internal" }, 200);
  }
}

Deno.serve(handler);
