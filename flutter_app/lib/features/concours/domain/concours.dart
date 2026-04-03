import '../../../core/widgets/eq_badge.dart';

/// Modèle Concours
class Concours {
  const Concours({
    required this.id,
    required this.nom,
    required this.lieu,
    required this.departement,
    required this.dateDebut,
    required this.dateFin,
    required this.disciplines,
    required this.niveaux,
    this.sourceApi = 'manuel',
    this.nbEngages = 0,
    this.nbAnnoncesTransport = 0,
  });

  final String id;
  final String nom;
  final String lieu;
  final String departement;
  final DateTime dateDebut;
  final DateTime dateFin;
  final List<Discipline> disciplines;
  final List<String> niveaux;
  final String sourceApi;
  final int nbEngages;
  final int nbAnnoncesTransport;

  bool get isMultiJours => !dateFin.difference(dateDebut).isNegative && dateFin.day != dateDebut.day;
  bool get aTransport => nbAnnoncesTransport > 0;
}

/// Filtre concours
enum ConcoursFilter {
  tous('Tous'),
  ceSemaine('Cette semaine'),
  cemois('Ce mois'),
  avecTransport('Avec transport');

  const ConcoursFilter(this.label);
  final String label;
}

/// Données de démonstration
final mockConcours = [
  Concours(
    id: '1',
    nom: 'CSO Saint-Lô',
    lieu: 'Haras National de Saint-Lô',
    departement: '50 — Manche',
    dateDebut: DateTime.now().add(const Duration(days: 6)),
    dateFin: DateTime.now().add(const Duration(days: 7)),
    disciplines: [Discipline.cso],
    niveaux: ['Amateur 3', 'Amateur 4', 'Amateur 5', 'Pro'],
    sourceApi: 'FFECompet',
    nbEngages: 142,
    nbAnnoncesTransport: 3,
  ),
  Concours(
    id: '2',
    nom: 'Haras du Pin — Dressage',
    lieu: 'Haras National du Pin',
    departement: '61 — Orne',
    dateDebut: DateTime.now().add(const Duration(days: 15)),
    dateFin: DateTime.now().add(const Duration(days: 16)),
    disciplines: [Discipline.dressage],
    niveaux: ['Amateur 1', 'Amateur 2', 'Amateur 3', 'Pro'],
    sourceApi: 'FFECompet',
    nbEngages: 89,
    nbAnnoncesTransport: 0,
  ),
  Concours(
    id: '3',
    nom: 'CCE Fontainebleau',
    lieu: 'Centre équestre de Fontainebleau',
    departement: '77 — Seine-et-Marne',
    dateDebut: DateTime.now().add(const Duration(days: 22)),
    dateFin: DateTime.now().add(const Duration(days: 24)),
    disciplines: [Discipline.cce],
    niveaux: ['Amateur 4', 'Amateur 5', 'Pro'],
    sourceApi: 'Winjump',
    nbEngages: 67,
    nbAnnoncesTransport: 5,
  ),
  Concours(
    id: '4',
    nom: 'Jardy — Saut International',
    lieu: 'CRE Île-de-France, Marnes-la-Coquette',
    departement: '92 — Hauts-de-Seine',
    dateDebut: DateTime.now().add(const Duration(days: 30)),
    dateFin: DateTime.now().add(const Duration(days: 31)),
    disciplines: [Discipline.cso],
    niveaux: ['Amateur 5', 'Pro', 'Grand Prix'],
    sourceApi: 'Winjump',
    nbEngages: 210,
    nbAnnoncesTransport: 8,
  ),
];
