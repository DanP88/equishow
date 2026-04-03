import 'package:flutter/material.dart';

// ── Enums ──────────────────────────────────────────────────────────────────────

enum TypeCheval {
  cheval('Cheval', '🐴'),
  poney('Poney', '🦄');

  const TypeCheval(this.label, this.emoji);
  final String label;
  final String emoji;
}

enum Temperament {
  calme('Calme'),
  nerveux('Nerveux'),
  sensible('Sensible'),
  energique('Énergique'),
  joueur('Joueur'),
  timide('Timide');

  const Temperament(this.label);
  final String label;
}

enum ComportementTransport {
  calme('Calme'),
  stresse('Stressé'),
  chargementDifficile('Chargement difficile'),
  autre('Autre');

  const ComportementTransport(this.label);
  final String label;
}

enum HabitudesVie {
  pre('Au pré'),
  box('En box'),
  mix('Box + pré');

  const HabitudesVie(this.label);
  final String label;
}

enum Sociabilite {
  okCongeneres('Ok avec congénères'),
  dominant('Dominant'),
  solitaire('Solitaire'),
  autre('Autre');

  const Sociabilite(this.label);
  final String label;
}

enum NiveauTravail {
  debutant('Débutant'),
  confirme('Confirmé'),
  avance('Avancé'),
  autre('Autre');

  const NiveauTravail(this.label);
  final String label;
}

enum NiveauPratique {
  poney('Poney'),
  club('Club'),
  amateur('Amateur'),
  pro('Pro');

  const NiveauPratique(this.label);
  final String label;
}

enum FrequenceTravail {
  uneFois('1x / semaine'),
  deuxFois('2x / semaine'),
  troisFois('3x / semaine'),
  quatreFois('4x / semaine'),
  quotidien('Quotidien');

  const FrequenceTravail(this.label);
  final String label;
}

enum TypeLitiere {
  paille('Paille'),
  copeaux('Copeaux'),
  paillette('Paillette'),
  autre('Autre');

  const TypeLitiere(this.label);
  final String label;
}

enum TypeFerrure {
  ferre4Fers('Ferré 4 fers'),
  ferre2Fers('Ferré 2 fers'),
  nuPied('Nu-pied'),
  plastique('Plastique'),
  autre('Autre');

  const TypeFerrure(this.label);
  final String label;
}

/// Statut de validité d'un vaccin pour l'accès aux concours
enum VaccinStatus {
  valide,          // vert — dans les délais
  expireBientot,   // orange — expire dans < 30 jours
  expire,          // rouge — délai dépassé
  inconnu,         // gris  — date non renseignée
}

// ── Suivi santé ───────────────────────────────────────────────────────────────

class SuiviSante {
  const SuiviSante({
    this.dateVaccinGrippe,
    this.dateVaccinRhino,
    this.dateVermifuge,
    this.dateMarechal,
    this.typeFerrure,
    this.dateDentiste,
    this.dateOsteo,
    this.antecedents,
    this.allergies,
    this.pathologies,
  });

  final DateTime? dateVaccinGrippe;  // validité 6 mois pour concours
  final DateTime? dateVaccinRhino;   // validité 1 an
  final DateTime? dateVermifuge;
  final DateTime? dateMarechal;
  final TypeFerrure? typeFerrure;
  final DateTime? dateDentiste;
  final DateTime? dateOsteo;
  final String? antecedents;
  final String? allergies;
  final String? pathologies;

  /// Statut vaccin grippe — critère d'accès aux concours (180 jours)
  VaccinStatus get statutVaccinGrippe => _status(dateVaccinGrippe, 180);

  /// Statut vaccin rhino — validité 365 jours
  VaccinStatus get statutVaccinRhino => _status(dateVaccinRhino, 365);

  bool get accessibleConcours =>
      statutVaccinGrippe == VaccinStatus.valide ||
      statutVaccinGrippe == VaccinStatus.expireBientot;

  static VaccinStatus _status(DateTime? date, int validDays) {
    if (date == null) return VaccinStatus.inconnu;
    final ageDays = DateTime.now().difference(date).inDays;
    if (ageDays > validDays) return VaccinStatus.expire;
    if (ageDays > validDays - 30) return VaccinStatus.expireBientot;
    return VaccinStatus.valide;
  }

