// ─────────────────────────────────────────────────────────────────────────────
// _shared/escrow.ts — Helpers V2 séquestre (Separate Charges & Transfers).
//
// La plupart des fonctions sont PURES (aucune dépendance Deno/Supabase) → testables
// en Node (tsx), comme _shared/email-templates.ts. Seul `loadEscrowSettings` touche
// Supabase. AUCUN recalcul de commission ici : le montant vendeur = amount_seller_ht.
// ─────────────────────────────────────────────────────────────────────────────

export type EscrowModule = "course" | "stage" | "transport" | "box";

// Clé d'idempotence Stripe du transfert d'un paiement (anti-double versement).
export function transferIdempotencyKey(paymentId: string): string {
  return `transfer:${paymentId}`;
}

// Montant à transférer au vendeur. EXCLUSIVEMENT amount_seller_ht (déjà en centimes,
// calculé à la création du paiement). Jamais de recalcul de commission.
export function transferAmountCents(payment: { amount_seller_ht: number }): number {
  return payment.amount_seller_ht;
}

// ── Garde-fous de libération (pur) ──────────────────────────────────────────
export interface ReleaseCaller {
  id: string;
  isAdmin: boolean;
  isCron?: boolean;
}
export interface ReleaseGuardInput {
  payment_status: string;
  transfer_state: string;
  buyer_id: string;
  seller_id: string;
  dispute_status: string | null;
  release_blocked_reason: string | null;
  release_due_at: string | null;
}
export interface GuardResult {
  ok: boolean;
  status: number;
  code: string;
}

export function canReleasePayment(
  p: ReleaseGuardInput,
  caller: ReleaseCaller,
  nowMs: number,
): GuardResult {
  // Le vendeur ne peut JAMAIS déclencher son propre versement.
  if (caller.id === p.seller_id) return { ok: false, status: 403, code: "seller_forbidden" };
  // Autorisés : admin, cron (service), ou l'acheteur (confirmation anticipée).
  const authorized = caller.isAdmin || caller.isCron === true || caller.id === p.buyer_id;
  if (!authorized) return { ok: false, status: 403, code: "forbidden" };

  if (p.payment_status !== "succeeded") return { ok: false, status: 409, code: "not_succeeded" };
  // Refuse tout ce qui n'est pas 'held' (couvre released/reversed/failed/not_applicable).
  if (p.transfer_state !== "held") return { ok: false, status: 409, code: "not_held" };
  // Litige ou blocage admin → jamais de libération.
  if (p.dispute_status === "open" || p.release_blocked_reason) {
    return { ok: false, status: 409, code: "blocked" };
  }
  // Timing : admin (force) et acheteur (anticipé) peuvent libérer immédiatement.
  // Le cron auto exige que release_due_at soit échu.
  const isManual = caller.isAdmin || caller.id === p.buyer_id;
  if (!isManual && caller.isCron) {
    const due = p.release_due_at ? Date.parse(p.release_due_at) : Infinity;
    if (!(due <= nowMs)) return { ok: false, status: 409, code: "too_early" };
  }
  return { ok: true, status: 200, code: "ok" };
}

// ── Classification d'erreur Stripe sur /transfers (pur) ─────────────────────
// retryable : on garde 'held' et on réessaiera. blocked : le vendeur doit agir.
// fatal : erreur durable → 'failed'.
export type TransferErrorClass = "retryable" | "blocked" | "fatal";
export function classifyTransferError(code?: string, message?: string): TransferErrorClass {
  const c = (code || "").toLowerCase();
  const m = (message || "").toLowerCase();
  if (c === "balance_insufficient" || m.includes("insufficient") || m.includes("available balance")) {
    return "retryable";
  }
  if (
    c.includes("account") ||
    m.includes("no such destination") ||
    m.includes("capabilit") ||
    m.includes("not have") ||
    m.includes("payouts")
  ) {
    return "blocked";
  }
  return "fatal";
}

