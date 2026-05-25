// ─────────────────────────────────────────────────────────────────────────────
// _shared/email-templates.ts — Logique PURE des emails transactionnels.
//
// Aucune dépendance Deno/Supabase ici => testable en Node (jest/tsx) sans
// runtime Edge. Ne fait QUE produire des chaînes (clé d'idempotence + contenu).
// Les montants reçus sont en EUROS et sont affichés tels quels (aucun calcul,
// aucune commission : conforme à la contrainte « ne pas toucher aux montants »).
// ─────────────────────────────────────────────────────────────────────────────

export type EmailModule = 'course' | 'stage' | 'transport' | 'box';
export type EmailEventType =
  | 'reservation_confirmed'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'payment_refunded';
export type EmailRole = 'buyer' | 'seller';

export interface EmailTemplateData {
  recipientName?: string;   // prénom/nom du destinataire
  counterpartName?: string; // prénom/nom de l'autre partie
  entityTitle?: string;     // titre de la prestation (annonce, stage, trajet…)
  lieu?: string;            // lieu si connu
  dateLabel?: string;       // période déjà formatée (ex : "28 juin 2026")
  amountEur?: number;       // montant TTC en euros — AFFICHAGE seulement
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ── Clé d'idempotence ────────────────────────────────────────────────────────
// 1 clé par email logique. `idemId` = stripe_event_id (paiement) ou id de la
// réservation/demande (réservation confirmée).
export function buildEventKey(
  eventType: EmailEventType,
  module: EmailModule,
  idemId: string,
  role: EmailRole,
): string {
  return `${eventType}:${module}:${idemId}:${role}`;
}

// ── Libellés ───────────────────────────────────────────────────────────────
const MODULE_NOUN: Record<EmailModule, string> = {
  course: 'cours de coaching',
  stage: 'stage',
  transport: 'transport de chevaux',
  box: 'location de box',
};

// Rôle « métier » selon le module, pour un texte naturel.
function roleLabel(module: EmailModule, role: EmailRole): string {
  if (module === 'course' || module === 'stage') {
    return role === 'buyer' ? 'cavalier' : 'coach';
  }
  return role === 'buyer' ? 'locataire' : 'loueur';
}

function formatAmount(amountEur?: number): string | null {
  if (amountEur == null || Number.isNaN(amountEur)) return null;
  return amountEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Bloc récap commun (titre / lieu / date / montant), HTML + texte.
function detailsBlock(data: EmailTemplateData): { html: string; text: string } {
  const rows: Array<[string, string]> = [];
  if (data.entityTitle) rows.push(['Prestation', data.entityTitle]);
  if (data.lieu) rows.push(['Lieu', data.lieu]);
  if (data.dateLabel) rows.push(['Date', data.dateLabel]);
  const amount = formatAmount(data.amountEur);
  if (amount) rows.push(['Montant', amount]);
  if (data.counterpartName) rows.push(['Avec', data.counterpartName]);

  const html = rows.length
    ? `<table style="border-collapse:collapse;margin:16px 0;font-size:14px;color:#1f2937">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 16px 4px 0;color:#6b7280">${k}</td><td style="padding:4px 0;font-weight:600">${escapeHtml(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const text = rows.map(([k, v]) => `${k} : ${v}`).join('\n');
  return { html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrap(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#f9fafb;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:28px">
<h1 style="font-size:18px;color:#111827;margin:0 0 12px">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="margin:24px 0 0;font-size:12px;color:#9ca3af">Équipe Equishow · email automatique, ne pas répondre.</p>
</div></body></html>`;
}

// ── Rendu principal ──────────────────────────────────────────────────────────
export function renderEmail(
  eventType: EmailEventType,
  module: EmailModule,
  role: EmailRole,
  data: EmailTemplateData,
): RenderedEmail {
  const noun = MODULE_NOUN[module];
  const who = roleLabel(module, role);
  const hello = data.recipientName ? `Bonjour ${data.recipientName},` : 'Bonjour,';
  const details = detailsBlock(data);

  let subject = '';
  let intro = '';

  switch (eventType) {
    case 'reservation_confirmed':
      subject = `✅ Réservation confirmée — ${noun}`;
      intro =
        role === 'seller'
          ? `Vous avez validé une demande de ${noun}. La réservation est confirmée.`
          : `Votre demande de ${noun} a été validée. La réservation est confirmée — vous pouvez procéder au paiement.`;
      break;
    case 'payment_succeeded':
      subject = `💳 Paiement confirmé — ${noun}`;
      intro =
        role === 'seller'
          ? `Bonne nouvelle : le paiement de votre ${noun} a été confirmé. Le versement vous sera reversé selon les délais habituels.`
          : `Votre paiement pour votre ${noun} a bien été confirmé. Merci !`;
      break;
    case 'payment_failed':
      subject = `⚠️ Paiement échoué — ${noun}`;
      intro =
        role === 'seller'
          ? `Le paiement pour votre ${noun} a échoué. Aucune action de votre part n'est requise pour l'instant.`
          : `Votre paiement pour votre ${noun} n'a pas abouti. Vous pouvez réessayer depuis l'application.`;
      break;
    case 'payment_refunded':
      subject = `↩️ Remboursement — ${noun}`;
      intro =
        role === 'seller'
          ? `Un remboursement a été effectué pour votre ${noun}.`
          : `Votre paiement pour votre ${noun} a été remboursé.`;
      break;
  }

  const bodyHtml = `<p style="font-size:14px;color:#374151;margin:0 0 8px">${escapeHtml(hello)}</p>
<p style="font-size:14px;color:#374151;margin:0">${escapeHtml(intro)}</p>
${details.html}`;
  const text = `${hello}\n\n${intro}\n${details.text ? '\n' + details.text + '\n' : ''}\n— Équipe Equishow (email automatique)`;

  // `who` est intégré dans le contexte (rôle) pour de futures variantes ; gardé
  // explicite ici pour éviter une variable inutilisée et documenter le rôle.
  void who;

  return { subject, html: wrap(subject, bodyHtml), text };
}
