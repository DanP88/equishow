import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/plan_abonnement.dart';
import '../../auth/domain/user_auth.dart';
import '../../auth/providers/auth_provider.dart';
import '../../paiement/presentation/paiement_sheet.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/eq_states.dart';

/// Écran Abonnement — tous les plans selon le rôle de l'utilisateur
class AbonnementScreen extends ConsumerStatefulWidget {
  const AbonnementScreen({super.key});

  @override
  ConsumerState<AbonnementScreen> createState() => _AbonnementScreenState();
}

class _AbonnementScreenState extends ConsumerState<AbonnementScreen> {
  UserRole _roleTab = UserRole.cavalier;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    if (user != null) _roleTab = user.role;

    final plans = plansByRole[_roleTab] ?? [];

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // ── App Bar ──────────────────────────────────────
          SliverAppBar(
            floating: true,
            snap: true,
            backgroundColor: AppColors.background,
            elevation: 0,
            automaticallyImplyLeading: false,
            toolbarHeight: 64,
            title: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Abonnement', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                Text('Choisissez votre plan', style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w400)),
              ],
            ),
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Bannière avantages ────────────────────
                  _AvantagesBanner(),
                  const SizedBox(height: 20),

                  // ── Selector rôle ─────────────────────────
                  if (user == null) ...[
                    _RoleTabs(selected: _roleTab, onSelect: (r) => setState(() => _roleTab = r)),
                    const SizedBox(height: 20),
                  ],

                  // ── Plans ─────────────────────────────────
                  ...plans.map((plan) => Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: _PlanCard(
                      plan: plan,
                      isActif: user?.planId == plan.id,
                      onSelect: () => _selectPlan(plan),
                    ),
                  )),

                  // ── Garantie ──────────────────────────────
                  const SizedBox(height: 8),
                  _GarantieRow(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _selectPlan(PlanAbonnement plan) {
    if (plan.isGratuit) return;
    PaiementSheet.show(
      context,
      titre: plan.nom,
      montant: plan.prix,
      description: 'Abonnement Equishow — ${plan.nom}',
      onSuccess: () {
        final expiry = DateTime.now().add(
          plan.periode.contains('mois') ? const Duration(days: 30) : const Duration(days: 365),
        );
        ref.read(authProvider.notifier).updatePlan(plan.id, expiry);
        EQSnackbar.show(context, message: 'Abonnement ${plan.nom} activé !');
      },
    );
  }
}

// ── Bannière avantages ─────────────────────────────────────────────────────────

class _AvantagesBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusXL),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('🏆 Débloquez tout Equishow', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
          SizedBox(height: 8),
          _BannerItem('Transport mutualisé & paiement sécurisé'),
          _BannerItem('Résultats live · Coaching on-demand'),
          _BannerItem('Carnet de bord & suivi administratif complet'),
        ],
      ),
    );
  }
}

class _BannerItem extends StatelessWidget {
  const _BannerItem(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 4),
    child: Row(
      children: [
        const Icon(Icons.check_circle_rounded, size: 14, color: Colors.white70),
        const SizedBox(width: 6),
        Text(text, style: const TextStyle(fontSize: 12.5, color: Colors.white, fontWeight: FontWeight.w500)),
      ],
    ),
  );
}

// ── Role tabs ──────────────────────────────────────────────────────────────────

class _RoleTabs extends StatelessWidget {
  const _RoleTabs({required this.selected, required this.onSelect});
  final UserRole selected;
  final ValueChanged<UserRole> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.backgroundSecondary,
        borderRadius: BorderRadius.circular(AppTheme.radiusMD),
      ),
      child: Row(
        children: UserRole.values.map((r) {
          final isActive = r == selected;
          return Expanded(
            child: Semantics(
              label: r.label,
              button: true,
              selected: isActive,
              child: GestureDetector(
                onTap: () => onSelect(r),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  decoration: BoxDecoration(
                    color: isActive ? AppColors.surface : Colors.transparent,
                    borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                    boxShadow: isActive ? AppTheme.shadowCard : null,
                  ),
                  child: Center(
                    child: Text(
                      r.label,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: isActive ? AppColors.primary : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ── Plan card ──────────────────────────────────────────────────────────────────

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.plan, required this.isActif, required this.onSelect});
  final PlanAbonnement plan;
  final bool isActif;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXL),
        border: Border.all(
          color: isActif ? AppColors.primary : plan.isPopulaire ? AppColors.primaryBorder : AppColors.border,
          width: isActif || plan.isPopulaire ? 2 : 1,
        ),
        boxShadow: plan.isPopulaire ? AppTheme.shadowCard : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ────────────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
            decoration: BoxDecoration(
              color: plan.isPopulaire ? AppColors.primaryLight : Colors.transparent,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXL - 1)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(plan.nom, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                              if (plan.isPopulaire) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                                  ),
                                  child: const Text('⭐ Recommandé', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white)),
                                ),
                              ],
                              if (isActif) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.successBg,
                                    borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                                    border: Border.all(color: AppColors.successBorder),
                                  ),
                                  child: const Text('Actif', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.success)),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(plan.description, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                    // Prix
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (plan.prixBarre != null)
                          Text(
                            '${plan.prixBarre!.toStringAsFixed(2)}€',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textTertiary,
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              plan.isGratuit ? 'Gratuit' : '${plan.prix % 1 == 0 ? plan.prix.toInt() : plan.prix}€',
                              style: TextStyle(
                                fontSize: plan.isGratuit ? 18 : 24,
                                fontWeight: FontWeight.w900,
                                color: plan.isPopulaire ? AppColors.primary : AppColors.textPrimary,
                              ),
                            ),
                            if (!plan.isGratuit)
                              Text(plan.periode, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
                          ],
                        ),
                        if (plan.badge != null)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.gold,
                              borderRadius: BorderRadius.circular(AppTheme.radiusXS),
                            ),
                            child: Text(plan.badge!, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white)),
                          ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),

          // ── Avantages ─────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ...plan.avantages.map((a) => Padding(
                  padding: const EdgeInsets.only(bottom: 7),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_rounded, size: 16, color: AppColors.primary),
                      const SizedBox(width: 8),
                      Expanded(child: Text(a, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary, fontWeight: FontWeight.w500))),
                    ],
                  ),
                )),
                const SizedBox(height: 14),

                // ── CTA ────────────────────────────────────
                if (!isActif && !plan.isGratuit)
                  Semantics(
                    label: 'Choisir le plan ${plan.nom} à ${plan.prix}€${plan.periode}',
                    button: true,
                    child: SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: ElevatedButton(
                        onPressed: onSelect,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: plan.isPopulaire ? AppColors.primary : AppColors.surface,
                          foregroundColor: plan.isPopulaire ? Colors.white : AppColors.textPrimary,
                          side: plan.isPopulaire ? null : const BorderSide(color: AppColors.borderMedium),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radiusMD)),
                          elevation: 0,
                        ),
                        child: Text(
                          plan.periode == '/concours' ? 'Acheter' : 'Choisir ce plan',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  )
                else if (isActif)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.successBg,
                      borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                    ),
                    child: const Center(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check_rounded, size: 16, color: AppColors.success),
                          SizedBox(width: 6),
                          Text('Plan actuel', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.success)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Garantie ───────────────────────────────────────────────────────────────────

class _GarantieRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMD),
        border: Border.all(color: AppColors.border),
      ),
      child: const Row(
        children: [
          Icon(Icons.shield_outlined, size: 18, color: AppColors.success),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Paiement 100% sécurisé par Stripe · Annulation à tout moment · Remboursement sous 14 jours',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
