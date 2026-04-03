import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/cheval.dart';

// ── State ─────────────────────────────────────────────────────────────────────

class ChevauxState {
  const ChevauxState({
    required this.chevaux,
    this.isLoading = false,
  });

  final List<Cheval> chevaux;
  final bool isLoading;

  ChevauxState copyWith({List<Cheval>? chevaux, bool? isLoading}) => ChevauxState(
    chevaux: chevaux ?? this.chevaux,
    isLoading: isLoading ?? this.isLoading,
  );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class ChevauxNotifier extends StateNotifier<ChevauxState> {
  ChevauxNotifier() : super(const ChevauxState(chevaux: [])) {
    _chargerChevaux();
  }

  Future<void> _chargerChevaux() async {
    state = state.copyWith(isLoading: true);
    await Future.delayed(const Duration(milliseconds: 400)); // simule réseau
    state = state.copyWith(chevaux: mockChevaux, isLoading: false);
  }

  /// Sélectionner une photo (mock — en production: image_picker + upload Supabase Storage)
  /// Retourne true si réussi
  Future<bool> mettreAJourPhoto(String chevalId, String photoUrl) async {
    // TODO: En production — uploader photoUrl vers Supabase Storage et récupérer l'URL publique
    await Future.delayed(const Duration(milliseconds: 300));
    final updated = state.chevaux.map((c) {
      if (c.id == chevalId) return c.copyWith(photoUrl: photoUrl);
      return c;
    }).toList();
    state = state.copyWith(chevaux: updated);
    return true;
  }

  /// Modifier les caractéristiques d'un cheval
  Future<void> modifierCheval(Cheval updated) async {
    // TODO: PATCH Supabase
    await Future.delayed(const Duration(milliseconds: 200));
    state = state.copyWith(
      chevaux: state.chevaux.map((c) => c.id == updated.id ? updated : c).toList(),
    );
  }

  /// Ajouter un nouveau cheval
  Future<void> ajouterCheval(Cheval cheval) async {
    // TODO: POST Supabase
    await Future.delayed(const Duration(milliseconds: 200));
    state = state.copyWith(chevaux: [...state.chevaux, cheval]);
  }

  /// Refresh depuis Supabase (stub)
  Future<void> rafraichir() async {
    state = state.copyWith(isLoading: true);
    await Future.delayed(const Duration(milliseconds: 500));
    state = state.copyWith(chevaux: mockChevaux, isLoading: false);
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

final chevauxProvider = StateNotifierProvider<ChevauxNotifier, ChevauxState>(
  (ref) => ChevauxNotifier(),
);

/// Accès rapide à la liste des chevaux
final chevauxListProvider = Provider<List<Cheval>>((ref) {
  return ref.watch(chevauxProvider).chevaux;
});

/// Un cheval par ID
final chevalByIdProvider = Provider.family<Cheval?, String>((ref, id) {
  return ref.watch(chevauxListProvider).where((c) => c.id == id).firstOrNull;
});
