import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;

import '../domain/user_auth.dart';

// ── Utilisateur de test — connecté automatiquement ───────────────────────────
final _testUser = AuthAuthenticated(UserAuth(
  id: 'test_user',
  email: 'test@equishow.fr',
  prenom: 'Sarah',
  nom: 'Lefebvre',
  role: UserRole.cavalier,
  planId: PlanId.gratuit,
  disciplines: const [],
));

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(_testUser) {
    // _init(); // désactivé en mode test
  }

  StreamSubscription<dynamic>? _authSub;

  SupabaseClient get _supabase => Supabase.instance.client;

  void _init() {
    try {
      final session = _supabase.auth.currentSession;
      _setUserFromSession(session);

      _authSub = _supabase.auth.onAuthStateChange.listen((data) {
        _setUserFromSession(data.session);
      });
    } catch (_) {
      state = const AuthUnauthenticated();
    }
  }

  void _setUserFromSession(Session? session) {
    final user = session?.user;

    if (user == null) {
      state = const AuthUnauthenticated();
      return;
    }

    final metadata = user.userMetadata ?? <String, dynamic>{};

    state = AuthAuthenticated(
      UserAuth(
        id: user.id,
        email: user.email ?? '',
        prenom: (metadata['prenom'] as String?) ?? '',
        nom: (metadata['nom'] as String?) ?? '',
        role: _parseRole(metadata['role'] as String?),
        planId: _parsePlanId(metadata['plan_id'] as String?),
        disciplines: const [],
        region: metadata['region'] as String?,
        planExpiresAt: null,
      ),
    );
  }

  UserRole _parseRole(String? value) {
    switch (value) {
      case 'coach':
        return UserRole.coach;
      case 'organisateur':
        return UserRole.organisateur;
      case 'cavalier':
      default:
        return UserRole.cavalier;
    }
  }

  PlanId _parsePlanId(String? value) {
    switch (value) {
      case 'cavalierAnnuel':
        return PlanId.cavalierAnnuel;
      case 'gratuit':
      default:
        return PlanId.gratuit;
    }
  }

  Future<void> login({
  required String email,
  required String password,
}) async {
  state = const AuthLoading();

  // ── Bypass de test — à retirer avant la prod ──────────────────────────────
  await Future.delayed(const Duration(milliseconds: 600));
  state = AuthAuthenticated(UserAuth(
    id: 'test_user',
    email: email,
    prenom: 'Test',
    nom: 'Cavalier',
    role: UserRole.cavalier,
    planId: PlanId.gratuit,
    disciplines: const [],
  ));
  return;
  // ─────────────────────────────────────────────────────────────────────────

  try {
    await _supabase.auth.signInWithPassword(
      email: email,
      password: password,
    );
  } catch (e) {
    state = AuthError(_parseAuthError(e));
  }
}

  Future<void> signup({
  required String email,
  required String password,
  required String prenom,
  required String nom,
  required UserRole role,
  List<Discipline> disciplines = const [],
  String? region,
}) async {
  state = const AuthLoading();

  try {
    print('SIGNUP SUPABASE LANCE');
    print('email: $email');

    final response = await _supabase.auth.signUp(
      email: email,
      password: password,
      data: {
        'prenom': prenom,
        'nom': nom,
        'role': role.name,
        'region': region,
        'plan_id': PlanId.gratuit.name,
      },
    );

    final user = response.user;

    print('SIGNUP OK');
    print('user id: ${user?.id}');
    print('session: ${response.session}');

    if (user != null) {
      await _supabase.from('profiles').upsert({
        'id': user.id,
        'email': user.email,
        'prenom': prenom,
        'nom': nom,
        'role': role.name,
        'region': region,
        'plan_id': PlanId.gratuit.name,
      });

      print('PROFILE SQL CREE');
    }
  } catch (e) {
    print('ERREUR SIGNUP: $e');
    state = const AuthUnauthenticated();
    rethrow;
  }
}

  Future<void> loginWithGoogle() async {
    state = const AuthLoading();

    try {
      await _supabase.auth.signInWithOAuth(OAuthProvider.google);
    } catch (e) {
      state = const AuthUnauthenticated();
      rethrow;
    }
  }

  Future<void> loginWithApple() async {
    state = const AuthLoading();

    try {
      await _supabase.auth.signInWithOAuth(OAuthProvider.apple);
    } catch (e) {
      state = const AuthUnauthenticated();
      rethrow;
    }
  }

  void updatePlan(PlanId planId, DateTime expiresAt) {
    if (state is AuthAuthenticated) {
      final user = (state as AuthAuthenticated).user;
      state = AuthAuthenticated(
        user.copyWith(
          planId: planId,
          planExpiresAt: expiresAt,
        ),
      );
    }
  }

  String _parseAuthError(Object e) {
    final msg = e.toString().toLowerCase();
    if (msg.contains('invalid login credentials') || msg.contains('invalid_credentials')) {
      return 'Email ou mot de passe incorrect.';
    }
    if (msg.contains('email not confirmed')) {
      return 'Vérifie ta boîte mail pour confirmer ton adresse email.';
    }
    if (msg.contains('too many requests')) {
      return 'Trop de tentatives. Réessaie dans quelques minutes.';
    }
    if (msg.contains('network') || msg.contains('socket')) {
      return 'Pas de connexion internet. Vérifie ta connexion.';
    }
    return 'Une erreur est survenue. Réessaie.';
  }

  Future<void> logout() async {
    await _supabase.auth.signOut();
    state = const AuthUnauthenticated();
  }

  @override
  void dispose() {
    _authSub?.cancel();
    super.dispose();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(),
);

final currentUserProvider = Provider<UserAuth?>((ref) {
  final state = ref.watch(authProvider);
  return state is AuthAuthenticated ? state.user : null;
});

final isLoadingAuthProvider = Provider<bool>((ref) {
  return ref.watch(authProvider) is AuthLoading;
});