  SuiviSante copyWith({
    DateTime? dateVaccinGrippe,
    DateTime? dateVaccinRhino,
    DateTime? dateVermifuge,
    DateTime? dateMarechal,
    TypeFerrure? typeFerrure,
    DateTime? dateDentiste,
    DateTime? dateOsteo,
    String? antecedents,
    String? allergies,
    String? pathologies,
    bool clearDateVaccinGrippe = false,
    bool clearDateVaccinRhino  = false,
    bool clearDateVermifuge    = false,
    bool clearDateMarechal     = false,
    bool clearTypeFerrure      = false,
    bool clearDateDentiste     = false,
    bool clearDateOsteo        = false,
  }) => SuiviSante(
    dateVaccinGrippe: clearDateVaccinGrippe ? null : (dateVaccinGrippe ?? this.dateVaccinGrippe),
    dateVaccinRhino:  clearDateVaccinRhino  ? null : (dateVaccinRhino  ?? this.dateVaccinRhino),
    dateVermifuge:    clearDateVermifuge    ? null : (dateVermifuge    ?? this.dateVermifuge),
    dateMarechal:     clearDateMarechal     ? null : (dateMarechal     ?? this.dateMarechal),
    typeFerrure:      clearTypeFerrure      ? null : (typeFerrure      ?? this.typeFerrure),
    dateDentiste:     clearDateDentiste     ? null : (dateDentiste     ?? this.dateDentiste),
    dateOsteo:        clearDateOsteo        ? null : (dateOsteo        ?? this.dateOsteo),
    antecedents: antecedents ?? this.antecedents,
    allergies:   allergies   ?? this.allergies,
    pathologies: pathologies ?? this.pathologies,
  );
}

// ── Lien utilisateur ──────────────────────────────────────────────────────────

/// Personne liée à un cheval (propriétaire, demi-pension, etc.)
/// userId non null = compte Equishow existant → lien actif + notification envoyée
class LienUtilisateur {
  const LienUtilisateur({
    required this.nom,
    this.userId,
    this.email,
    this.initiales,
    this.avatarColor,
  });

  final String nom;
  final String? userId;       // null → personne non inscrite dans l'app
  final String? email;
  final String? initiales;
  final Color? avatarColor;

  bool get isLinked => userId != null;

  String get displayInitiales {
    if (initiales != null) return initiales!;
    final parts = nom.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return nom.isNotEmpty ? nom[0].toUpperCase() : '?';
  }

  LienUtilisateur copyWith({String? nom, String? userId, String? email, String? initiales, Color? avatarColor}) =>
      LienUtilisateur(
        nom: nom ?? this.nom,
        userId: userId ?? this.userId,
        email: email ?? this.email,
        initiales: initiales ?? this.initiales,
        avatarColor: avatarColor ?? this.avatarColor,
      );
}

// ── Gestion du cheval ─────────────────────────────────────────────────────────

class GestionCheval {
  const GestionCheval({
    this.proprietaire,
    this.demiPensionnaire,
    this.responsable,
    this.ecurieActuelle,
    this.typeLitiere,
  });

  final LienUtilisateur? proprietaire;
  final LienUtilisateur? demiPensionnaire;
  final LienUtilisateur? responsable;
  final String? ecurieActuelle;
  final TypeLitiere? typeLitiere;

  GestionCheval copyWith({
    LienUtilisateur? proprietaire,
    LienUtilisateur? demiPensionnaire,
    LienUtilisateur? responsable,
    String? ecurieActuelle,
    TypeLitiere? typeLitiere,
    bool clearProprietaire      = false,
    bool clearDemiPensionnaire  = false,
    bool clearResponsable       = false,
    bool clearEcurie            = false,
    bool clearTypeLitiere       = false,
  }) => GestionCheval(
    proprietaire:     clearProprietaire     ? null : (proprietaire     ?? this.proprietaire),
    demiPensionnaire: clearDemiPensionnaire ? null : (demiPensionnaire ?? this.demiPensionnaire),
    responsable:      clearResponsable      ? null : (responsable      ?? this.responsable),
    ecurieActuelle:   clearEcurie           ? null : (ecurieActuelle   ?? this.ecurieActuelle),
    typeLitiere:      clearTypeLitiere      ? null : (typeLitiere      ?? this.typeLitiere),
  );
}

