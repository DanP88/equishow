import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/annonce_transport.dart';

// ── State ──────────────────────────────────────────────────────────────────────

class TransportState {
  const TransportState({
    this.annonces = const [],
    this.filter = TransportFilter.tous,
    this.isLoading = false,
  });

  final List<AnnonceTransport> annonces;
  final TransportFilter filter;
  final bool isLoading;

  TransportState copyWith({
    List<AnnonceTransport>? annonces,
    TransportFilter? filter,
    bool? isLoading,
  }) => TransportState(
    annonces: annonces ?? this.annonces,
    filter: filter ?? this.filter,
    isLoading: isLoading ?? this.isLoading,
  );
}

// ── Notifier ───────────────────────────────────────────────────────────────────

class TransportNotifier extends StateNotifier<TransportState> {
  TransportNotifier() : super(const TransportState()) {
    _load();
  }

  Future<void> _load() async {
    state = state.copyWith(isLoading: true);
    await Future.delayed(const Duration(milliseconds: 600));
    state = state.copyWith(annonces: mockAnnonces, isLoading: false);
  }

  void setFilter(TransportFilter f) => state = state.copyWith(filter: f);
}

// ── Providers ──────────────────────────────────────────────────────────────────

final transportProvider = StateNotifierProvider<TransportNotifier, TransportState>(
  (ref) => TransportNotifier(),
);

final filteredAnnoncesProvider = Provider<List<AnnonceTransport>>((ref) {
  final state = ref.watch(transportProvider);
  return switch (state.filter) {
    TransportFilter.tous => state.annonces,
    TransportFilter.disponibles => state.annonces.where((a) => a.status == AnnonceStatus.ouvert && a.placesDisponibles > 0).toList(),
    TransportFilter.proche => state.annonces.where((a) {
        final diff = a.dateDepart.difference(DateTime.now()).inDays;
        return diff >= 0 && diff <= 14;
      }).toList(),
  };
});