// ── Délais & dates de libération (pur) ──────────────────────────────────────
const HOLD_DEFAULT_HOURS: Record<EscrowModule, number> = {
  course: 48,
  stage: 48,
  transport: 48,
  box: 48,
};
export function holdHoursForType(type: EscrowModule, settings: Record<string, unknown>): number {
  const v = Number(settings[`escrow_hold_hours_${type}`]);
  return Number.isFinite(v) && v > 0 ? v : HOLD_DEFAULT_HOURS[type];
}
export function computeReleaseDueAt(prestationEndMs: number, holdHours: number): string {
  return new Date(prestationEndMs + holdHours * 3600 * 1000).toISOString();
}

// ── Feature flag (pur) ──────────────────────────────────────────────────────
export function isEscrowEnabled(settings: Record<string, unknown>, type: EscrowModule): boolean {
  const enabled = settings["escrow_enabled"];
  if (enabled !== true && enabled !== "true") return false;
  const mods = settings["escrow_enabled_modules"];
  const list = Array.isArray(mods)
    ? mods.map(String)
    : typeof mods === "string"
      ? mods.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  return list.includes(type);
}

// ── Litiges (pur) ────────────────────────────────────────────────────────────
// Bloquer la libération sur litige UNIQUEMENT si les fonds sont encore retenus
// (held/releasing). 'released'/'reversed'/'not_applicable' → pas de blocage escrow
// (rien à retenir ; legacy géré nativement par Stripe).
export function shouldBlockOnDispute(transferState: string | null | undefined): boolean {
  return transferState === "held" || transferState === "releasing";
}

// Action à la clôture d'un dispute Stripe (charge.dispute.closed).
export type DisputeResolution = "unblock" | "keep_blocked" | "noop";
export function disputeResolution(stripeStatus: string | undefined): DisputeResolution {
  const s = (stripeStatus || "").toLowerCase();
  if (s === "won" || s === "warning_closed") return "unblock"; // gagné → libérable
  if (s === "lost") return "keep_blocked"; // perdu → fonds repris, reste bloqué
  return "noop"; // under_review / needs_response / warning_* → on ne touche à rien
}

// ── Flags de remboursement Stripe selon l'état séquestre (pur) ──────────────
// - legacy 'not_applicable' (destination charge) : comportement ACTUEL inchangé
//   (refund_application_fee + reverse_transfer).
// - 'released' (séquestre versé) : reverse_transfer seul (pas d'application_fee).
// - 'held'/'releasing'/'reversed'/'failed' : refund SIMPLE (rien à reverser).
export function refundFlagsFor(transferState: string | null | undefined): {
  reverse_transfer: boolean;
  refund_application_fee: boolean;
} {
  if (transferState === "released") return { reverse_transfer: true, refund_application_fee: false };
  if (
    transferState === "held" ||
    transferState === "releasing" ||
    transferState === "reversed" ||
    transferState === "failed"
  ) {
    return { reverse_transfer: false, refund_application_fee: false };
  }
  // 'not_applicable' / null / inconnu → legacy destination charge
  return { reverse_transfer: true, refund_application_fee: true };
}

// ── Sélection de la réservation liée (pur) ──────────────────────────────────
export function reservationIdOf(
  payment: Record<string, unknown>,
): { id: string | null; key: string | null } {
  if (payment.course_demand_id) return { id: String(payment.course_demand_id), key: "course_demand_id" };
  if (payment.stage_reservation_id) return { id: String(payment.stage_reservation_id), key: "stage_reservation_id" };
  if (payment.box_reservation_id) return { id: String(payment.box_reservation_id), key: "box_reservation_id" };
  if (payment.transport_reservation_id) return { id: String(payment.transport_reservation_id), key: "transport_reservation_id" };
  return { id: null, key: null };
}

// ── Chargement des settings escrow (Supabase, service_role) ─────────────────
export async function loadEscrowSettings(supabase: any): Promise<Record<string, unknown>> {
  try {
    const { data } = await supabase.from("platform_settings").select("key,value").like("key", "escrow_%");
    const m: Record<string, unknown> = {};
    (data ?? []).forEach((r: { key: string; value: unknown }) => {
      m[r.key] = r.value;
    });
    return m;
  } catch (_) {
    return {};
  }
}