// ── Modèles liés à un cheval ──────────────────────────────────────────────────

class ConcourInscrit {
  const ConcourInscrit({
    required this.id,
    required this.nom,
    required this.date,
    required this.lieu,
    required this.discipline,
    this.numEngagement,
  });

  final String id;
  final String nom;
  final DateTime date;
  final String lieu;
  final String discipline;
  final String? numEngagement;
}

class BoxReservee {
  const BoxReservee({
    required this.id,
    required this.ecurieNom,
    required this.concoursNom,
    required this.dateDebut,
    required this.dateFin,
    required this.prix,
    required this.contactId,
    required this.contactNom,
    this.conversationId,
  });

  final String id;
  final String ecurieNom;
  final String concoursNom;
  final DateTime dateDebut;
  final DateTime dateFin;
  final double prix;
  final String contactId;
  final String contactNom;
  final String? conversationId;
}

class TrajetReserve {
  const TrajetReserve({
    required this.id,
    required this.transporteurNom,
    required this.date,
    required this.villeDepart,
    required this.villeArrivee,
    required this.prix,
    required this.contactId,
    required this.contactNom,
    this.conversationId,
    this.nbPlaces = 1,
  });

  final String id;
  final String transporteurNom;
  final DateTime date;
  final String villeDepart;
  final String villeArrivee;
  final double prix;
  final String contactId;
  final String contactNom;
  final String? conversationId;
  final int nbPlaces;
}

class CoachReserve {
  const CoachReserve({
    required this.id,
    required this.coachNom,
    required this.date,
    required this.lieu,
    required this.typeSeance,
    required this.prix,
    required this.contactId,
    required this.contactNom,
    this.conversationId,
    this.dureeMin = 45,
  });

  final String id;
  final String coachNom;
  final DateTime date;
  final String lieu;
  final String typeSeance;
  final double prix;
  final String contactId;
  final String contactNom;
  final String? conversationId;
  final int dureeMin;
}

class ResultatConcours {
  const ResultatConcours({
    required this.id,
    required this.nom,
    required this.date,
    required this.lieu,
    required this.discipline,
    required this.classement,
    required this.nbParticipants,
    this.note,
    this.commentaire,
  });

  final String id;
  final String nom;
  final DateTime date;
  final String lieu;
  final String discipline;
  final int classement;
  final int nbParticipants;
  final double? note;
  final String? commentaire;

  bool get isPodium => classement <= 3;
  String get podiumEmoji {
    if (classement == 1) return '🥇';
    if (classement == 2) return '🥈';
    if (classement == 3) return '🥉';
    return '';
  }
}

// ── Modèle principal ──────────────────────────────────────────────────────────

class Cheval {
  const Cheval({
    required this.id,
    required this.nom,
    required this.proprietaireId,
    required this.type,
    // Identification
    this.race,
    this.robe,
    this.anneeNaissance,
    this.photoUrl,
    this.photoColor,
    this.sexe,
    this.taille,
    this.numeroSire,
    // Profil & comportement
    this.temperament = const [],
    this.comportementTransport,
    this.habitudes,
    this.sociabilite,
    this.particularitesPhysiques,
    // Sport & travail
    this.disciplines = const [],
    this.niveauPratique,
    this.niveauTravail,
    this.frequenceTravail,
    this.objectifs,
    // Santé
    this.sante,
    // Gestion
    this.gestion,
    // Réservations & concours
    this.concours = const [],
    this.boxes = const [],
    this.trajets = const [],
    this.coachs = const [],
    this.resultats = const [],
  });

  final String id;
  final String nom;
  final String proprietaireId;
  final TypeCheval type;

  // Identification
  final String? race;
  final String? robe;
  final int? anneeNaissance;
  final String? photoUrl;
  final Color? photoColor;
  final String? sexe;
  final String? taille;
  final String? numeroSire;

  // Profil & comportement
  final List<Temperament> temperament;
  final ComportementTransport? comportementTransport;
  final HabitudesVie? habitudes;
  final Sociabilite? sociabilite;
  final String? particularitesPhysiques;

  // Sport & travail
  final List<String> disciplines;   // CSO, Dressage, CCE, Autre
  final NiveauPratique? niveauPratique;
  final NiveauTravail? niveauTravail;
  final FrequenceTravail? frequenceTravail;
  final String? objectifs;

