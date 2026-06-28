// ─────────────────────────────────────────────────────────────────────────────
// coachAccess — essai gratuit Coach basé sur les 3 PREMIÈRES séances de coaching
// réellement réalisées ET payées (escrow libéré au coach).
//
// PAS d'essai en jours. On compte uniquement des prestations terminées + fonds
// libérés au coach, en lisant la table `payments` (source de vérité financière).
//
// Une séance compte si (payments-authoritative) :
//   - type = 'course'              (séance de coaching ; stage exclu)
//   - transfer_state = 'released'  (escrow libéré au coach)
//   - payment_status = 'succeeded'
//   - refunded_at IS NULL          (pas de remboursement)
//   - dispute_status ∉ {open, resolved_refund}   (pas de litige ouvert / refund)
//
// → exclut automatiquement : réservations créées, annulées, remboursées,
//   paiements en attente (held), litiges ouverts.
//
// 100% lecture seule. Aucune écriture escrow / réservation. Cavalier & organisateur
// ne sont jamais concernés (gardes côté hooks/écrans sur role === 'coach').
// ─────────────────────────────────────────────────────────────────────────────

export const FREE_TRIAL_SESSIONS = 3;

// Forme minimale d'une ligne `payments` nécessaire au calcul.
export interface PaymentRowForTrial {
  type: string | null;
  transfer_state: string | null;
  payment_status: string | null;
  refunded_at: string | null;
  dispute_status: string | null;
}

/** Compte les séances de coaching payées ET validées (fonds reçus par le coach). */
export function countPaidCoachSessions(rows: PaymentRowForTrial[] | null | undefined): number {
  if (!rows) return 0;
  return rows.filter(
    (r) =>
      r.type === 'course' &&
      r.transfer_state === 'released' &&
      r.payment_status === 'succeeded' &&
      !r.refunded_at &&
      r.dispute_status !== 'open' &&
      r.dispute_status !== 'resolved_refund',
  ).length;
}

/**
 * Le coach a-t-il un abonnement Pro actif ?
 * Pro = plan COACH payant uniquement (`coach-mensuel` / `coach-annuel`).
 * Les plans cavalier legacy (`cavalier-plus/premium/famille`) ne comptent PAS
 * comme Pro coach — sinon un ancien cavalier devenu coach n'aurait jamais l'essai.
 */
export function coachHasPro(
  planId: string | undefined | null,
  plan: string | undefined | null,
): boolean {
  const id = (planId ?? '').toLowerCase().trim();
  if (id) return id.startsWith('coach-');
  // Fallback nom (anciens enregistrements sans plan_id) : noms de forfaits coach.
  const name = (plan ?? '').toLowerCase().trim();
  return /\b(mensuel|annuel)\b/.test(name) || name.includes('coach pro');
}

// Statut anti-abus de l'essai (cf. table coach_trial_identity / RPC serveur).
export type TrialAdminStatus = 'trial_allowed' | 'trial_blocked_duplicate' | 'manual_review';

export interface CoachAccess {
  paidSessions: number;   // séances payées validées
  remaining: number;      // séances gratuites restantes (0..3)
  limit: number;          // = FREE_TRIAL_SESSIONS
  hasPro: boolean;        // abonnement Pro actif
  trialActive: boolean;   // essai gratuit en cours (paidSessions < 3)
  trialEligible: boolean; // identité éligible à l'essai (anti-abus)
  trialBlockedDuplicate: boolean; // bloqué car doublon d'identité probable
  canAcceptNew: boolean;  // peut accepter de nouvelles réservations
}

/**
 * Dérive l'état d'accès Coach à partir du compteur + abonnement + éligibilité
 * anti-abus. `trialEligible` par défaut true (fail-open : on ne bloque jamais
 * un coach sans preuve forte de doublon).
 */
export function computeCoachAccess(input: {
  paidSessions: number;
  hasPro: boolean;
  trialEligible?: boolean;
}): CoachAccess {
  const paidSessions = Math.max(0, input.paidSessions | 0);
  const trialEligible = input.trialEligible !== false; // défaut true
  const trialActiveByCount = paidSessions < FREE_TRIAL_SESSIONS;
  // L'essai n'est réellement actif que si l'identité est éligible (anti-abus).
  const trialActive = trialActiveByCount && trialEligible;
  return {
    paidSessions,
    remaining: Math.max(0, FREE_TRIAL_SESSIONS - paidSessions),
    limit: FREE_TRIAL_SESSIONS,
    hasPro: input.hasPro,
    trialActive,
    trialEligible,
    trialBlockedDuplicate: !trialEligible,
    // Sans essai (doublon) il faut un abonnement Pro pour accepter.
    canAcceptNew: trialActive || input.hasPro,
  };
}
