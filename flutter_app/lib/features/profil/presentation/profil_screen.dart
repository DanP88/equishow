import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../domain/cavalier.dart';
import 'profil_edit_sheet.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/router/app_router.dart';
import '../../../core/widgets/eq_badge.dart';
import '../../../core/widgets/eq_section_header.dart';
import '../../../core/widgets/eq_states.dart';

/// Écran Profil — cavalier connecté, chevaux, stats saison
class ProfilScreen extends StatelessWidget {
  const ProfilScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cavalier = mockCavalier;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // ── App Bar ──────────────────────────────────────
          const SliverAppBar(
            floating: true,
            snap: true,
            backgroundColor: AppColors.background,
            elevation: 0,
            automaticallyImplyLeading: false,
            toolbarHeight: 64,
            title: Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Profil', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                    Text('Mon espace cavalier', style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w400)),
                  ],
                ),
              ],
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            sliver: SliverList(
              delegate: SliverChildListDelegate([

                // ── Carte profil ──────────────────────────
                _ProfilCard(cavalier: cavalier),
                const SizedBox(height: 20),

                // ── Stats saison ──────────────────────────
                const EQSectionHeader(title: 'Saison 2025'),
                const SizedBox(height: 10),
                _StatsSaison(stats: cavalier.statsAnnee),
                const SizedBox(height: 20),

                // ── Mes chevaux ───────────────────────────
                EQSectionHeader(
                  title: 'Mes chevaux',
                  actionLabel: 'Ajouter',
                  onAction: () => context.go(AppRoutes.chevaux),
                ),
                const SizedBox(height: 10),
                ...cavalier.chevaux.map((c) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _ChevalCard(cheval: c),
                )),
                const SizedBox(height: 10),

                // ── Abonnement ────────────────────────────
                const EQSectionHeader(title: 'Mon abonnement'),
                const SizedBox(height: 10),
                _SettingsRow(
                  icon: Icons.star_outline_rounded,
                  label: 'Gérer mon abonnement',
                  onTap: () => context.go(AppRoutes.abonnement),
                  color: AppColors.primary,
                ),
                const SizedBox(height: 16),

                // ── Paramètres ────────────────────────────
                const EQSectionHeader(title: 'Paramètres'),
                const SizedBox(height: 10),
                _SettingsRow(icon: Icons.notifications_outlined, label: 'Notifications', onTap: () => _showInfo(context, 'Notifications', 'La gestion des notifications sera disponible dans une prochaine mise à jour.')),
                _SettingsRow(icon: Icons.shield_outlined, label: 'Confidentialité', onTap: () => _showInfo(context, 'Confidentialité', 'Vos données sont protégées conformément au RGPD. Options avancées bientôt disponibles.')),
                _SettingsRow(icon: Icons.help_outline_rounded, label: 'Aide & support', onTap: () => _showInfo(context, 'Aide & support', 'Pour toute question, contactez-nous à support@equishow.fr')),
                _SettingsRow(
                  icon: Icons.logout_rounded,
                  label: 'Se déconnecter',
                  color: AppColors.urgent,
                  onTap: () => EQSnackbar.show(context, message: 'Déconnexion', isSuccess: false),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

void _showInfo(BuildContext context, String titre, String message) {
  showDialog<void>(
    context: context,
    builder: (_) => AlertDialog(
      title: Text(titre, style: const TextStyle(fontWeight: FontWeight.w800)),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('OK')),
      ],
    ),
  );
}

// ── Profil card ────────────────────────────────────────────────────────────────

class _ProfilCard extends StatelessWidget {
  const _ProfilCard({required this.cavalier});
  final Cavalier cavalier;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXL),
        border: Border.all(color: AppColors.border),
        boxShadow: AppTheme.shadowCard,
      ),
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.primaryDark],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Center(
              child: Text(
                cavalier.initiales,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Colors.white),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  cavalier.nomComplet,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                      ),
                      child: Text(cavalier.niveau, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary)),
                    ),
                    const SizedBox(width: 6),
                    Text('Lic. ${cavalier.licenseFfe}', style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '${cavalier.chevaux.length} cheval${cavalier.chevaux.length > 1 ? 'aux' : ''}',
                  style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          // Edit button
          Semantics(
            label: 'Modifier le profil',
            button: true,
            child: GestureDetector(
              onTap: () => EQSnackbar.show(context, message: 'Édition profil — bientôt disponible', isSuccess: false),
              child: Container(
                width: 44, height: 44,
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Icon(Icons.edit_outlined, size: 16, color: AppColors.textSecondary),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Stats saison ───────────────────────────────────────────────────────────────

class _StatsSaison extends StatelessWidget {
  const _StatsSaison({required this.stats});
  final CavalierStats stats;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _StatBox(value: '${stats.nbConcours}', label: 'Concours', color: AppColors.primary)),
        const SizedBox(width: 8),
        Expanded(child: _StatBox(value: '${stats.nbPodiums}', label: 'Podiums', color: AppColors.gold)),
        const SizedBox(width: 8),
        Expanded(child: _StatBox(value: stats.meilleurClassement, label: 'Meilleur', color: AppColors.success)),
        const SizedBox(width: 8),
        Expanded(child: _StatBox(value: '${stats.economiesTransport.toInt()}€', label: 'Économisés', color: AppColors.info)),
      ],
    );
  }
}

class _StatBox extends StatelessWidget {
  const _StatBox({required this.value, required this.label, required this.color});
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMD),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textTertiary, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

// ── Cheval card ────────────────────────────────────────────────────────────────

class _ChevalCard extends StatelessWidget {
  const _ChevalCard({required this.cheval});
  final Cheval cheval;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusLG),
        border: Border.all(color: AppColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(AppTheme.radiusLG),
        child: Semantics(
          label: '${cheval.nom}, ${cheval.race}, ${cheval.age} ans, ${cheval.discipline.label}',
          button: true,
          child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusLG),
          onTap: () {},
          excludeFromSemantics: true,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                // Icône cheval
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: cheval.discipline.color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text('🐴', style: const TextStyle(fontSize: 20)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(cheval.nom, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                      const SizedBox(height: 2),
                      Text('${cheval.race} · ${cheval.age} ans', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
                DisciplineBadge(discipline: cheval.discipline),
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.textTertiary),
              ],
            ),
          ),
          ),
        ),
      ),
    );
  }
}

// ── Settings row ───────────────────────────────────────────────────────────────

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({required this.icon, required this.label, required this.onTap, this.color});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textPrimary;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMD),
        border: Border.all(color: AppColors.border),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(AppTheme.radiusMD),
        child: Semantics(
          label: label,
          button: true,
          child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusMD),
          onTap: onTap,
          excludeFromSemantics: true,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Icon(icon, size: 18, color: c, semanticLabel: ''),
                const SizedBox(width: 12),
                Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c)),
                const Spacer(),
                Icon(Icons.chevron_right_rounded, size: 18, color: color != null ? c.withOpacity(0.5) : AppColors.textTertiary, semanticLabel: ''),
              ],
            ),
          ),
          ),
        ),
      ),
    );
  }
}
