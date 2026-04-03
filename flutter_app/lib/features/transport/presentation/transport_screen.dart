import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/annonce_transport.dart';
import '../providers/transport_provider.dart';
import '../../reservation/presentation/reservation_sheet.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/eq_states.dart';
import '../../../core/widgets/eq_button.dart';

/// Écran Transport — annonces de co-voiturage par concours
class TransportScreen extends ConsumerWidget {
  const TransportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(transportProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // ── App Bar ──────────────────────────────────────
          SliverAppBar(
            floating: true,
            snap: true,
            pinned: false,
            backgroundColor: AppColors.background,
            elevation: 0,
            automaticallyImplyLeading: false,
            toolbarHeight: 64,
            title: const Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Transport', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                    Text('Co-voiturage entre cavaliers', style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w400)),
                  ],
                ),
              ],
            ),
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(44),
              child: _FilterTabs(),
            ),
          ),

          // ── Bannière info commission ──────────────────────
          SliverToBoxAdapter(
            child: _CommissionBanner(),
          ),

          // ── List ─────────────────────────────────────────
          if (state.isLoading)
            const SliverPadding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 100),
              sliver: SliverToBoxAdapter(child: EQLoadingList()),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
              sliver: _AnnoncesList(),
            ),
        ],
      ),

      // ── FAB : créer une annonce ───────────────────────────
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => EQSnackbar.show(context, message: 'Créer une annonce — bientôt disponible', isSuccess: false),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Proposer', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        elevation: 0,
      ),
    );
  }
}

// ── Commission banner ──────────────────────────────────────────────────────────

class _CommissionBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(AppTheme.radiusMD),
        border: Border.all(color: AppColors.primaryBorder),
      ),
      child: const Row(
        children: [
          Icon(Icons.shield_outlined, size: 16, color: AppColors.primary),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Paiement sécurisé · 9% de commission · Évaluations mutuelles',
              style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Filter tabs ────────────────────────────────────────────────────────────────

class _FilterTabs extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(transportProvider);
    final notifier = ref.read(transportProvider.notifier);

    return Container(
      height: 44,
      decoration: const BoxDecoration(
        color: AppColors.background,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: TransportFilter.values.length,
        itemBuilder: (_, i) {
          final f = TransportFilter.values[i];
          final isActive = state.filter == f;
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: Semantics(
              label: f.label,
              button: true,
              selected: isActive,
              child: GestureDetector(
                onTap: () => notifier.setFilter(f),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  height: 32,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  margin: const EdgeInsets.only(bottom: 8, top: 4),
                  decoration: BoxDecoration(
                    color: isActive ? AppColors.primary : AppColors.surface,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                    border: Border.all(color: isActive ? AppColors.primary : AppColors.borderMedium),
                  ),
                  child: Center(
                    child: Text(
                      f.label,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: isActive ? Colors.white : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Annonces list ──────────────────────────────────────────────────────────────

class _AnnoncesList extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final annonces = ref.watch(filteredAnnoncesProvider);

    if (annonces.isEmpty) {
      return const SliverToBoxAdapter(
        child: EQEmptyState(
          icon: Icons.directions_car_rounded,
          title: 'Aucune annonce',
          subtitle: 'Soyez le premier à proposer un transport pour votre prochain concours.',
        ),
      );
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final annonce = annonces[index];
          return Padding(
            padding: EdgeInsets.only(bottom: index < annonces.length - 1 ? 10 : 0),
            child: _AnnonceCard(annonce: annonce),
          );
        },
        childCount: annonces.length,
      ),
    );
  }
}

// ── Annonce card ───────────────────────────────────────────────────────────────

class _AnnonceCard extends StatelessWidget {
  const _AnnonceCard({required this.annonce});
  final AnnonceTransport annonce;

  @override
  Widget build(BuildContext context) {
    final isDisponible = annonce.status == AnnonceStatus.ouvert && annonce.placesDisponibles > 0;
    final statusColor = isDisponible ? AppColors.transportOpen : AppColors.transportFull;
    final statusBg    = isDisponible ? AppColors.transportOpenBg : AppColors.transportFullBg;
    final statusLabel = isDisponible
        ? '${annonce.placesDisponibles} place${annonce.placesDisponibles > 1 ? 's' : ''} dispo'
        : 'Complet';

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusLG),
        border: Border.all(color: AppColors.border),
        boxShadow: AppTheme.shadowCard,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(AppTheme.radiusLG),
        child: Semantics(
          label: 'Transport pour ${annonce.concoursNom}, proposé par ${annonce.createurPrenom} ${annonce.createurNom}, départ ${annonce.lieuDepartVille}, ${annonce.prixParCheval.toInt()}€ par cheval',
          button: true,
          child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusLG),
          onTap: () {},
          excludeFromSemantics: true,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header : créateur + statut
                Row(
                  children: [
                    // Avatar initiales
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Center(
                        child: Text(
                          annonce.createurInitiales,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.primary),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${annonce.createurPrenom} ${annonce.createurNom[0]}.',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                          ),
                          Row(
                            children: [
                              const Icon(Icons.star_rounded, size: 12, color: AppColors.gold),
                              const SizedBox(width: 2),
                              Text(
                                annonce.createurNote.toStringAsFixed(1),
                                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // Statut badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                      ),
                      child: Text(statusLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: statusColor)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // ── Concours
                Text(
                  annonce.concoursNom,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),

                // ── Infos trajet
                Row(
                  children: [
                    _InfoChip(icon: Icons.location_on_outlined, label: '${annonce.lieuDepartVille} (${annonce.lieuDepartDept})'),
                    const SizedBox(width: 8),
                    _InfoChip(icon: Icons.schedule_rounded, label: annonce.heureDepart),
                    const SizedBox(width: 8),
                    _InfoChip(icon: Icons.directions_car_rounded, label: '${annonce.placesCheval} pl. cheval'),
                  ],
                ),

                if (annonce.commentaire != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    annonce.commentaire!,
                    style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary, fontStyle: FontStyle.italic),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],

                const SizedBox(height: 12),

                // ── Footer : prix + boutons
                Row(
                  children: [
                    Text(
                      '${annonce.prixParCheval.toInt()}€/cheval',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                    ),
                    const Spacer(),
                    EQButton.secondary(
                      label: 'Contacter',
                      onPressed: () => ReservationSheet.showTransport(
                        context,
                        concoursNom: annonce.concoursNom,
                        createurNom: '${annonce.createurPrenom} ${annonce.createurNom[0]}.',
                        departVille: annonce.lieuDepartVille,
                        heureDepart: annonce.heureDepart,
                        prixParCheval: annonce.prixParCheval,
                      ),
                      icon: Icons.chat_bubble_outline_rounded,
                    ),
                    const SizedBox(width: 8),
                    if (isDisponible)
                      EQButton.primary(
                        label: 'Réserver',
                        onPressed: () => ReservationSheet.showTransport(
                          context,
                          concoursNom: annonce.concoursNom,
                          createurNom: '${annonce.createurPrenom} ${annonce.createurNom[0]}.',
                          departVille: annonce.lieuDepartVille,
                          heureDepart: annonce.heureDepart,
                          prixParCheval: annonce.prixParCheval,
                        ),
                        icon: Icons.arrow_forward_rounded,
                      ),
                  ],
                ),
              ],
            ),
          ),
          ),
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppTheme.radiusSM),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: AppColors.textTertiary),
          const SizedBox(width: 3),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
