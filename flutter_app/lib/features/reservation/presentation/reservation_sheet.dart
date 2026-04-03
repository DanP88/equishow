import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/reservation.dart';
import '../../messagerie/domain/conversation.dart';
import '../../messagerie/providers/messagerie_provider.dart';
import '../../paiement/presentation/paiement_sheet.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/eq_states.dart';
import '../../../core/widgets/eq_button.dart';

/// Bottom sheet de réservation — Transport / Box / Coach
class ReservationSheet extends ConsumerStatefulWidget {
  const ReservationSheet._({
    required this.type,
    required this.titre,
    required this.sousTitre,
    required this.montant,
    required this.details,
    this.createurNom,
  });

  final ReservationType type;
  final String titre;
  final String sousTitre;
  final double montant;
  final List<_Detail> details;
  final String? createurNom;

  static Future<void> showTransport(
    BuildContext context, {
    required String concoursNom,
    required String createurNom,
    required String departVille,
    required String heureDepart,
    required double prixParCheval,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ReservationSheet._(
        type: ReservationType.transport,
        titre: 'Réserver une place',
        sousTitre: concoursNom,
        montant: prixParCheval,
        createurNom: createurNom,
        details: [
          _Detail(Icons.emoji_events_outlined, 'Concours', concoursNom),
          _Detail(Icons.person_outline_rounded, 'Propriétaire transport', createurNom),
          _Detail(Icons.location_on_outlined, 'Départ', departVille),
          _Detail(Icons.schedule_rounded, 'Heure départ', heureDepart),
          _Detail(Icons.euro_rounded, 'Prix', '$prixParCheval€ / cheval'),
          _Detail(Icons.info_outline_rounded, 'Commission', '9% incluse — paiement sécurisé'),
        ],
      ),
    );
  }

  static Future<void> showBox(
    BuildContext context, {
    required String concoursNom,
    required String lieuNom,
    required String dateStr,
    required double prixNuit,
    required int nbNuits,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ReservationSheet._(
        type: ReservationType.box,
        titre: 'Réserver un box',
        sousTitre: concoursNom,
        montant: prixNuit * nbNuits,
        details: [
          _Detail(Icons.place_outlined, 'Lieu', lieuNom),
          _Detail(Icons.calendar_today_rounded, 'Dates', dateStr),
          _Detail(Icons.euro_rounded, 'Prix', '${prixNuit.toInt()}€/nuit × $nbNuits nuit${nbNuits > 1 ? 's' : ''}'),
          _Detail(Icons.check_circle_outline_rounded, 'Inclus', 'Litière, eau, électricité'),
          _Detail(Icons.info_outline_rounded, 'Commission', '9% incluse — paiement sécurisé'),
        ],
      ),
    );
  }

  static Future<void> showCoach(
    BuildContext context, {
    required String coachNom,
    required String specialite,
    required String dateStr,
    required String duree,
    required double tarif,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ReservationSheet._(
        type: ReservationType.coach,
        titre: 'Réserver une session',
        sousTitre: coachNom,
        montant: tarif,
        createurNom: coachNom,
        details: [
          _Detail(Icons.person_outline_rounded, 'Coach', coachNom),
          _Detail(Icons.sports_score_rounded, 'Spécialité', specialite),
          _Detail(Icons.calendar_today_rounded, 'Date', dateStr),
          _Detail(Icons.timer_outlined, 'Durée', duree),
          _Detail(Icons.euro_rounded, 'Tarif', '${tarif.toInt()}€'),
        ],
      ),
    );
  }

  @override
  ConsumerState<ReservationSheet> createState() => _ReservationSheetState();
}

class _ReservationSheetState extends ConsumerState<ReservationSheet> {
  int _nbChevaux = 1;

  double get _total => widget.montant * _nbChevaux;
  double get _commission => widget.type != ReservationType.coach ? _total * 0.09 : 0;

