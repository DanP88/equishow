// Limites des plans d'abonnement — gating UI côté front.
// (Le gating sécurisé sera ajouté côté DB via RLS plus tard.)

export interface PlanLimits {
  maxChevaux: number;        // Infinity = illimité
  canAccessTransport: boolean;
  canAccessBox: boolean;
  canRegisterConcours: boolean;
  label: string;             // Nom affichable du plan
}

const FREE: PlanLimits = {
  maxChevaux: 1,
  canAccessTransport: false,
  canAccessBox: false,
  canRegisterConcours: false,
  label: 'Découverte',
};

const PLUS: PlanLimits = {
  maxChevaux: 3,
  canAccessTransport: true,
  canAccessBox: true,
  canRegisterConcours: true,
  label: 'Cavalier+',
};

const PREMIUM: PlanLimits = {
  maxChevaux: Infinity,
  canAccessTransport: true,
  canAccessBox: true,
  canRegisterConcours: true,
  label: 'Premium',
};

// Détecte le plan à partir du string remonté par le backend (users.plan).
// Tolérant aux variations de casse / orthographe.
export function isFreePlan(plan: string | undefined | null): boolean {
  if (!plan) return true;
  const lower = plan.toLowerCase().trim();
  return lower === 'gratuit'
      || lower === 'découverte'
      || lower === 'decouverte'
      || lower === 'free';
}

export function getPlanLimits(plan: string | undefined | null): PlanLimits {
  if (isFreePlan(plan)) return FREE;
  const lower = (plan ?? '').toLowerCase();
  if (lower.includes('premium') || lower.includes('famille') || lower.includes('élite') || lower.includes('elite')) {
    return PREMIUM;
  }
  // Tout ce qui n'est pas gratuit / premium → palier intermédiaire (Cavalier+)
  return PLUS;
}
