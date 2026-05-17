export interface Plan {
  id: string;
  nom: string;
  prix: number;
  periode: 'mensuel' | 'annuel' | 'unique';
  description: string;
  cible: string;
  features: string[];
  badge?: string;
}

export interface TarificationRole {
  role: 'cavalier' | 'coach' | 'organisateur';
  plans: Plan[];
}

export const TARIFICATION: Record<string, TarificationRole> = {
  cavalier: {
    role: 'cavalier',
    plans: [
      {
        id: 'cavalier-decouverte',
        nom: 'Découverte',
        prix: 0,
        periode: 'mensuel',
        description: 'Pour découvrir Equishow',
        cible: 'Nouveau cavalier',
        features: [
          'Fiche complète pour chaque cheval',
          'Réservation de coach à la séance',
          'Messagerie avec votre coach',
          'Agenda personnel',
          'Communauté & actualités',
          'Notifications',
        ],
      },
      {
        id: 'cavalier-plus',
        nom: 'Cavalier+',
        prix: 6.99,
        periode: 'mensuel',
        description: 'Pour les cavaliers réguliers',
        cible: 'Cavalier régulier',
        features: [
          'Tout du plan Découverte',
          'Accès aux annonces de transport',
          'Accès aux annonces de box',
          'Inscription aux concours en ligne',
          'Jusqu\'à 3 chevaux',
        ],
        badge: 'Populaire',
      },
      {
        id: 'cavalier-premium',
        nom: 'Premium',
        prix: 49.99,
        periode: 'annuel',
        description: 'Pour les cavaliers passionnés',
        cible: 'Cavalier passionné',
        features: [
          'Tout du plan Cavalier+',
          'Chevaux illimités',
          'Réduction 40% sur les services',
          'Résultats en temps réel & palmarès',
          'Support prioritaire',
          'Badge "Cavalier Premium"',
        ],
      },
      {
        id: 'cavalier-famille',
        nom: 'Famille',
        prix: 79.99,
        periode: 'annuel',
        description: 'Parent + 2 enfants cavaliers',
        cible: 'Parent + enfants',
        features: [
          'Tout du plan Premium ×3 profils',
          'Gestion familiale intégrée',
          '3 comptes connectés',
          'Agenda partagé',
          'Support famille dédié',
        ],
      },
    ],
  },
  organisateur: {
    role: 'organisateur',
    plans: [
      {
        id: 'org-par-concours',
        nom: 'Par Concours',
        prix: 79,
        periode: 'unique',
        description: '1 événement, toutes fonctionnalités',
        cible: 'Organisateur occasionnel',
        features: [
          '1 concours/événement',
          'Toutes les fonctionnalités',
          'Jusqu\'à 100 participants',
          'Gestion des box et transport',
          'Rapports basiques',
        ],
      },
      {
        id: 'org-saison-standard',
        nom: 'Saison Standard',
        prix: 199,
        periode: 'annuel',
        description: 'Jusqu\'à 3 concours par saison',
        cible: 'Organisateur régulier',
        features: [
          'Jusqu\'à 3 concours/an',
          'Toutes les fonctionnalités',
          'Participants illimités',
          'Gestion avancée',
          'Support email',
          'Rapports détaillés',
        ],
        badge: 'Recommandé',
      },
      {
        id: 'org-saison-pro',
        nom: 'Saison Pro',
        prix: 349,
        periode: 'annuel',
        description: 'Concours illimités + stats avancées',
        cible: 'Organisateur professionnel',
        features: [
          'Concours illimités',
          'Toutes les fonctionnalités Pro',
          'Participants illimités',
          'Statistiques avancées',
          'API d\'intégration',
          'Support prioritaire 24/7',
          'Badge "Organisateur Vérifié"',
        ],
      },
    ],
  },
  coach: {
    role: 'coach',
    plans: [
      {
        id: 'coach-mensuel',
        nom: 'Mensuel',
        prix: 19.99,
        periode: 'mensuel',
        description: 'Toutes les fonctionnalités coach',
        cible: 'Coach indépendant',
        features: [
          'Profil public complet',
          'Gestion des séances',
          'Système d\'avis/notation',
          'Calendrier de disponibilités',
          'Messagerie avec clients',
          'Jusqu\'à 20 clients',
          'Support email',
        ],
      },
      {
        id: 'coach-annuel',
        nom: 'Annuel',
        prix: 149,
        periode: 'annuel',
        description: 'Toutes fonctionnalités + profil mis en avant',
        cible: 'Coach professionnel',
        features: [
          'Tout du plan Mensuel',
          'Profil mis en avant',
          'Clients illimités',
          'Statistiques détaillées',
          'Intégration paiement',
          'Certificats numériques',
          'Support prioritaire',
          'Badge "Coach Vérifié"',
        ],
        badge: 'Populaire',
      },
    ],
  },
};

export function getPlansByRole(role: 'cavalier' | 'coach' | 'organisateur'): Plan[] {
  return TARIFICATION[role]?.plans || [];
}

export function getPlanById(id: string): Plan | undefined {
  for (const tarif of Object.values(TARIFICATION)) {
    const plan = tarif.plans.find((p) => p.id === id);
    if (plan) return plan;
  }
  return undefined;
}

export function formatPrice(prix: number, periode: 'mensuel' | 'annuel' | 'unique'): string {
  if (periode === 'mensuel') {
    return `${prix.toFixed(2)}€/mois`;
  } else if (periode === 'annuel') {
    const monthlyCost = (prix / 12).toFixed(2);
    return `${prix.toFixed(2)}€/an (${monthlyCost}€/mois)`;
  }
  return `${prix.toFixed(2)}€`;
}