  // Santé
  final SuiviSante? sante;

  // Gestion
  final GestionCheval? gestion;

  // Réservations & historique
  final List<ConcourInscrit> concours;
  final List<BoxReservee> boxes;
  final List<TrajetReserve> trajets;
  final List<CoachReserve> coachs;
  final List<ResultatConcours> resultats;

  // ── Getters ──────────────────────────────────────────────────────────────────

  int get age => anneeNaissance != null ? DateTime.now().year - anneeNaissance! : 0;
  String get ageLabel => anneeNaissance != null ? '$age ans' : '';

  String get subtitle {
    final parts = <String>[];
    if (race != null) parts.add(race!);
    if (robe != null) parts.add(robe!);
    if (ageLabel.isNotEmpty) parts.add(ageLabel);
    return parts.join(' · ');
  }

  ConcourInscrit? get prochainConcours {
    final now = DateTime.now();
    final upcoming = concours.where((c) => c.date.isAfter(now)).toList()
      ..sort((a, b) => a.date.compareTo(b.date));
    return upcoming.isEmpty ? null : upcoming.first;
  }

  // ── copyWith ──────────────────────────────────────────────────────────────────

  Cheval copyWith({
    String? nom,
    TypeCheval? type,
    String? race,
    String? robe,
    int? anneeNaissance,
    String? photoUrl,
    Color? photoColor,
    String? sexe,
    String? taille,
    String? numeroSire,
    List<Temperament>? temperament,
    ComportementTransport? comportementTransport,
    HabitudesVie? habitudes,
    Sociabilite? sociabilite,
    String? particularitesPhysiques,
    List<String>? disciplines,
    NiveauPratique? niveauPratique,
    NiveauTravail? niveauTravail,
    FrequenceTravail? frequenceTravail,
    String? objectifs,
    SuiviSante? sante,
    GestionCheval? gestion,
    bool clearRace                    = false,
    bool clearRobe                    = false,
    bool clearAnneeNaissance          = false,
    bool clearSexe                    = false,
    bool clearTaille                  = false,
    bool clearNumeroSire              = false,
    bool clearComportementTransport   = false,
    bool clearHabitudes               = false,
    bool clearSociabilite             = false,
    bool clearParticularites          = false,
    bool clearNiveauPratique          = false,
    bool clearNiveauTravail           = false,
    bool clearFrequenceTravail        = false,
    bool clearObjectifs               = false,
  }) => Cheval(
    id: id,
    nom: nom ?? this.nom,
    proprietaireId: proprietaireId,
    type: type ?? this.type,
    race: clearRace ? null : (race ?? this.race),
    robe: clearRobe ? null : (robe ?? this.robe),
    anneeNaissance: clearAnneeNaissance ? null : (anneeNaissance ?? this.anneeNaissance),
    photoUrl: photoUrl ?? this.photoUrl,
    photoColor: photoColor ?? this.photoColor,
    sexe: clearSexe ? null : (sexe ?? this.sexe),
    taille: clearTaille ? null : (taille ?? this.taille),
    numeroSire: clearNumeroSire ? null : (numeroSire ?? this.numeroSire),
    temperament: temperament ?? this.temperament,
    comportementTransport: clearComportementTransport ? null : (comportementTransport ?? this.comportementTransport),
    habitudes: clearHabitudes ? null : (habitudes ?? this.habitudes),
    sociabilite: clearSociabilite ? null : (sociabilite ?? this.sociabilite),
    particularitesPhysiques: clearParticularites ? null : (particularitesPhysiques ?? this.particularitesPhysiques),
    disciplines: disciplines ?? this.disciplines,
    niveauPratique: clearNiveauPratique ? null : (niveauPratique ?? this.niveauPratique),
    niveauTravail: clearNiveauTravail ? null : (niveauTravail ?? this.niveauTravail),
    frequenceTravail: clearFrequenceTravail ? null : (frequenceTravail ?? this.frequenceTravail),
    objectifs: clearObjectifs ? null : (objectifs ?? this.objectifs),
    sante: sante ?? this.sante,
    gestion: gestion ?? this.gestion,
    concours: concours,
    boxes: boxes,
    trajets: trajets,
    coachs: coachs,
    resultats: resultats,
  );
}

// ── Mock utilisateurs de l'app (pour la recherche de liens) ───────────────────

