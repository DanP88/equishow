/// Discipline équestre pratiquée
enum Discipline {
  cso('CSO', 'Saut d\'obstacles', '🟢'),
  dressage('Dressage', 'Dressage', '🔵'),
  cce('CCE', 'Concours complet', '🟠');

  const Discipline(this.code, this.label, this.emoji);
  final String code;
  final String label;
  final String emoji;
}

/// Rôle de l'utilisateur dans Equishow
enum UserRole {
  cavalier('Cavalier', 'Je pratique la compétition équestre'),
  organisateur('Organisateur', 'J\'organise des concours'),
  coach('Coach', 'J\'encadre des cavaliers');

  const UserRole(this.label, this.description);
  final String label;
  final String description;
}

/// Plan d'abonnement actif
enum PlanId {
  gratuit,
  cavalierMensuel,
  cavalierAnnuel,
  organisateurCarte,
  organisateurStandard,
  organisateurPro,
  coachPro,
}

/// Utilisateur authentifié
class UserAuth {
  const UserAuth({
    required this.id,
    required this.email,
    required this.prenom,
    required this.nom,
    required this.role,
    this.planId = PlanId.gratuit,
    this.planExpiresAt,
    this.stripeCustomerId,
    this.disciplines = const [],
    this.region,
  });

  final String id;
  final String email;
  final String prenom;
  final String nom;
  final UserRole role;
  final PlanId planId;
  final DateTime? planExpiresAt;
  final String? stripeCustomerId;
  final List<Discipline> disciplines;
  final String? region;

  bool get isPremium => planId != PlanId.gratuit;
  bool get isOrganisateur => role == UserRole.organisateur;
  bool get isCoach => role == UserRole.coach;
  String get nomComplet => '$prenom $nom';
  String get initiales => '${prenom[0]}${nom[0]}'.toUpperCase();

  UserAuth copyWith({
    PlanId? planId,
    DateTime? planExpiresAt,
    String? stripeCustomerId,
    List<Discipline>? disciplines,
    String? region,
  }) => UserAuth(
    id: id,
    email: email,
    prenom: prenom,
    nom: nom,
    role: role,
    planId: planId ?? this.planId,
    planExpiresAt: planExpiresAt ?? this.planExpiresAt,
    stripeCustomerId: stripeCustomerId ?? this.stripeCustomerId,
    disciplines: disciplines ?? this.disciplines,
    region: region ?? this.region,
  );
}

/// État auth
sealed class AuthState {
  const AuthState();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.user);
  final UserAuth user;
}

class AuthError extends AuthState {
  const AuthError(this.message);
  final String message;
}
