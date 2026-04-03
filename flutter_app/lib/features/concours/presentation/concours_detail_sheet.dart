import 'package:flutter/material.dart';
import '../domain/concours.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/eq_badge.dart';
import '../../../core/widgets/eq_button.dart';
import '../../../core/widgets/eq_states.dart';

/// Bottom sheet détail d'un concours
class ConcoursDetailSheet extends StatelessWidget {
  const ConcoursDetailSheet._({required this.concours});
  final Concours concours;

  static Future<void> show(BuildContext context, {required Concours concours}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ConcoursDetailSheet._(concours: concours),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = concours;
    final dateStr = _formatDate(c.dateDebut, c.dateFin);

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXXL)),
      ),
      padding: EdgeInsets.fromLTRB(24, 0, 24, MediaQuery.of(context).padding.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 20),
                width: 36, height: 4,
                decoration: BoxDecoration(color: AppColors.borderMedium, borderRadius: BorderRadius.circular(2)),
              ),
            ),

            // Disciplines + département
            Row(
              children: [
                ...c.disciplines.map((d) => Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: DisciplineBadge(discipline: d),
                )),
                const Spacer(),
                Text(c.departement, style: const TextStyle(fontSize: 12, color: AppColors.textTertiary, fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 10),

            // Nom + lieu
            Text(c.nom, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.textPrimary)),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Expanded(child: Text(c.lieu, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))),
              ],
            ),
            const SizedBox(height: 16),

            // Infos
            Container(
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  _InfoRow(Icons.calendar_today_rounded, 'Date', dateStr),
                  const Divider(height: 1, color: AppColors.border, indent: 14, endIndent: 14),
                  _InfoRow(Icons.people_outline_rounded, 'Engagés', '${c.nbEngages} participants'),
                  const Divider(height: 1, color: AppColors.border, indent: 14, endIndent: 14),
                  _InfoRow(Icons.bar_chart_rounded, 'Niveaux', c.niveaux.join(', ')),
                  const Divider(height: 1, color: AppColors.border, indent: 14, endIndent: 14),
                  _InfoRow(Icons.source_rounded, 'Source', c.sourceApi),
                  if (c.aTransport) ...[
                    const Divider(height: 1, color: AppColors.border, indent: 14, endIndent: 14),
                    _InfoRow(
                      Icons.local_shipping_outlined,
                      'Transport',
                      '${c.nbAnnoncesTransport} annonce${c.nbAnnoncesTransport > 1 ? 's' : ''} disponible${c.nbAnnoncesTransport > 1 ? 's' : ''}',
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),

            EQButton(
              label: 'S\'inscrire via FFECompet',
              icon: Icons.open_in_new_rounded,
              onPressed: () {
                Navigator.of(context).pop();
                EQSnackbar.show(context, message: 'Inscription FFECompet — bientôt disponible');
              },
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime start, DateTime end) {
    const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    if (start.day == end.day && start.month == end.month) {
      return '${start.day} ${months[start.month - 1]} ${start.year}';
    }
    return '${start.day}–${end.day} ${months[start.month - 1]} ${start.year}';
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.icon, this.label, this.value);
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 15, color: AppColors.textTertiary),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}