const mockAppUsers = [
  LienUtilisateur(nom: 'Sophie Leclerc',     userId: 'u_ecurie_1',    email: 'sophie@ecurie.fr',         initiales: 'SL', avatarColor: Color(0xFF7C3AED)),
  LienUtilisateur(nom: 'Marie-Laure Dupont', userId: 'u_transport_1', email: 'ml.dupont@gmail.com',      initiales: 'MD', avatarColor: Color(0xFF0369A1)),
  LienUtilisateur(nom: 'Pierre Martin',      userId: 'u_coach_1',     email: 'pierre.martin@coach.fr',   initiales: 'PM', avatarColor: Color(0xFF16A34A)),
  LienUtilisateur(nom: 'Jacques Renard',     userId: 'u_ecurie_2',    email: 'j.renard@ecurie.fr',       initiales: 'JR', avatarColor: Color(0xFFD97706)),
  LienUtilisateur(nom: 'Emma Rousseau',      userId: 'u_5',           email: 'emma.r@gmail.com',         initiales: 'ER', avatarColor: Color(0xFFF97316)),
  LienUtilisateur(nom: 'Laura Martin',       userId: 'u_6',           email: 'laura.m@gmail.com',        initiales: 'LM', avatarColor: Color(0xFFE11D48)),
];

// ── Mock data ─────────────────────────────────────────────────────────────────

