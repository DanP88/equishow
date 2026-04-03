import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme/app_colors.dart';
import '../core/router/app_router.dart';
import '../features/messagerie/providers/messagerie_provider.dart';
import '../features/auth/providers/auth_provider.dart';
import '../features/auth/domain/user_auth.dart';

/// Shell principal — Header persistant (Equistra) + bottom nav 4 onglets + FAB central
class MainShell extends ConsumerWidget {
  const MainShell({super.key, required this.child});
  final Widget child;

  static const _tabs = [
    _NavItem(icon: Icons.local_florist_outlined,   activeIcon: Icons.local_florist_rounded,    label: 'Chevaux',    path: AppRoutes.chevaux),
    _NavItem(icon: Icons.emoji_events_outlined,    activeIcon: Icons.emoji_events_rounded,     label: 'Concours',   path: AppRoutes.concours),
    _NavItem(icon: Icons.people_outline_rounded,   activeIcon: Icons.people_rounded,           label: 'Communauté', path: AppRoutes.communaute),
    _NavItem(icon: Icons.person_outline_rounded,   activeIcon: Icons.person_rounded,           label: 'Profil',     path: AppRoutes.profil),
  ];

  int _locationToIndex(String location) {
    if (location.startsWith('/chevaux/'))              return 0; // fiche détail → onglet Chevaux
    if (location.startsWith(AppRoutes.concours))       return 1;
    if (location.startsWith(AppRoutes.transport))      return 1; // transport → actif sous Concours
    if (location.startsWith(AppRoutes.communaute))     return 2;
    if (location.startsWith(AppRoutes.messages))       return 2; // messages → actif sous Communauté
    if (location.startsWith(AppRoutes.profil) ||
        location.startsWith(AppRoutes.abonnement) ||
        location.startsWith(AppRoutes.agenda))         return 3;
    return 0; // home = chevaux
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location     = GoRouterState.of(context).uri.toString();
    final currentIndex = _locationToIndex(location);
    final unreadCount  = ref.watch(unreadCountProvider);
    final user         = ref.watch(currentUserProvider);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: _EQTopHeader(user: user, unreadCount: unreadCount),
        body: child,
        bottomNavigationBar: _EQBottomNav(
          currentIndex: currentIndex,
          tabs: _tabs,
          messagesBadge: unreadCount,
          onTap: (i) => context.go(_tabs[i].path),
          onFabTap: () => _showFabSheet(context),
        ),
      ),
    );
  }

  void _showFabSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const _FabSheet(),
    );
  }
}

// ── Header persistant (style Equistra) ─────────────────────────────────────────

