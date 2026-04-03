import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/services/supabase_service.dart';
import '../domain/auth_user.dart';

class AuthRepository {
  const AuthRepository(this._ref);
  final Ref _ref;

  AuthUser? get currentUser {
    final user = _ref.read(supabaseClientProvider).auth.currentUser;
    return user == null ? null : AuthUser.fromSupabase(user);
  }

  bool get isSignedIn => currentUser != null;

  Stream<AuthUser?> watchCurrentUser() => _ref
      .read(supabaseClientProvider)
      .auth
      .onAuthStateChange
      .map((state) => state.session?.user == null
          ? null
          : AuthUser.fromSupabase(state.session!.user));
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref),
  name: 'authRepositoryProvider',
);

final currentUserProvider = StreamProvider<AuthUser?>(
  (ref) => ref.watch(authRepositoryProvider).watchCurrentUser(),
  name: 'currentUserProvider',
);
