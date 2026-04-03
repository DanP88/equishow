import '../../auth/domain/user_auth.dart';

/// Plans d'abonnement — Business Plan V5 Equishow (Option E Hybride)
class PlanAbonnement {
  const PlanAbonnement({
    required this.id,
    required this.nom,
    required this.description,
    required this.prix,
    required this.periode,
    required this.avantages,
    required this.role,
    this.prixBarre,
    this.badge,
    this.stripeProductId,
    this.stripePriceId,
    this.isPopulaire = false,
  });

  final PlanId id;
  final String nom;
  final String description;
  final double prix;
  final String periode;
  final List<String> avantages;
  final UserRole role;
  final double? prixBarre;
  final String? badge;
  final String? stripeProductId;  // TODO: renseigner depuis Stripe Dashboard
  final String? stripePriceId;    // TODO: renseigner depuis Stripe Dashboard
  final bool isPopulaire;

  bool get isGratuit => prix == 0;
}

// ── Plans Cavalier ─────────────────────────────────────────────────────────────

const planCavalierGratuit = PlanAbonnement(
  id: PlanId.gratuit,
  nom: 'Gratuit',
  description: 'Découvrez Equishow',
  prix: 0,
  periode: '',
  role: UserRole.cavalier,
  avantages: [
    '3 concours max / saison',
    '1 cheval',
    'Accès calendrier',
    'Transport : lecture seule',
  ],
);

const planCavalierMensuel = PlanAbonnement(
  id: PlanId.cavalierMensuel,
  nom: 'Premium',
  description: 'Accès complet sans engagement',
  prix: 6.99,
  periode: '/mois',
  role: UserRole.cavalier,
  stripeProductId: 'prod_xxx_cavalier',
  stripePriceId: 'price_xxx_cavalier_monthly',
  avantages: [
    'Concours illimités',
    'Chevaux illimités',
    'Réservation transport',
    'Booking coach',
    'Résultats live',
    'Carnet de bord complet',
    'Suivi administratif',
  ],
);

const planCavalierAnnuel = PlanAbonnement(
  id: PlanId.cavalierAnnuel,
  nom: 'Premium Annuel',
  description: 'Économisez 40% vs mensuel',
  prix: 49.99,
  periode: '/an',
  prixBarre: 83.88,
  badge: '–40%',
  role: UserRole.cavalier,
  isPopulaire: true,
  stripeProductId: 'prod_xxx_cavalier',
  stripePriceId: 'price_xxx_cavalier_yearly',
  avantages: [
    'Tout le plan Premium',
    'Économie de 33,89€/an',
    'Support prioritaire',
    'Accès bêta nouvelles fonctions',
  ],
);

// ── Plans Organisateur ─────────────────────────────────────────────────────────

const planOrganisateurCarte = PlanAbonnement(
  id: PlanId.organisateurCarte,
  nom: 'À la carte',
  description: 'Par concours, sans abonnement',
  prix: 79,
  periode: '/concours',
  role: UserRole.organisateur,
  stripeProductId: 'prod_xxx_orga_carte',
  stripePriceId: 'price_xxx_orga_carte',
  avantages: [
    'Publication 1 concours',
    'Gestion liste engagés',
    'Notifications participants',
    'Export PDF programme',
    'Billetterie spectateurs',
  ],
);

const planOrganisateurStandard = PlanAbonnement(
  id: PlanId.organisateurStandard,
  nom: 'Standard',
  description: 'Jusqu\'à 12 concours / an',
  prix: 199,
  periode: '/an',
  role: UserRole.organisateur,
  stripeProductId: 'prod_xxx_orga',
  stripePriceId: 'price_xxx_orga_standard',
  avantages: [
    'Jusqu\'à 12 concours / an',
    'Tout "À la carte"',
    'Tableau de bord revenus',
    'Stats affluence',
    'Support email',
  ],
);

const planOrganisateurPro = PlanAbonnement(
  id: PlanId.organisateurPro,
  nom: 'Pro',
  description: 'Concours illimités + analytics',
  prix: 349,
  periode: '/an',
  role: UserRole.organisateur,
  isPopulaire: true,
  stripeProductId: 'prod_xxx_orga',
  stripePriceId: 'price_xxx_orga_pro',
  avantages: [
    'Concours illimités',
    'Tout "Standard"',
    'Analytics avancés',
    'API export données',
    'Support téléphonique',
    'Onboarding dédié',
  ],
);

// ── Plans Coach ────────────────────────────────────────────────────────────────

const planCoachPro = PlanAbonnement(
  id: PlanId.coachPro,
  nom: 'Coach Pro',
  description: 'Votre vitrine digitale + booking',
  prix: 149,
  periode: '/an',
  role: UserRole.coach,
  isPopulaire: true,
  stripeProductId: 'prod_xxx_coach',
  stripePriceId: 'price_xxx_coach',
  avantages: [
    'Profil coach public',
    'Booking sessions en ligne',
    'Paiement intégré (Stripe)',
    'Suivi élèves illimité',
    'Calendrier sync concours',
    'Notes post-session',
    'Support prioritaire',
  ],
);

/// Tous les plans par rôle
final plansByRole = {
  UserRole.cavalier: [planCavalierGratuit, planCavalierMensuel, planCavalierAnnuel],
  UserRole.organisateur: [planOrganisateurCarte, planOrganisateurStandard, planOrganisateurPro],
  UserRole.coach: [planCoachPro],
};