  @override
  Widget build(BuildContext context) {
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
            // ── Handle ────────────────────────────────────
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 12, bottom: 20),
                width: 36, height: 4,
                decoration: BoxDecoration(color: AppColors.borderMedium, borderRadius: BorderRadius.circular(2)),
              ),
            ),

            // ── Header ────────────────────────────────────
            Row(
              children: [
                Container(
                  width: 46, height: 46,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(child: Text(widget.type.emoji, style: const TextStyle(fontSize: 22))),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.titre, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                      Text(widget.sousTitre, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // ── Détails ───────────────────────────────────
            Container(
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: widget.details.asMap().entries.map((e) {
                  final isLast = e.key == widget.details.length - 1;
                  return _DetailRow(detail: e.value, isLast: isLast);
                }).toList(),
              ),
            ),
            const SizedBox(height: 16),

            // ── Nombre de chevaux (transport/box uniquement) ──
            if (widget.type != ReservationType.coach) ...[
              Row(
                children: [
                  const Expanded(
                    child: Text('Nombre de chevaux', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                  ),
                  _NbSelector(
                    value: _nbChevaux,
                    onDecrement: _nbChevaux > 1 ? () => setState(() => _nbChevaux--) : null,
                    onIncrement: _nbChevaux < 4 ? () => setState(() => _nbChevaux++) : null,
                  ),
                ],
              ),
              const SizedBox(height: 16),
            ],

            // ── Récapitulatif prix ────────────────────────
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                border: Border.all(color: AppColors.primaryBorder),
              ),
              child: Column(
                children: [
                  if (_nbChevaux > 1) ...[
                    _PriceRow('${widget.montant.toInt()}€ × $_nbChevaux chevaux', _total),
                  ],
                  if (_commission > 0)
                    _PriceRow('Commission plateforme (9%)', _commission, isSmall: true),
                  const Divider(color: AppColors.primaryBorder, height: 16),
                  _PriceRow('Total', _total, isBold: true),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ── Boutons ───────────────────────────────────
            Row(
              children: [
                Expanded(
                  child: EQButton.secondary(
                    label: 'Message',
                    onPressed: () {
                      Navigator.of(context).pop();
                      ref.read(messagerieProvider.notifier).createConversation(
                        titre: '${widget.type.label} · ${widget.sousTitre}',
                        sousTitre: widget.createurNom ?? widget.sousTitre,
                        type: _convType(),
                        premierMessage: 'Bonjour, je souhaite en savoir plus sur cette annonce.',
                      );
                      EQSnackbar.show(context, message: 'Conversation créée dans Messages');
                    },
                    icon: Icons.chat_bubble_outline_rounded,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: EQButton(
                    label: 'Payer $_total€',
                    onPressed: () {
                      Navigator.of(context).pop();
                      PaiementSheet.show(
                        context,
                        titre: widget.titre,
                        montant: _total,
                        description: '${widget.type.label} — ${widget.sousTitre}',
                        isConnect: widget.type != ReservationType.coach,
                        createurNom: widget.createurNom,
                        commission: _commission,
                        onSuccess: () {
                          EQSnackbar.show(context, message: 'Réservation confirmée ! Un message a été envoyé.');
                          ref.read(messagerieProvider.notifier).createConversation(
                            titre: '${widget.type.label} · ${widget.sousTitre}',
                            sousTitre: widget.createurNom ?? widget.sousTitre,
                            type: _convType(),
                            premierMessage: 'Bonjour ! Votre réservation est confirmée. Merci !',
                          );
                        },
                      );
                    },
                    icon: Icons.lock_rounded,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  ConversationType _convType() => switch (widget.type) {
    ReservationType.transport => ConversationType.transport,
    ReservationType.box       => ConversationType.box,
    ReservationType.coach     => ConversationType.coach,
  };
}

// ── Widgets helpers ────────────────────────────────────────────────────────────

class _Detail {
  const _Detail(this.icon, this.label, this.value);
  final IconData icon;
  final String label;
  final String value;
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.detail, required this.isLast});
  final _Detail detail;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              Icon(detail.icon, size: 15, color: AppColors.textTertiary),
              const SizedBox(width: 10),
              Text(detail.label, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
              const Spacer(),
              Text(detail.value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
            ],
          ),
        ),
        if (!isLast) const Divider(height: 1, color: AppColors.border, indent: 14, endIndent: 14),
      ],
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow(this.label, this.montant, {this.isSmall = false, this.isBold = false});
  final String label;
  final double montant;
  final bool isSmall;
  final bool isBold;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(label, style: TextStyle(fontSize: isSmall ? 12 : 13.5, color: isSmall ? AppColors.textSecondary : AppColors.textPrimary, fontWeight: isBold ? FontWeight.w800 : FontWeight.w500)),
        const Spacer(),
        Text(
          '${montant % 1 == 0 ? montant.toInt() : montant.toStringAsFixed(2)}€',
          style: TextStyle(fontSize: isBold ? 18 : 13.5, fontWeight: isBold ? FontWeight.w900 : FontWeight.w600, color: isBold ? AppColors.primary : AppColors.textPrimary),
        ),
      ],
    );
  }
}

class _NbSelector extends StatelessWidget {
  const _NbSelector({required this.value, required this.onDecrement, required this.onIncrement});
  final int value;
  final VoidCallback? onDecrement;
  final VoidCallback? onIncrement;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Semantics(
          label: 'Diminuer',
          button: true,
          child: GestureDetector(
            onTap: onDecrement,
            child: Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: onDecrement != null ? AppColors.primaryLight : AppColors.background,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: onDecrement != null ? AppColors.primaryBorder : AppColors.border),
              ),
              child: Icon(Icons.remove_rounded, size: 16, color: onDecrement != null ? AppColors.primary : AppColors.textTertiary),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Text('$value', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
        ),
        Semantics(
          label: 'Augmenter',
          button: true,
          child: GestureDetector(
            onTap: onIncrement,
            child: Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: onIncrement != null ? AppColors.primaryLight : AppColors.background,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: onIncrement != null ? AppColors.primaryBorder : AppColors.border),
              ),
              child: Icon(Icons.add_rounded, size: 16, color: onIncrement != null ? AppColors.primary : AppColors.textTertiary),
            ),
          ),
        ),
      ],
    );
  }
}
