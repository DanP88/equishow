/// Annonce de co-voiturage pour un concours
class AnnonceTransport {
  const AnnonceTransport({
    required this.id,
    required this.concoursId,
    required this.concoursNom,
    required this.createurNom,
    required this.createurPrenom,
    required this.createurNote,
    required this.lieuDepartVille,
    required this.lieuDepartDept,
    required this.dateDepart,
    required this.heureDepart,
    required this.placesCheval,
    required this.placesDisponibles,
    required this.placesPassager,
    required this.prixParCheval,
    required this.status,
    this.commentaire,
    this.retourLeDimanche = true,
  });

  final String id;
  final String concoursId;
  final String concoursNom;
  final String createurNom;
  final String createurPrenom;
  final double createurNote;
  final String lieuDepartVille;
  final String lieuDepartDept;
  final DateTime dateDepart;
  final String heureDepart;
  final int placesCheval;
  final int placesDisponibles;
  final int placesPassager;
  final double prixParCheval;
  final AnnonceStatus status;
  final String? commentaire;
  final bool retourLeDimanche;

  String get createurInitiales =>
      '${createurPrenom[0]}${createurNom[0]}'.toUpperCase();
}

enum AnnonceStatus {
  ouvert,
  complet,
  cloture,
}

/// Filtre transport
enum TransportFilter {
  tous('Tous'),
  disponibles('Places dispo'),
  proche('Départ proche');

  const TransportFilter(this.label);
  final String label;
}

/// Données de démonstration
final mockAnnonces = [
  AnnonceTransport(
    id: '1',
    concoursId: '1',
    concoursNom: 'CSO Saint-Lô',
    createurNom: 'Dupont',
    createurPrenom: 'Marie-Laure',
    createurNote: 4.9,
    lieuDepartVille: 'Versailles',
    lieuDepartDept: '78',
    dateDepart: DateTime.now().add(const Duration(days: 6)),
    heureDepart: '7h00',
    placesCheval: 3,
    placesDisponibles: 1,
    placesPassager: 2,
    prixParCheval: 30,
    status: AnnonceStatus.ouvert,
    commentaire: 'VL + remorque 3 places. Retour dimanche soir après la remise.',
  ),
  AnnonceTransport(
    id: '2',
    concoursId: '1',
    concoursNom: 'CSO Saint-Lô',
    createurNom: 'Martin',
    createurPrenom: 'Sophie',
    createurNote: 4.7,
    lieuDepartVille: 'Paris 16e',
    lieuDepartDept: '75',
    dateDepart: DateTime.now().add(const Duration(days: 6)),
    heureDepart: '6h30',
    placesCheval: 2,
    placesDisponibles: 2,
    placesPassager: 1,
    prixParCheval: 45,
    status: AnnonceStatus.ouvert,
  ),
  AnnonceTransport(
    id: '3',
    concoursId: '3',
    concoursNom: 'CCE Fontainebleau',
    createurNom: 'Bernard',
    createurPrenom: 'Claire',
    createurNote: 5.0,
    lieuDepartVille: 'Melun',
    lieuDepartDept: '77',
    dateDepart: DateTime.now().add(const Duration(days: 22)),
    heureDepart: '8h00',
    placesCheval: 4,
    placesDisponibles: 3,
    placesPassager: 3,
    prixParCheval: 20,
    status: AnnonceStatus.ouvert,
    commentaire: 'Grand camion, 4 places chevaux. Ambiance sympa garantie !',
  ),
  AnnonceTransport(
    id: '4',
    concoursId: '4',
    concoursNom: 'Jardy — Saut International',
    createurNom: 'Leroy',
    createurPrenom: 'Isabelle',
    createurNote: 4.8,
    lieuDepartVille: 'Rueil-Malmaison',
    lieuDepartDept: '92',
    dateDepart: DateTime.now().add(const Duration(days: 30)),
    heureDepart: '7h30',
    placesCheval: 2,
    placesDisponibles: 0,
    placesPassager: 0,
    prixParCheval: 25,
    status: AnnonceStatus.complet,
  ),
];