class _EQTopHeader extends StatelessWidget implements PreferredSizeWidget {
  const _EQTopHeader({this.user, required this.unreadCount});
  final UserAuth? user;
  final int unreadCount;

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surface,
      child: SafeArea(
        bottom: false,
        child: SizedBox(
          height: 60,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                // ── Logo E ────────────────────────────────────
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primary, AppColors.primaryDark],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.30),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Text('E', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900, height: 1)),
                  ),
                ),
                const SizedBox(width: 10),

                // ── App name ──────────────────────────────────
                const Text(
                  'EQUISHOW',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: AppColors.textPrimary,
                    letterSpacing: 0.8,
                  ),
                ),
                const Spacer(),

                // ── Notification bell ─────────────────────────
                Semantics(
                  label: 'Notifications',
                  button: true,
                  child: GestureDetector(
                    onTap: () {},
                    child: SizedBox(
                      width: 40, height: 40,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          const Icon(Icons.notifications_none_rounded, color: AppColors.textPrimary, size: 22),
                          if (unreadCount > 0)
                            Positioned(
                              top: 8, right: 8,
                              child: Container(
                                width: 8, height: 8,
                                decoration: const BoxDecoration(
                                  color: AppColors.urgent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 2),

                // ── Avatar ────────────────────────────────────
                Semantics(
                  label: 'Mon profil',
                  button: true,
                  child: Container(
                    width: 34, height: 34,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.primaryBorder, width: 1.5),
                    ),
                    child: Center(
                      child: Text(
                        user?.initiales ?? '?',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Bottom nav avec FAB central ─────────────────────────────────────────────────

class _EQBottomNav extends StatelessWidget {
  const _EQBottomNav({
    required this.currentIndex,
    required this.tabs,
    required this.messagesBadge,
    required this.onTap,
    required this.onFabTap,
  });

  final int currentIndex;
  final List<_NavItem> tabs;
  final int messagesBadge;
  final ValueChanged<int> onTap;
  final VoidCallback onFabTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: const Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.07),
            blurRadius: 20,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              // ── Left: Concours (0), Transport (1) ──────────
              _buildTabItem(0, tabs[0]),
              _buildTabItem(1, tabs[1]),

              // ── FAB central ────────────────────────────────
              SizedBox(
                width: 72,
                child: Center(
                  child: Transform.translate(
                    offset: const Offset(0, -14),
                    child: Semantics(
                      label: 'Actions rapides',
                      button: true,
                      child: GestureDetector(
                        onTap: onFabTap,
                        child: Container(
                          width: 58, height: 58,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppColors.primary, AppColors.primaryDark],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primary.withOpacity(0.45),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                              BoxShadow(
                                color: AppColors.primary.withOpacity(0.15),
                                blurRadius: 4,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: const Icon(Icons.add_rounded, color: Colors.white, size: 30),
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // ── Right: Messages (2), Profil (3) ────────────
              _buildTabItem(2, tabs[2]),
              _buildTabItem(3, tabs[3]),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTabItem(int index, _NavItem tab) {
    final isActive  = index == currentIndex;
    // Messages badge on Communauté tab (index 2)
    final showBadge = index == 2 && messagesBadge > 0;

    return Expanded(
      child: Semantics(
        label: tab.label,
        button: true,
        selected: isActive,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => onTap(index),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 48, height: 32,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    if (isActive)
                      Container(
                        width: 40, height: 26,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(13),
                        ),
                      ),
                    Icon(
                      isActive ? tab.activeIcon : tab.icon,
                      color: isActive ? AppColors.primary : AppColors.textTertiary,
                      size: 20,
                    ),
                    if (showBadge)
                      Positioned(
                        top: 1, right: 4,
                        child: Container(
                          constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          decoration: BoxDecoration(
                            color: AppColors.urgent,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.white, width: 1.5),
                          ),
                          child: Text(
                            '$messagesBadge',
                            style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 1),
              Text(
                tab.label,
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                  color: isActive ? AppColors.primary : AppColors.textTertiary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── FAB Quick-action sheet ──────────────────────────────────────────────────────

class _FabSheet extends StatelessWidget {
  const _FabSheet();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.12),
            blurRadius: 24,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Poignée ────────────────────────────────────────
          const SizedBox(height: 12),
          Container(
            width: 36, height: 4,
            decoration: BoxDecoration(
              color: AppColors.borderMedium,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 18),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Actions rapides',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Que souhaitez-vous faire ?',
                  style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
                _FabAction(
                  icon: Icons.directions_car_rounded,
                  color: AppColors.primary,
                  label: 'Proposer un transport',
                  subtitle: 'Créer une annonce de co-transport',
                  onTap: () { Navigator.pop(context); context.go(AppRoutes.transport); },
                ),
                _FabAction(
                  icon: Icons.home_work_rounded,
                  color: const Color(0xFF7C3AED),
                  label: 'Réserver une box',
                  subtitle: 'Trouver une place pour votre cheval',
                  onTap: () { Navigator.pop(context); context.go(AppRoutes.concours); },
                ),
                _FabAction(
                  icon: Icons.calendar_month_rounded,
                  color: const Color(0xFF0369A1),
                  label: 'Mon agenda',
                  subtitle: 'Voir mes concours et planning',
                  onTap: () { Navigator.pop(context); context.go(AppRoutes.agenda); },
                ),
                _FabAction(
                  icon: Icons.chat_bubble_outline_rounded,
                  color: const Color(0xFF16A34A),
                  label: 'Mes messages',
                  subtitle: 'Voir toutes mes conversations',
                  onTap: () { Navigator.pop(context); context.go(AppRoutes.messages); },
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FabAction extends StatelessWidget {
  const _FabAction({
    required this.icon,
    required this.color,
    required this.label,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final Color color;
  final String label;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              Container(
                width: 46, height: 46,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.10),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.textTertiary, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem({required this.icon, required this.activeIcon, required this.label, required this.path});
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String path;
}
