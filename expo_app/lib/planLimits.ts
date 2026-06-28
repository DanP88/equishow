// Limites « plan » côté cavalier.
//
// ⚠️ Depuis la suppression de l'abonnement Cavalier : un cavalier accède
// GRATUITEMENT à toutes les fonctionnalités qui lui sont destinées (transport,
// box, inscription concours, chevaux illimités). Il n'existe plus de palier
// payant cavalier → ces limites sont volontairement « tout débloqué ».
//
// La fonction est conservée (signature inchangée) pour ne pas casser les appelants
// existants et pour rester extensible si un jour un palier cavalier réapparaissait.
// Les abonnements PRO (coach / organisateur) restent gérés ailleurs (data/tarification).

export interface PlanLimits {
  maxChevaux: number;        // Infinity = illimité
  canAccessTransport: boolean;
  canAccessBox: boolean;
  canRegisterConcours: boolean;
  label: string;             // Nom affichable du plan
}

// Accès complet, gratuit, pour tout cavalier.
const CAVALIER_FULL: PlanLimits = {
  maxChevaux: Infinity,
  canAccessTransport: true,
  canAccessBox: true,
  canRegisterConcours: true,
  label: 'Cavalier',
};

// Conservé pour compat : un cavalier est toujours « gratuit ».
export function isFreePlan(_plan: string | undefined | null): boolean {
  return true;
}

// Le cavalier a désormais un accès complet quel que soit le contenu de users.plan.
export function getPlanLimits(_plan: string | undefined | null): PlanLimits {
  return CAVALIER_FULL;
}

// Coach : on considère "mis en avant" tout coach abonné à un plan payant
// non-mensuel (annuel ou supérieur). Le plan mensuel n'est PAS mis en avant.
// (Abonnement PRO — inchangé.)
export function isFeaturedCoach(planId: string | undefined | null, plan: string | undefined | null): boolean {
  const id = (planId ?? '').toLowerCase();
  if (id === 'coach-annuel' || id === 'coach-premium') return true;
  // Fallback sur le nom textuel (compat anciens enregistrements)
  const name = (plan ?? '').toLowerCase();
  if (name.includes('annuel') || name.includes('premium') || name.includes('vérifié') || name.includes('verifie')) {
    return true;
  }
  return false;
}