final mockChevaux = [
  Cheval(
    id: 'ch_1',
    nom: 'Éclipse du Vent',
    proprietaireId: 'user_1',
    type: TypeCheval.cheval,
    race: 'Selle Français',
    robe: 'Bai',
    anneeNaissance: 2016,
    sexe: 'Hongre',
    taille: '1m68',
    photoColor: const Color(0xFF8B5E3C),
    numeroSire: '01234567890A',
    temperament: [Temperament.energique, Temperament.sensible],
    comportementTransport: ComportementTransport.calme,
    habitudes: HabitudesVie.mix,
    sociabilite: Sociabilite.okCongeneres,
    disciplines: ['CSO'],
    niveauPratique: NiveauPratique.amateur,
    niveauTravail: NiveauTravail.confirme,
    frequenceTravail: FrequenceTravail.quatreFois,
    objectifs: 'Monter en Amateur 2 cette saison. Travailler les parcours 1,20m.',
    sante: SuiviSante(
      dateVaccinGrippe: DateTime.now().subtract(const Duration(days: 95)),
      dateVaccinRhino: DateTime.now().subtract(const Duration(days: 95)),
      dateVermifuge: DateTime.now().subtract(const Duration(days: 45)),
      dateMarechal: DateTime.now().subtract(const Duration(days: 32)),
      typeFerrure: TypeFerrure.ferre4Fers,
      dateDentiste: DateTime.now().subtract(const Duration(days: 120)),
      dateOsteo: DateTime.now().subtract(const Duration(days: 60)),
    ),
    gestion: GestionCheval(
      proprietaire: const LienUtilisateur(nom: 'Sarah Lefebvre', userId: 'user_1', initiales: 'SL', avatarColor: Color(0xFFF97316)),
      responsable: const LienUtilisateur(nom: 'Pierre Martin', userId: 'u_coach_1', initiales: 'PM', avatarColor: Color(0xFF16A34A)),
      ecurieActuelle: 'Haras du Moulin — Versailles',
      typeLitiere: TypeLitiere.copeaux,
    ),
    concours: [
      ConcourInscrit(id: 'co_1', nom: 'CSO Saint-Lô Grand Prix', date: DateTime.now().add(const Duration(days: 6)), lieu: 'Hippo Saint-Lô', discipline: 'CSO', numEngagement: 'ENG-2024-1142'),
      ConcourInscrit(id: 'co_2', nom: 'Championnat Normandie', date: DateTime.now().add(const Duration(days: 22)), lieu: 'Haras du Pin', discipline: 'CSO'),
    ],
    boxes: [
      BoxReservee(id: 'box_1', ecurieNom: 'Écurie du Moulin', concoursNom: 'CSO Saint-Lô', dateDebut: DateTime.now().add(const Duration(days: 5)), dateFin: DateTime.now().add(const Duration(days: 7)), prix: 45, contactId: 'u_ecurie_1', contactNom: 'Sophie Leclerc', conversationId: 'conv_1'),
    ],
    trajets: [
      TrajetReserve(id: 'tr_1', transporteurNom: 'Marie-Laure D.', date: DateTime.now().add(const Duration(days: 5)), villeDepart: 'Versailles', villeArrivee: 'Saint-Lô', prix: 30, contactId: 'u_transport_1', contactNom: 'Marie-Laure D.', conversationId: 'conv_2', nbPlaces: 1),
    ],
    coachs: [
      CoachReserve(id: 'coa_1', coachNom: 'Pierre Martin', date: DateTime.now().add(const Duration(days: 4)), lieu: 'Jardy', typeSeance: 'Séance individuelle', prix: 60, contactId: 'u_coach_1', contactNom: 'Pierre Martin', conversationId: 'conv_3', dureeMin: 45),
    ],
    resultats: [
      ResultatConcours(id: 'res_1', nom: 'CSO Versailles Printemps', date: DateTime.now().subtract(const Duration(days: 18)), lieu: 'Centre Équestre Versailles', discipline: 'CSO', classement: 2, nbParticipants: 24, commentaire: 'Très belle reprise, faute au dernier oxer.'),
      ResultatConcours(id: 'res_2', nom: 'Grand Prix Deauville', date: DateTime.now().subtract(const Duration(days: 45)), lieu: 'Hippodrome Deauville', discipline: 'CSO', classement: 1, nbParticipants: 31, commentaire: 'Sans faute en barrage. Meilleur chrono !'),
      ResultatConcours(id: 'res_3', nom: 'Coupe du Calvados', date: DateTime.now().subtract(const Duration(days: 72)), lieu: 'Caen', discipline: 'CSO', classement: 5, nbParticipants: 18),
    ],
  ),
  Cheval(
    id: 'ch_2',
    nom: 'Lumière d\'Abril',
    proprietaireId: 'user_1',
    type: TypeCheval.cheval,
    race: 'KWPN',
    robe: 'Alezan',
    anneeNaissance: 2018,
    sexe: 'Jument',
    taille: '1m63',
    photoColor: const Color(0xFFD4813A),
    temperament: [Temperament.sensible, Temperament.calme],
    habitudes: HabitudesVie.box,
    disciplines: ['Dressage'],
    niveauPratique: NiveauPratique.club,
    sante: SuiviSante(
      dateVaccinGrippe: DateTime.now().subtract(const Duration(days: 160)),
      dateVaccinRhino: DateTime.now().subtract(const Duration(days: 160)),
    ),
    gestion: const GestionCheval(
      ecurieActuelle: 'Écuries Royales — Fontainebleau',
      typeLitiere: TypeLitiere.paille,
    ),
    concours: [
      ConcourInscrit(id: 'co_3', nom: 'Dressage de Fontainebleau', date: DateTime.now().add(const Duration(days: 14)), lieu: 'Centre Équestre Fontainebleau', discipline: 'Dressage', numEngagement: 'ENG-2024-0897'),
    ],
    boxes: [
      BoxReservee(id: 'box_2', ecurieNom: 'Écuries Royales', concoursNom: 'Dressage Fontainebleau', dateDebut: DateTime.now().add(const Duration(days: 13)), dateFin: DateTime.now().add(const Duration(days: 15)), prix: 50, contactId: 'u_ecurie_2', contactNom: 'Jacques Renard', conversationId: 'conv_4'),
    ],
    trajets: [],
    coachs: [],
    resultats: [
      ResultatConcours(id: 'res_4', nom: 'Dressage Compiègne Club B', date: DateTime.now().subtract(const Duration(days: 10)), lieu: 'Compiègne', discipline: 'Dressage', classement: 3, nbParticipants: 15, note: 67.8, commentaire: 'Belle harmonie, transitions à perfectionner.'),
    ],
  ),
  Cheval(
    id: 'ch_3',
    nom: 'Tornado Black',
    proprietaireId: 'user_1',
    type: TypeCheval.cheval,
    race: 'Anglo-Arabe',
    robe: 'Noir',
    anneeNaissance: 2014,
    sexe: 'Hongre',
    photoColor: const Color(0xFF2C2C2C),
    disciplines: ['CCE', 'CSO'],
    concours: [],
    boxes: [],
    trajets: [],
    coachs: [],
    resultats: [],
  ),
];
