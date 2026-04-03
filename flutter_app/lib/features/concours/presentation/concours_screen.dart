import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/concours.dart';
import '../providers/concours_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/eq_badge.dart';
import '../../../core/widgets/eq_states.dart';

/// Écran Concours — liste filtrée par discipline / date / transport
class ConcoursScreen extends ConsumerWidget {
  const ConcoursScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(concoursProvider);

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
                    Text('Concours', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                    Text('Calendrier & résultats', style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w400)),
                  ],
                ),
              ],
            ),
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(44),
              child: _FilterTabs(),
            ),
          ),

          // ── Search bar ───────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: _SearchBar(),
            ),
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
              sliver: _ConcoursList(),
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
    final state = ref.watch(concoursProvider);
    final notifier = ref.read(concoursProvider.notifier);

    return Container(
      height: 44,
      decoration: const BoxDecoration(
        color: AppColors.background,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: ConcoursFilter.values.length,
        itemBuilder: (_, i) {
          final f = ConcoursFilter.values[i];
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

// ── Search bar ─────────────────────────────────────────────────────────────────

class _SearchBar extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(concoursProvider.notifier);
    return TextField(
      onChanged: notifier.setSearch,
      decoration: InputDecoration(
        hintText: 'Rechercher un concours, un lieu…',
        prefixIcon: const Icon(Icons.search_rounded, size: 20, color: AppColors.textTertiary),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMD),
          borderSide: const BorderSide(color: AppColors.borderMedium),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMD),
          borderSide: const BorderSide(color: AppColors.borderMedium),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMD),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        fillColor: AppColors.surface,
        filled: true,
      ),
    );
  }
}

// ── Concours list ──────────────────────────────────────────────────────────────

class _ConcoursList extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(filteredConcoursProvider);

    if (list.isEmpty) {
      return const SliverToBoxAdapter(
        child: EQEmptyState(
          icon: Icons.emoji_events_rounded,
          title: 'Aucun concours trouvé',
          subtitle: 'Modifiez les filtres ou revenez plus tard.',
        ),
      );
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final c = list[index];
          return Padding(
            padding: EdgeInsets.only(bottom: index < list.length - 1 ? 10 : 0),
            child: _ConcoursCard(concours: c),
          );
        },
        childCount: list.length,
      ),
    );
  }
}

// ── Concours card ──────────────────────────────────────────────────────────────

class _ConcoursCard extends StatelessWidget {
  const _ConcoursCard({required this.concours});
  final Concours concours;

  @override
  Widget build(BuildContext context) {
    final dateStr = _formatDate(concours.dateDebut, concours.dateFin);

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
          label: '${concours.nom}, ${concours.lieu}, ${concours.departement}',
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
                // ── Header : nom + disciplines
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        concours.nom,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ...concours.disciplines.map((d) => Padding(
                      padding: const EdgeInsets.only(left: 4),
                      child: DisciplineBadge(discipline: d),
                    )),
                  ],
                ),
                const SizedBox(height: 6),

                // ── Lieu
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 13, color: AppColors.textTertiary),
                    const SizedBox(width: 3),
                    Expanded(
                      child: Text(
                        concours.lieu,
                        style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      concours.departement,
                      style: const TextStyle(fontSize: 11, color: AppColors.textTertiary, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // ── Footer : date + niveaux + transport
                Row(
                  children: [
                    // Date
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.calendar_today_rounded, size: 11, color: AppColors.primary),
                          const SizedBox(width: 4),
                          Text(dateStr, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Niveaux (premier seulement + ...)
                    Expanded(
                      child: Text(
                        concours.niveaux.join(' · '),
                        style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    // Transport badge
                    if (concours.aTransport) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.successBg,
                          borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                          border: Border.all(color: AppColors.successBorder),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.directions_car_rounded, size: 11, color: AppColors.success),
                            const SizedBox(width: 3),
                            Text(
                              '${concours.nbAnnoncesTransport}',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.success),
                            ),
                          ],
                        ),
                      ),
                    ],
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

  String _formatDate(DateTime debut, DateTime fin) {
    final mois = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    if (debut.day == fin.day && debut.month == fin.month) {
      return '${debut.day} ${mois[debut.month - 1]}';
    }
    if (debut.month == fin.month) {
      return '${debut.day}–${fin.day} ${mois[debut.month - 1]}';
    }
    return '${debut.day} ${mois[debut.month - 1]} – ${fin.day} ${mois[fin.month - 1]}';
  }
}
