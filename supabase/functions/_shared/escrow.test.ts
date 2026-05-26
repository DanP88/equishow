// Tests de la logique PURE escrow (garde-fous, idempotency, classification, flag).
// Runtime Node (le code Edge est Deno). Lancer :
//   npx tsx supabase/functions/_shared/escrow.test.ts

import {
  canReleasePayment,
  classifyTransferError,
  computeReleaseDueAt,
  holdHoursForType,
  isEscrowEnabled,
  reservationIdOf,
  transferAmountCents,
  transferIdempotencyKey,
  type ReleaseGuardInput,
} from "./escrow.ts";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log("  ✗ " + m); } };

const NOW = Date.parse("2026-06-01T12:00:00Z");
const base: ReleaseGuardInput = {
  payment_status: "succeeded",
  transfer_state: "held",
  buyer_id: "BUYER",
  seller_id: "SELLER",
  dispute_status: null,
  release_blocked_reason: null,
  release_due_at: "2026-05-01T00:00:00Z", // échu
};

// ── idempotency + montant ────────────────────────────────────────────────────
ok(transferIdempotencyKey("p1") === "transfer:p1", "idempotency key format");
ok(transferAmountCents({ amount_seller_ht: 20000 } as any) === 20000, "amount = amount_seller_ht");
// jamais le ttc ni le fee :
ok(transferAmountCents({ amount_seller_ht: 20000, amount_buyer_ttc: 21800, amount_platform_fee: 1800 } as any) === 20000,
  "amount ignore ttc/fee (pas de recalcul)");

// ── canReleasePayment ─────────────────────────────────────────────────────────
ok(!canReleasePayment(base, { id: "SELLER", isAdmin: false }, NOW).ok, "vendeur refusé");
ok(canReleasePayment(base, { id: "SELLER", isAdmin: false }, NOW).code === "seller_forbidden", "code seller_forbidden");
ok(canReleasePayment(base, { id: "RANDOM", isAdmin: false }, NOW).code === "forbidden", "tiers refusé");
ok(canReleasePayment(base, { id: "BUYER", isAdmin: false }, NOW).ok, "acheteur autorisé");
ok(canReleasePayment(base, { id: "X", isAdmin: true }, NOW).ok, "admin autorisé");
ok(canReleasePayment(base, { id: "CRON", isAdmin: false, isCron: true }, NOW).ok, "cron autorisé (échu)");

ok(canReleasePayment({ ...base, transfer_state: "released" }, { id: "BUYER", isAdmin: false }, NOW).code === "not_held", "released → not_held");
ok(canReleasePayment({ ...base, transfer_state: "reversed" }, { id: "BUYER", isAdmin: false }, NOW).code === "not_held", "reversed → not_held");
ok(canReleasePayment({ ...base, transfer_state: "not_applicable" }, { id: "BUYER", isAdmin: false }, NOW).code === "not_held", "legacy not_applicable → not_held");
ok(canReleasePayment({ ...base, payment_status: "pending" }, { id: "BUYER", isAdmin: false }, NOW).code === "not_succeeded", "pending → not_succeeded");
ok(canReleasePayment({ ...base, dispute_status: "open" }, { id: "BUYER", isAdmin: false }, NOW).code === "blocked", "litige → blocked");
ok(canReleasePayment({ ...base, release_blocked_reason: "admin" }, { id: "BUYER", isAdmin: false }, NOW).code === "blocked", "hold admin → blocked");

// cron + non échu → too_early ; admin/buyer ignorent la date
ok(canReleasePayment({ ...base, release_due_at: "2099-01-01T00:00:00Z" }, { id: "CRON", isAdmin: false, isCron: true }, NOW).code === "too_early", "cron non échu → too_early");
ok(canReleasePayment({ ...base, release_due_at: "2099-01-01T00:00:00Z" }, { id: "BUYER", isAdmin: false }, NOW).ok, "acheteur ignore la date (anticipé)");
ok(canReleasePayment({ ...base, release_due_at: "2099-01-01T00:00:00Z" }, { id: "X", isAdmin: true }, NOW).ok, "admin force (ignore date)");

// ── classification erreurs ──────────────────────────────────────────────────
ok(classifyTransferError("balance_insufficient") === "retryable", "balance_insufficient → retryable");
ok(classifyTransferError(undefined, "Insufficient available balance") === "retryable", "insufficient msg → retryable");
ok(classifyTransferError(undefined, "No such destination account") === "blocked", "compte absent → blocked");
ok(classifyTransferError("account_invalid") === "blocked", "account_* → blocked");
ok(classifyTransferError("something_else") === "fatal", "autre → fatal");

// ── délais / dates ───────────────────────────────────────────────────────────
ok(holdHoursForType("course", { escrow_hold_hours_course: 48 }) === 48, "hold course=48 (config)");
ok(holdHoursForType("transport", {}) === 48, "hold défaut transport=48");
ok(holdHoursForType("box", { escrow_hold_hours_box: 0 }) === 48, "hold invalide → défaut");
const due = computeReleaseDueAt(Date.parse("2026-06-10T10:00:00Z"), 48);
ok(due === "2026-06-12T10:00:00.000Z", "release_due = prestation + 48h");

// ── feature flag ─────────────────────────────────────────────────────────────
ok(isEscrowEnabled({ escrow_enabled: false, escrow_enabled_modules: ["box"] }, "box") === false, "flag off → false");
ok(isEscrowEnabled({ escrow_enabled: true, escrow_enabled_modules: [] }, "box") === false, "module non listé → false");
ok(isEscrowEnabled({ escrow_enabled: true, escrow_enabled_modules: ["box"] }, "box") === true, "on + module → true");
ok(isEscrowEnabled({ escrow_enabled: true, escrow_enabled_modules: "box,course" }, "course") === true, "modules en string CSV");
ok(isEscrowEnabled({ escrow_enabled: true, escrow_enabled_modules: ["box"] }, "course") === false, "autre module → false");

// ── réservation liée ─────────────────────────────────────────────────────────
ok(reservationIdOf({ course_demand_id: "c1" }).key === "course_demand_id", "fk course");
ok(reservationIdOf({ transport_reservation_id: "t1" }).id === "t1", "fk transport");
ok(reservationIdOf({}).id === null, "aucune fk → null");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
