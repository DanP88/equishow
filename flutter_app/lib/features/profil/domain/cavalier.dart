import '../../../core/widgets/eq_badge.dart';

/// Profil cavalier connecté
class Cavalier {
  const Cavalier({
    required this.id,
    required this.prenom,
    required this.nom,
    required this.niveau,
    required this.licenseFfe,
    required this.chevaux,
    required this.statsAnnee,
  });

  final String id;
  final String prenom;
  final String nom;
  final String niveau;
  final String licenseFfe;
  final List<Cheval> chevaux;
  final CavalierStats statsAnnee;

  String get initiales => '${prenom[0]}${nom[0]}'.toUpperCase();
  String get nomComplet => '$prenom $nom';
}

class Cheval {
  const Cheval({
    required this.id,
    required this.nom,
    required this.race,
    required this.anneeNaissance,
    required this.discipline,
  });

  final String id;
  final String nom;
  final String race;
  final int anneeNaissance;
  final Discipline discipline;

  int get age => DateTime.now().year - anneeNaissance;
}

class CavalierStats {
  const CavalierStats({
    required this.nbConcours,
    required this.nbPodiums,
    required this.meilleurClassement,
    required this.nbTransportsEffectues,
    required this.economiesTransport,
  });

  final int nbConcours;
  final int nbPodiums;
  final String meilleurClassement;
  final int nbTransportsEffectues;
  final double economiesTransport;
}

/// Cavalier connecté (mock)
final mockCavalier = Cavalier(
  id: 'cav_1',
  prenom: 'Sarah',
  nom: 'Lefebvre',
  niveau: 'Amateur 4',
  licenseFfe: '123456',
  chevaux: [
    Cheval(
      id: 'chv_1',
      nom: 'Quartz de Lune',
      race: 'Selle Français',
      anneeNaissance: 2015,
      discipline: Discipline.cso,
    ),
    Cheval(
      id: 'chv_2',
      nom: 'Éclat du Matin',
      race: 'KWPN',
      anneeNaissance: 2017,
      discipline: Discipline.dressage,
    ),
  ],
  statsAnnee: const CavalierStats(
    nbConcours: 12,
    nbPodiums: 4,
    meilleurClassement: '2ème / 24',
    nbTransportsEffectues: 7,
    economiesTransport: 340,
  ),
);
