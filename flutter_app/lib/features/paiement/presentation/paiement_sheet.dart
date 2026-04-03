import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/stripe_service.dart';
import '../../../core/widgets/eq_states.dart';
import '../../../core/widgets/eq_button.dart';

/// Sheet de paiement Stripe — s'affiche en bottom sheet
///
/// Gère :
/// - Abonnements (cavalier / coach)
/// - Paiement transport (Stripe Connect 9%)
/// - Réservation box
/// - Booking coach
class PaiementSheet extends ConsumerStatefulWidget {
  const PaiementSheet._({
    required this.titre,
    required this.montant,
    required this.description,
    required this.onSuccess,
    this.isConnect = false,
    this.createurNom,
    this.commission = 0,
  });

  final String titre;
  final double montant;
  final String description;
  final VoidCallback onSuccess;
  final bool isConnect;
  final String? createurNom;
  final double commission;

  static Future<void> show(
    BuildContext context, {
    required String titre,
    required double montant,
    required String description,
    required VoidCallback onSuccess,
    bool isConnect = false,
    String? createurNom,
    double commission = 0,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PaiementSheet._(
        titre: titre,
        montant: montant,
        description: description,
        onSuccess: onSuccess,
        isConnect: isConnect,
        createurNom: createurNom,
        commission: commission,
      ),
    );
  }

  @override
  ConsumerState<PaiementSheet> createState() => _PaiementSheetState();
}

class _PaiementSheetState extends ConsumerState<PaiementSheet> {
  bool _isLoading = false;
  bool _success = false;

  // Carte simulée (UI Stripe-like)
  final _cardNumCtrl = TextEditingController(text: '4242 4242 4242 4242');
  final _expiryCtrl  = TextEditingController(text: '12/28');
  final _cvvCtrl     = TextEditingController(text: '123');
  final _nomCtrl     = TextEditingController();

  @override
  void dispose() {
    _cardNumCtrl.dispose();
    _expiryCtrl.dispose();
    _cvvCtrl.dispose();
    _nomCtrl.dispose();
    super.dispose();
  }

  Future<void> _payer() async {
    setState(() => _isLoading = true);

    final success = await StripeService.payer(
      montantEuros: widget.montant,
      description: widget.description,
    );

    if (!mounted) return;

    if (success) {
      setState(() { _isLoading = false; _success = true; });
      await Future.delayed(const Duration(milliseconds: 1200));
      if (mounted) {
        Navigator.of(context).pop();
        widget.onSuccess();
      }
    } else {
      setState(() => _isLoading = false);
      EQSnackbar.show(context, message: 'Paiement refusé. Vérifiez votre carte.', isSuccess: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final commissionStr = widget.commission > 0 ? '(dont ${widget.commission.toStringAsFixed(2)}€ de commission)' : '';

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

            if (_success) ...[
              // ── Succès ────────────────────────────────────
              const SizedBox(height: 20),
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 64, height: 64,
                      decoration: const BoxDecoration(color: AppColors.successBg, shape: BoxShape.circle),
                      child: const Icon(Icons.check_rounded, size: 32, color: AppColors.success),
                    ),
                    const SizedBox(height: 16),
                    const Text('Paiement réussi !', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                    const SizedBox(height: 6),
                    const Text('Votre réservation est confirmée', style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ] else ...[
              // ── Header paiement ───────────────────────────
              Row(
                children: [
                  Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.lock_rounded, size: 18, color: AppColors.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.titre, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                        Text('Paiement sécurisé · Stripe', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${widget.montant % 1 == 0 ? widget.montant.toInt() : widget.montant.toStringAsFixed(2)}€',
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.primary),
                      ),
                      if (commissionStr.isNotEmpty)
                        Text(commissionStr, style: const TextStyle(fontSize: 10, color: AppColors.textTertiary)),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // ── Bénéficiaire (Connect) ────────────────────
              if (widget.isConnect && widget.createurNom != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.person_outline_rounded, size: 16, color: AppColors.textSecondary),
                      const SizedBox(width: 8),
                      Expanded(child: Text('Versé à ${widget.createurNom}', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))),
                      Text(
                        '${(widget.montant - widget.commission).toStringAsFixed(2)}€',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],

              const Divider(color: AppColors.border),
              const SizedBox(height: 16),

              // ── Formulaire carte ──────────────────────────
              const _FieldLabel('Numéro de carte'),
              const SizedBox(height: 6),
              _CardField(
                controller: _cardNumCtrl,
                hint: '1234 5678 9012 3456',
                keyboardType: TextInputType.number,
                prefixIcon: Icons.credit_card_rounded,
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const _FieldLabel('Expiration'),
                        const SizedBox(height: 6),
                        _CardField(controller: _expiryCtrl, hint: 'MM/AA', keyboardType: TextInputType.datetime),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const _FieldLabel('CVC'),
                        const SizedBox(height: 6),
                        _CardField(controller: _cvvCtrl, hint: '123', keyboardType: TextInputType.number, obscure: true),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              const _FieldLabel('Nom sur la carte'),
              const SizedBox(height: 6),
              _CardField(
                controller: _nomCtrl,
                hint: 'Sarah DUPONT',
                textCapitalization: TextCapitalization.characters,
              ),
              const SizedBox(height: 24),

              // ── Bouton payer ──────────────────────────────
              EQButton(
                label: _isLoading ? 'Paiement en cours…' : 'Payer ${widget.montant % 1 == 0 ? widget.montant.toInt() : widget.montant.toStringAsFixed(2)}€',
                onPressed: _isLoading ? null : _payer,
                isLoading: _isLoading,
                fullWidth: true,
              ),
              const SizedBox(height: 12),

              // ── Sécurité ──────────────────────────────────
              const Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.lock_rounded, size: 12, color: AppColors.textTertiary),
                    SizedBox(width: 4),
                    Text('Chiffrement SSL · Stripe PCI-DSS · Aucune donnée stockée', style: TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
  );
}

class _CardField extends StatelessWidget {
  const _CardField({
    required this.controller,
    required this.hint,
    this.keyboardType = TextInputType.text,
    this.prefixIcon,
    this.obscure = false,
    this.textCapitalization = TextCapitalization.none,
  });

  final TextEditingController controller;
  final String hint;
  final TextInputType keyboardType;
  final IconData? prefixIcon;
  final bool obscure;
  final TextCapitalization textCapitalization;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscure,
      textCapitalization: textCapitalization,
      style: const TextStyle(fontSize: 14, letterSpacing: 1),
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: prefixIcon != null ? Icon(prefixIcon, size: 18, color: AppColors.textTertiary) : null,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
