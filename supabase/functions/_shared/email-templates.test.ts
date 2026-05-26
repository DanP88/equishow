// Tests de la logique PURE des emails (buildEventKey + renderEmail).
// Runtime Node (le code Edge est Deno, non testable ici). Lancer :
//   npx tsx supabase/functions/_shared/email-templates.test.ts
// Aucune dépendance Deno/Supabase n'est importée par email-templates.ts.

import { buildEventKey, renderEmail } from "./email-templates.ts";

let pass = 0;
let fail = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) pass++;
  else {
    fail++;
    console.log("  ✗ " + msg);
  }
};

// ── event_key déterministe ───────────────────────────────────────────────────
ok(
  buildEventKey("payment_succeeded", "course", "evt_123", "buyer") ===
    "payment_succeeded:course:evt_123:buyer",
  "event_key format",
);
ok(
  buildEventKey("reservation_confirmed", "box", "res_9", "seller") ===
    "reservation_confirmed:box:res_9:seller",
  "event_key box seller",
);
ok(
  buildEventKey("payment_succeeded", "course", "e", "buyer") !==
    buildEventKey("payment_succeeded", "course", "e", "seller"),
  "buyer/seller keys differ",
);

// ── rendu par événement ───────────────────────────────────────────────────────
const data = {
  recipientName: "Sophie Dupont",
  counterpartName: "Sarah Lefebvre",
  entityTitle: "testconcours",
  lieu: "Dijon",
  dateLabel: "28 juin 2026",
  amountEur: 218,
};
const rc = renderEmail("reservation_confirmed", "course", "buyer", data);
ok(/Réservation confirmée/.test(rc.subject), "reservation subject");
ok(/procéder au paiement/.test(rc.text), "buyer reservation mentions payment");
ok(/Sophie Dupont/.test(rc.html) && /Sophie Dupont/.test(rc.text), "recipient name in body");
ok(/218,00\s*€/.test(rc.html), "amount formatted FR");
ok(/testconcours/.test(rc.html), "entity title shown");

const ps = renderEmail("payment_succeeded", "transport", "seller", { amountEur: 50 });
ok(/Paiement confirmé/.test(ps.subject), "payment subject");
ok(/reversé/.test(ps.text), "seller payment wording");
ok(/transport de chevaux/.test(ps.text), "transport noun");

const pf = renderEmail("payment_failed", "box", "buyer", {});
ok(/échoué/.test(pf.subject), "failed subject");
ok(/réessayer/.test(pf.text), "buyer failed retry wording");

const pr = renderEmail("payment_refunded", "stage", "buyer", { amountEur: 120 });
ok(/Remboursement/.test(pr.subject), "refund subject");
ok(/remboursé/.test(pr.text), "refund wording");

// ── sécurité / robustesse ─────────────────────────────────────────────────────
const esc = renderEmail("reservation_confirmed", "course", "buyer", { entityTitle: '<b>x</b>&"' });
ok(!/<b>x<\/b>/.test(esc.html), "html escaped");
const noamt = renderEmail("reservation_confirmed", "course", "seller", { entityTitle: "x" });
ok(!/Montant/.test(noamt.html), "no amount line when absent");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
