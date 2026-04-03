import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/eq_states.dart';
import '../../concours/domain/concours.dart';

/// Écran Agenda — concours inscrits + prochain concours mis en avant
class AgendaScreen extends StatelessWidget {
  const AgendaScreen({super.key});

  // Données mock — concours "inscrits" par le cavalier
  static final _mesConcoursIds = ['1', '3'];
  static final _mesConcours = mockConcours.where((c) => _mesConcoursIds.contains(c.id)).toList()
    ..sort((a, b) => a.dateDebut.compareTo(b.dateDebut));

  @override
  Widget build(BuildContext context) {
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
                    Text('Agenda', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                    Text('Mes concours inscrits', style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w400)),
                  ],
                ),
              ],
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // ── Prochain concours mis en avant
                if (_mesConcours.isNotEmpty) ...[
                  _ProchainConcoursCard(concours: _mesConcours.first),
                  const SizedBox(height: 20),
                  const _AgendaSectionLabel(label: 'À venir'),
                  const SizedBox(height: 10),
                ],

                // ── Liste des autres concours
                if (_mesConcours.length > 1)
                  ..._mesConcours.skip(1).map((c) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _AgendaConcoursRow(concours: c),
                  ))
                else if (_mesConcours.isEmpty)
                  const EQEmptyState(
                    icon: Icons.calendar_today_rounded,
                    title: 'Aucun concours inscrit',
                    subtitle: 'Ajoutez des concours depuis l\'onglet Concours.',
                  ),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Prochain concours — carte mise en avant ────────────────────────────────────

class _ProchainConcoursCard extends StatelessWidget {
  const _ProchainConcoursCard({required this.concours});
  final Concours concours;

  @override
  Widget build(BuildContext context) {
    final joursRestants = concours.dateDebut.difference(DateTime.now()).inDays;

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusXL),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.35),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Label prochain concours
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(AppTheme.radiusSM),
            ),
            child: const Text(
              'PROCHAIN CONCOURS',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.8),
            ),
          ),
          const SizedBox(height: 12),

          Text(
            concours.nom,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white),
          ),
          const SizedBox(height: 4),

          Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 13, color: Colors.white70),
              const SizedBox(width: 3),
              Text(concours.lieu, style: const TextStyle(fontSize: 13, color: Colors.white70)),
            ],
          ),
          const SizedBox(height: 16),

          Row(
            children: [
              // Jours restants
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                ),
                child: Column(
                  children: [
                    Text(
                      '$joursRestants',
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.primary),
                    ),
                    const Text('jours', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.primary)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _formatDate(concours.dateDebut, concours.dateFin),
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${concours.nbEngages} engagés',
                    style: const TextStyle(fontSize: 12, color: Colors.white70),
                  ),
                ],
              ),
              const Spacer(),
              // Transport
              if (concours.aTransport)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                    border: Border.all(color: Colors.white.withOpacity(0.3)),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.directions_car_rounded, size: 16, color: Colors.white),
                      const SizedBox(height: 2),
                      Text(
                        '${concours.nbAnnoncesTransport}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white),
                      ),
                      const Text('transports', style: TextStyle(fontSize: 9, color: Colors.white70)),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime debut, DateTime fin) {
    final mois = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    if (debut.day == fin.day) return '${debut.day} ${mois[debut.month - 1]} ${debut.year}';
    return '${debut.day}–${fin.day} ${mois[debut.month - 1]} ${debut.year}';
  }
}

// ── Section label ──────────────────────────────────────────────────────────────

class _AgendaSectionLabel extends StatelessWidget {
  const _AgendaSectionLabel({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.textTertiary, letterSpacing: 0.8),
    );
  }
}

// ── Agenda concours row ────────────────────────────────────────────────────────

class _AgendaConcoursRow extends StatelessWidget {
  const _AgendaConcoursRow({required this.concours});
  final Concours concours;

  @override
  Widget build(BuildContext context) {
    final mois = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];

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
          label: '${concours.nom}, ${concours.lieu}',
          button: true,
          child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusLG),
          onTap: () {},
          excludeFromSemantics: true,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                // Date block
                Container(
                  width: 44,
                  height: 50,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '${concours.dateDebut.day}',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.primary),
                      ),
                      Text(
                        mois[concours.dateDebut.month - 1],
                        style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.primary, letterSpacing: 0.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        concours.nom,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        concours.lieu,
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (concours.aTransport)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.successBg,
                      borderRadius: BorderRadius.circular(AppTheme.radiusSM),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.directions_car_rounded, size: 11, color: AppColors.success),
                        const SizedBox(width: 3),
                        Text('${concours.nbAnnoncesTransport}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.success)),
                      ],
                    ),
                  ),
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
