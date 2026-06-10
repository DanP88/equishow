// ─────────────────────────────────────────────────────────────────────────────
// _shared/email-templates.ts — Logique PURE des emails transactionnels.
//
// Aucune dépendance Deno/Supabase ici => testable en Node (jest/tsx) sans
// runtime Edge. Ne fait QUE produire des chaînes (clé d'idempotence + contenu).
// Les montants reçus sont en EUROS et sont affichés tels quels (aucun calcul,
// aucune commission : conforme à la contrainte « ne pas toucher aux montants »).
//
// Affichage montant : l'acheteur voit le TOTAL qu'il paie (TTC, commission
// incluse) ; le vendeur voit son MONTANT NET attendu (HT). Le caller fournit
// les deux (amountEur = acheteur, sellerAmountEur = vendeur net).
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
  amountEur?: number;       // montant TOTAL acheteur (TTC) en euros — AFFICHAGE seulement
  sellerAmountEur?: number; // montant NET vendeur (HT) en euros — AFFICHAGE seulement
  reservationNumber?: string; // N° de réservation lisible (EQ-XXX-XXXXXXXX)
  appUrl?: string;          // base URL de l'app (pour le bouton CTA), ex https://equishow.vercel.app
  ctaResaId?: string;       // id brut de la réservation → deep-link agenda (?pay=<id>) pour cibler la résa
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ── Couleur de marque ────────────────────────────────────────────────────────
const BRAND = '#0E7C66';      // vert équestre Equishow
const BRAND_SOFT = '#c7f0e4'; // texte clair sur header

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

// Bloc récap commun (N° / titre / lieu / date / montant), HTML + texte.
// Montant dépend du rôle : acheteur = total payé, vendeur = net attendu.
function detailsBlock(data: EmailTemplateData, role: EmailRole): { html: string; text: string } {
  const rows: Array<[string, string]> = [];
  if (data.reservationNumber) rows.push(['N° de réservation', data.reservationNumber]);
  if (data.entityTitle) rows.push(['Prestation', data.entityTitle]);
  if (data.lieu) rows.push(['Lieu', data.lieu]);
  if (data.dateLabel) rows.push(['Date', data.dateLabel]);

  const displayAmount =
    role === 'seller' ? (data.sellerAmountEur ?? data.amountEur) : data.amountEur;
  const amount = formatAmount(displayAmount);
  if (amount) rows.push([role === 'seller' ? 'Montant (net vendeur)' : 'Montant', amount]);
  if (data.counterpartName) rows.push(['Avec', data.counterpartName]);

  const html = rows.length
    ? `<table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0;font-size:14px;color:#1f2937">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;vertical-align:top">${k}</td><td style="padding:4px 0;font-weight:600;word-break:break-word">${escapeHtml(v)}</td></tr>`,
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

// Bouton CTA (display:inline-block, inline-styled → robuste hors media query).
function ctaButton(url: string, label: string): string {
  if (!url) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px"><tr><td style="border-radius:10px;background:${BRAND}">
<a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${escapeHtml(label)}</a>
</td></tr></table>`;
}

// Enveloppe HTML responsive : viewport + largeur fluide (width:100% max 520) +
// header brandé + media query mobile.
function wrap(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(title)}</title>
<style>
  body{margin:0;padding:0;background:#f3f4f6;}
  a{color:${BRAND};}
  @media only screen and (max-width:440px){
    .eq-pad{padding:18px 18px !important;}
    .eq-head{padding:16px 18px !important;}
    .eq-brand{font-size:20px !important;}
    .eq-title{font-size:17px !important;}
  }
</style></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden">
<tr><td class="eq-head" style="background:${BRAND};padding:20px 28px">
<div class="eq-brand" style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:.5px">🐎 Equishow</div>
<div style="font-size:12px;color:${BRAND_SOFT};margin-top:4px">Le compagnon du cavalier de concours</div>
</td></tr>
<tr><td class="eq-pad" style="padding:24px 28px">
<h1 class="eq-title" style="font-size:18px;color:#111827;margin:0 0 12px">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="margin:24px 0 0;font-size:12px;color:#9ca3af">Équipe Equishow · email automatique, ne pas répondre.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// CTA : libellé selon rôle + type d'événement ; URL = appUrl + écran agenda.
// Deep-link `?pay=<resaId>&type=<module>` → l'agenda scrolle + surligne la résa
// concernée (cf. cavalier-agenda useLocalSearchParams), prête à payer en 1 tap.
function ctaFor(
  eventType: EmailEventType,
  module: EmailModule,
  role: EmailRole,
  appUrl?: string,
  resaId?: string,
): { url: string; label: string } {
  if (!appUrl) return { url: '', label: '' };
  const base = appUrl.replace(/\/+$/, '');
  const query = resaId ? `?pay=${encodeURIComponent(resaId)}&type=${module}` : '';
  const url = `${base}/cavalier-agenda${query}`;
  let label: string;
  if (role === 'seller') {
    label = 'Voir la réservation';
  } else {
    label = eventType === 'reservation_confirmed' ? 'Payer ma réservation' : 'Voir ma réservation';
  }
  return { url, label };
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
  const details = detailsBlock(data, role);

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

  const cta = ctaFor(eventType, module, role, data.appUrl, data.ctaResaId);
  const ctaHtml = ctaButton(cta.url, cta.label);

  const bodyHtml = `<p style="font-size:14px;color:#374151;margin:0 0 8px">${escapeHtml(hello)}</p>
<p style="font-size:14px;color:#374151;margin:0">${escapeHtml(intro)}</p>
${details.html}
${ctaHtml}`;
  const text = `${hello}\n\n${intro}\n${details.text ? '\n' + details.text + '\n' : ''}${
    cta.url ? `\n${cta.label} : ${cta.url}\n` : ''
  }\n— Équipe Equishow (email automatique)`;

  // `who` est intégré dans le contexte (rôle) pour de futures variantes ; gardé
  // explicite ici pour éviter une variable inutilisée et documenter le rôle.
  void who;

  return { subject, html: wrap(subject, bodyHtml), text };
}
