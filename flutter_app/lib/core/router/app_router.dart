import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shell/main_shell.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/signup_screen.dart';
import '../../features/auth/domain/user_auth.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../../features/chevaux/presentation/chevaux_screen.dart';
import '../../features/chevaux/presentation/cheval_detail_screen.dart';
import '../../features/concours/presentation/concours_screen.dart';
import '../../features/transport/presentation/transport_screen.dart';
import '../../features/messagerie/presentation/messagerie_screen.dart';
import '../../features/messagerie/presentation/conversation_screen.dart';
import '../../features/agenda/presentation/agenda_screen.dart';
import '../../features/profil/presentation/profil_screen.dart';
import '../../features/abonnement/presentation/abonnement_screen.dart';
import '../../features/communaute/presentation/communaute_screen.dart';

// ── Route names ───────────────────────────────────────────────────────────────
abstract final class AppRoutes {
  static const login      = '/login';
  static const signup     = '/signup';
  static const chevaux    = '/';           // Home = Mes Chevaux
  static const chevalDetail = '/chevaux';  // /chevaux/:id
  static const concours   = '/concours';
  static const transport  = '/transport';
  static const messages   = '/messages';
  static const communaute = '/communaute';
  static const agenda     = '/agenda';
  static const profil     = '/profil';
  static const abonnement = '/abonnement';
}

// ── Router provider ───────────────────────────────────────────────────────────
final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: AppRoutes.chevaux,
    debugLogDiagnostics: false,

    // ── Auth guard ─────────────────────────────────────────────────────────
    redirect: (context, state) {
      final isLoggedIn = authState is AuthAuthenticated;
      final isOnAuth   = state.uri.toString().startsWith('/login') || state.uri.toString().startsWith('/signup');

      if (!isLoggedIn && !isOnAuth) return AppRoutes.login;
      if (isLoggedIn && isOnAuth)   return AppRoutes.chevaux;
      return null;
    },

    routes: [
      // ── Écrans sans shell (auth) ─────────────────────────────────────────
      GoRoute(path: AppRoutes.login,  builder: (_, __) => const LoginScreen()),
      GoRoute(path: AppRoutes.signup, builder: (_, __) => const SignupScreen()),

      // ── Shell principal (bottom nav + header persistant) ─────────────────
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          // Home : Mes Chevaux
          GoRoute(
            path: AppRoutes.chevaux,
            pageBuilder: (_, __) => const NoTransitionPage(child: ChevauxScreen()),
          ),
          // Fiche détail d'un cheval (dans le shell pour avoir le header)
          GoRoute(
            path: '/chevaux/:id',
            pageBuilder: (_, state) => NoTransitionPage(
              child: ChevalDetailScreen(chevalId: state.pathParameters['id']!),
            ),
          ),
          GoRoute(
            path: AppRoutes.concours,
            pageBuilder: (_, __) => const NoTransitionPage(child: ConcoursScreen()),
          ),
          GoRoute(
            path: AppRoutes.transport,
            pageBuilder: (_, __) => const NoTransitionPage(child: TransportScreen()),
          ),
          GoRoute(
            path: AppRoutes.messages,
            pageBuilder: (_, __) => const NoTransitionPage(child: MessagerieScreen()),
          ),
          GoRoute(
            path: AppRoutes.communaute,
            pageBuilder: (_, __) => const NoTransitionPage(child: CommunauteScreen()),
          ),
          GoRoute(
            path: AppRoutes.agenda,
            pageBuilder: (_, __) => const NoTransitionPage(child: AgendaScreen()),
          ),
          GoRoute(
            path: AppRoutes.profil,
            pageBuilder: (_, __) => const NoTransitionPage(child: ProfilScreen()),
          ),
          GoRoute(
            path: AppRoutes.abonnement,
            pageBuilder: (_, __) => const NoTransitionPage(child: AbonnementScreen()),
          ),
        ],
      ),

      // ── Conversation (hors shell pour plein écran) ───────────────────────
      GoRoute(
        path: '/messages/:id',
        builder: (_, state) => ConversationScreen(conversationId: state.pathParameters['id']!),
      ),
    ],
  );
});
