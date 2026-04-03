import 'package:flutter/material.dart';

enum PostType { seance, concours, progres, photo }
enum Reaction { like, fire, muscle, trophy }

class PostReactions {
  const PostReactions({
    this.like = 0,
    this.fire = 0,
    this.muscle = 0,
    this.trophy = 0,
    this.userReaction,
  });

  final int like;
  final int fire;
  final int muscle;
  final int trophy;
  final Reaction? userReaction;

  int get total => like + fire + muscle + trophy;

  PostReactions copyWith({
    int? like, int? fire, int? muscle, int? trophy,
    Reaction? userReaction,
    bool clearReaction = false,
  }) => PostReactions(
    like:   like   ?? this.like,
    fire:   fire   ?? this.fire,
    muscle: muscle ?? this.muscle,
    trophy: trophy ?? this.trophy,
    userReaction: clearReaction ? null : (userReaction ?? this.userReaction),
  );
}

// ── PostFeed — immuable ───────────────────────────────────────────────────────

class PostFeed {
  const PostFeed({
    required this.id,
    required this.auteurNom,
    required this.auteurInitiales,
    required this.auteurColor,
    required this.type,
    required this.titre,
    required this.date,
    required this.reactions,
    this.photoUrl,
    this.discipline,
    this.chevaux,
    this.lieu,
    this.dureeMin,
    this.intensite,
    this.commentairesCount = 0,
    this.description,
  });

  final String id;
  final String auteurNom;
  final String auteurInitiales;
  final Color auteurColor;
  final PostType type;
  final String titre;
  final DateTime date;
  final PostReactions reactions;
  final String? photoUrl;
  final String? discipline;
  final String? chevaux;
  final String? lieu;
  final int? dureeMin;
  final double? intensite;
  final int commentairesCount;
  final String? description;

  PostFeed copyWith({PostReactions? reactions, int? commentairesCount}) => PostFeed(
    id: id,
    auteurNom: auteurNom,
    auteurInitiales: auteurInitiales,
    auteurColor: auteurColor,
    type: type,
    titre: titre,
    date: date,
    reactions: reactions ?? this.reactions,
    photoUrl: photoUrl,
    discipline: discipline,
    chevaux: chevaux,
    lieu: lieu,
    dureeMin: dureeMin,
    intensite: intensite,
    commentairesCount: commentairesCount ?? this.commentairesCount,
    description: description,
  );
}

// ── Mock data factory — retourne des instances fraîches à chaque appel ────────
// Ne jamais stocker la liste retournée comme état global mutable.

List<PostFeed> buildMockPosts() {
  final now = DateTime.now();
  return [
    PostFeed(
      id: 'p1',
      auteurNom: 'Marie Fontaine',
      auteurInitiales: 'MF',
      auteurColor: const Color(0xFF7C3AED),
      type: PostType.seance,
      titre: 'Séance de travail',
      discipline: 'CSO',
      chevaux: 'Éclipse du Vent',
      lieu: 'Haras du Moulin',
      dureeMin: 65,
      intensite: 0.72,
      date: now.subtract(const Duration(hours: 2)),
      reactions: const PostReactions(like: 12, fire: 8, muscle: 4, trophy: 2),
      description: 'Super séance aujourd\'hui ! On a travaillé les combinaisons à 1,20m, Éclipse était vraiment dans un bon jour 🐴',
      commentairesCount: 5,
    ),
    PostFeed(
      id: 'p2',
      auteurNom: 'Sophie Bernard',
      auteurInitiales: 'SB',
      auteurColor: const Color(0xFF0369A1),
      type: PostType.concours,
      titre: 'Résultat concours',
      discipline: 'Dressage',
      chevaux: 'Aria',
      lieu: 'Saint-Lô',
      date: now.subtract(const Duration(hours: 6)),
      reactions: const PostReactions(like: 34, fire: 5, muscle: 2, trophy: 18),
      description: '🏆 2ème place en Dressage Club B ! Très fière de ma jument, elle a donné le meilleur d\'elle-même.',
      commentairesCount: 14,
    ),
    PostFeed(
      id: 'p3',
      auteurNom: 'Laura Martin',
      auteurInitiales: 'LM',
      auteurColor: const Color(0xFF16A34A),
      type: PostType.progres,
      titre: 'Nouveau record personnel',
      discipline: 'CCE',
      chevaux: 'Tonnerre Noir',
      dureeMin: 90,
      intensite: 0.88,
      date: now.subtract(const Duration(hours: 14)),
      reactions: const PostReactions(like: 21, fire: 19, muscle: 11, trophy: 6),
      description: 'Premier cross complet à 1,05m sans faute ! 💪 On continue à progresser ensemble.',
      commentairesCount: 8,
    ),
    PostFeed(
      id: 'p4',
      auteurNom: 'Chloé Dubois',
      auteurInitiales: 'CD',
      auteurColor: const Color(0xFFE11D48),
      type: PostType.seance,
      titre: 'Travail en main',
      discipline: 'Dressage',
      chevaux: 'Nocturne',
      dureeMin: 40,
      intensite: 0.45,
      date: now.subtract(const Duration(days: 1)),
      reactions: const PostReactions(like: 7, fire: 3, muscle: 2, trophy: 0),
      description: 'Séance douce en main pour récupérer après le concours. Nocturne adore ça 🌿',
      commentairesCount: 2,
    ),
    PostFeed(
      id: 'p5',
      auteurNom: 'Emma Rousseau',
      auteurInitiales: 'ER',
      auteurColor: const Color(0xFFF97316),
      type: PostType.photo,
      titre: 'Belle journée à l\'écurie',
      chevaux: 'Soleil d\'Or',
      lieu: 'Écurie des Bruyères',
      date: now.subtract(const Duration(days: 1, hours: 3)),
      reactions: const PostReactions(like: 45, fire: 12, muscle: 3, trophy: 1),
      description: 'Coucher de soleil magique ce soir à l\'écurie ✨ Ces moments simples sont les plus précieux.',
      commentairesCount: 11,
    ),
  ];
}
