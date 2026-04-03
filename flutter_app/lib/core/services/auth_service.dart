import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'supabase_service.dart';
import '../utils/logger.dart';

sealed class AuthResult {
  const AuthResult();
}

final class AuthSuccess extends AuthResult {
  const AuthSuccess();
}

final class AuthFailure extends AuthResult {
  const AuthFailure(this.message);
  final String message;
}

class AuthService {
  const AuthService(this._client);
  final SupabaseClient _client;

  User? get currentUser => _client.auth.currentUser;
  bool get isSignedIn   => currentUser != null;

  Future<AuthResult> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      await _client.auth.signInWithPassword(email: email, password: password);
      AppLogger.info('AuthService', 'signIn success: $email');
      return const AuthSuccess();
    } on AuthException catch (e) {
      AppLogger.warning('AuthService', 'signIn failure: ${e.message}');
      return AuthFailure(_localize(e.message));
    } catch (e) {
      AppLogger.error('AuthService', 'signIn unexpected: $e');
      return const AuthFailure('Erreur inattendue. Réessayez.');
    }
  }

  Future<AuthResult> signUp({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) async {
    try {
      await _client.auth.signUp(
        email: email,
        password: password,
        data: {'full_name': fullName, if (phone != null) 'phone': phone},
      );
      AppLogger.info('AuthService', 'signUp success: $email');
      return const AuthSuccess();
    } on AuthException catch (e) {
      AppLogger.warning('AuthService', 'signUp failure: ${e.message}');
      return AuthFailure(_localize(e.message));
    } catch (e) {
      AppLogger.error('AuthService', 'signUp unexpected: $e');
      return const AuthFailure('Erreur inattendue. Réessayez.');
    }
  }

  Future<void> signOut() async {
    try {
      await _client.auth.signOut();
    } catch (e) {
      AppLogger.error('AuthService', 'signOut error: $e');
    }
  }

  String _localize(String msg) => switch (msg) {
        'Invalid login credentials' => 'Email ou mot de passe incorrect.',
        'Email not confirmed'       => 'Confirmez votre email avant de vous connecter.',
        'User already registered'   => 'Un compte existe déjà avec cet email.',
        _                           => 'Erreur d\'authentification. Réessayez.',
      };
}

final authServiceProvider = Provider<AuthService>(
  (ref) => AuthService(ref.watch(supabaseClientProvider)),
  name: 'authServiceProvider',
);
