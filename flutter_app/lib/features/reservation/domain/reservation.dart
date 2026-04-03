/// Type de réservation
enum ReservationType {
  transport('Transport', '🚗', 'Place dans un transport'),
  box('Box cheval', '🐴', 'Box au concours'),
  coach('Coaching', '🎖️', 'Session de coaching');

  const ReservationType(this.label, this.emoji, this.description);
  final String label;
  final String emoji;
  final String description;
}

/// Statut d'une réservation
enum ReservationStatus {
  enAttente('En attente', 0xFFD97706),
  confirmee('Confirmée', 0xFF16A34A),
  annulee('Annulée', 0xFFDC2626),
  terminee('Terminée', 0xFF6B7280);

  const ReservationStatus(this.label, this.colorValue);
  final String label;
  final int colorValue;
}

/// Réservation
class Reservation {
  const Reservation({
    required this.id,
    required this.type,
    required this.titre,
    required this.sousTitre,
    required this.montant,
    required this.status,
    required this.date,
    this.stripePaymentIntentId,
    this.stripeReceiptUrl,
  });

  final String id;
  final ReservationType type;
  final String titre;
  final String sousTitre;
  final double montant;
  final ReservationStatus status;
  final DateTime date;
  final String? stripePaymentIntentId;  // TODO: Stripe Connect
  final String? stripeReceiptUrl;

  /// Commission plateforme (9% sur transport/box, 0% sur abonnement)
  double get commission => type == ReservationType.transport || type == ReservationType.box
      ? montant * 0.09
      : 0;

  double get montantCreateur => montant - commission;
}

/// Données mock
final mockReservations = [
  Reservation(
    id: 'res_1',
    type: ReservationType.transport,
    titre: 'CSO Saint-Lô — Transport',
    sousTitre: 'Marie-Laure D. · Versailles → Saint-Lô',
    montant: 30,
    status: ReservationStatus.confirmee,
    date: DateTime.now().add(const Duration(days: 6)),
    stripePaymentIntentId: 'pi_mock_001',
  ),
  Reservation(
    id: 'res_2',
    type: ReservationType.coach,
    titre: 'Coaching Pierre M.',
    sousTitre: 'Session 45min · Jardy',
    montant: 60,
    status: ReservationStatus.confirmee,
    date: DateTime.now().add(const Duration(days: 4)),
  ),
];
