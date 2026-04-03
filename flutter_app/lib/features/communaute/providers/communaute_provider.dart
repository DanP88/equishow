import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/post_feed.dart';

class CommunauteState {
  const CommunauteState({required this.posts, this.isLoading = false});
  final List<PostFeed> posts;
  final bool isLoading;

  CommunauteState copyWith({List<PostFeed>? posts, bool? isLoading}) =>
      CommunauteState(
        posts: posts ?? this.posts,
        isLoading: isLoading ?? this.isLoading,
      );
}

class CommunauteNotifier extends StateNotifier<CommunauteState> {
  CommunauteNotifier() : super(const CommunauteState(posts: [])) {
    _charger();
  }

  Future<void> _charger() async {
    state = state.copyWith(isLoading: true);
    await Future.delayed(const Duration(milliseconds: 400));
    // buildMockPosts() retourne des instances fraîches — aucune mutation partagée
    state = state.copyWith(posts: buildMockPosts(), isLoading: false);
  }

  Future<void> rafraichir() async {
    state = state.copyWith(isLoading: true);
    await Future.delayed(const Duration(milliseconds: 500));
    state = state.copyWith(posts: buildMockPosts(), isLoading: false);
  }

  /// Ajouter / retirer / changer une réaction sur un post.
  /// Crée un nouveau PostFeed via copyWith — aucune mutation en place.
  void toggleReaction(String postId, Reaction reaction) {
    final updated = state.posts.map((p) {
      if (p.id != postId) return p;

      final prev = p.reactions;

      if (prev.userReaction == reaction) {
        // Retirer la réaction existante
        return p.copyWith(
          reactions: _decrement(prev, reaction).copyWith(clearReaction: true),
        );
      }

      // Changer ou ajouter une réaction
      var next = prev;
      if (prev.userReaction != null) {
        // Décrémenter l'ancienne réaction avant d'ajouter la nouvelle
        next = _decrement(next, prev.userReaction!);
      }
      next = _increment(next, reaction).copyWith(userReaction: reaction);
      return p.copyWith(reactions: next);
    }).toList();

    state = state.copyWith(posts: updated);
  }

  PostReactions _increment(PostReactions r, Reaction reaction) => switch (reaction) {
    Reaction.like   => r.copyWith(like: r.like + 1),
    Reaction.fire   => r.copyWith(fire: r.fire + 1),
    Reaction.muscle => r.copyWith(muscle: r.muscle + 1),
    Reaction.trophy => r.copyWith(trophy: r.trophy + 1),
  };

  PostReactions _decrement(PostReactions r, Reaction reaction) => switch (reaction) {
    Reaction.like   => r.copyWith(like: r.like > 0 ? r.like - 1 : 0),
    Reaction.fire   => r.copyWith(fire: r.fire > 0 ? r.fire - 1 : 0),
    Reaction.muscle => r.copyWith(muscle: r.muscle > 0 ? r.muscle - 1 : 0),
    Reaction.trophy => r.copyWith(trophy: r.trophy > 0 ? r.trophy - 1 : 0),
  };
}

final communauteProvider =
    StateNotifierProvider<CommunauteNotifier, CommunauteState>(
  (ref) => CommunauteNotifier(),
);
