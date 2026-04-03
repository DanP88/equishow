import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/concours.dart';

// ── State ──────────────────────────────────────────────────────────────────────

class ConcoursState {
  const ConcoursState({
    this.concours = const [],
    this.filter = ConcoursFilter.tous,
    this.isLoading = false,
    this.searchQuery = '',
  });

  final List<Concours> concours;
  final ConcoursFilter filter;
  final bool isLoading;
  final String searchQuery;

  ConcoursState copyWith({
    List<Concours>? concours,
    ConcoursFilter? filter,
    bool? isLoading,
    String? searchQuery,
  }) => ConcoursState(
    concours: concours ?? this.concours,
    filter: filter ?? this.filter,
    isLoading: isLoading ?? this.isLoading,
    searchQuery: searchQuery ?? this.searchQuery,
  );
}

// ── Notifier ───────────────────────────────────────────────────────────────────

class ConcoursNotifier extends StateNotifier<ConcoursState> {
  ConcoursNotifier() : super(const ConcoursState()) {
    _load();
  }

  Future<void> _load() async {
    state = state.copyWith(isLoading: true);
    await Future.delayed(const Duration(milliseconds: 700));
    state = state.copyWith(concours: mockConcours, isLoading: false);
  }

  void setFilter(ConcoursFilter f) => state = state.copyWith(filter: f);

  void setSearch(String q) => state = state.copyWith(searchQuery: q);
}

// ── Providers ──────────────────────────────────────────────────────────────────

final concoursProvider = StateNotifierProvider<ConcoursNotifier, ConcoursState>(
  (ref) => ConcoursNotifier(),
);

final filteredConcoursProvider = Provider<List<Concours>>((ref) {
  final state = ref.watch(concoursProvider);
  var list = state.concours;

  // Recherche texte
  if (state.searchQuery.isNotEmpty) {
    final q = state.searchQuery.toLowerCase();
    list = list.where((c) => c.nom.toLowerCase().contains(q) || c.lieu.toLowerCase().contains(q)).toList();
  }

  // Filtre
  final now = DateTime.now();
  return switch (state.filter) {
    ConcoursFilter.tous => list,
    ConcoursFilter.ceSemaine => list.where((c) {
        final diff = c.dateDebut.difference(now).inDays;
        return diff >= 0 && diff <= 7;
      }).toList(),
    ConcoursFilter.cemois => list.where((c) {
        return c.dateDebut.month == now.month && c.dateDebut.year == now.year;
      }).toList(),
    ConcoursFilter.avecTransport => list.where((c) => c.aTransport).toList(),
  };
});
