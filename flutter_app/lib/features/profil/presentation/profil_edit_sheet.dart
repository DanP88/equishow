import 'package:flutter/material.dart';
import '../domain/cavalier.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/eq_button.dart';
import '../../../core/widgets/eq_states.dart';

/// Bottom sheet d'édition du profil cavalier
class ProfilEditSheet extends StatefulWidget {
  const ProfilEditSheet._({required this.cavalier});
  final Cavalier cavalier;

  static Future<void> show(BuildContext context, {required Cavalier cavalier}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ProfilEditSheet._(cavalier: cavalier),
    );
  }

  @override
  State<ProfilEditSheet> createState() => _ProfilEditSheetState();
}

class _ProfilEditSheetState extends State<ProfilEditSheet> {
  late final TextEditingController _prenomCtrl;
  late final TextEditingController _nomCtrl;
  late final TextEditingController _licenceCtrl;
  late String _niveau;

  static const _niveaux = [
    'Amateur 1', 'Amateur 2', 'Amateur 3', 'Amateur 4', 'Amateur 5', 'Pro', 'Grand Prix',
  ];

  @override
  void initState() {
    super.initState();
    _prenomCtrl = TextEditingController(text: widget.cavalier.prenom);
    _nomCtrl    = TextEditingController(text: widget.cavalier.nom);
    _licenceCtrl = TextEditingController(text: widget.cavalier.licenseFfe);
    _niveau     = widget.cavalier.niveau;
  }

  @override
  void dispose() {
    _prenomCtrl.dispose();
    _nomCtrl.dispose();
    _licenceCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
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
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 20),
                  width: 36, height: 4,
                  decoration: BoxDecoration(color: AppColors.borderMedium, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const Text('Modifier le profil', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
              const SizedBox(height: 20),

              _Field(label: 'Prénom', controller: _prenomCtrl),
              const SizedBox(height: 12),
              _Field(label: 'Nom', controller: _nomCtrl),
              const SizedBox(height: 12),
              _Field(label: 'Licence FFE', controller: _licenceCtrl, keyboardType: TextInputType.number),
              const SizedBox(height: 12),

              // Niveau
              const Text('Niveau', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
              const SizedBox(height: 6),
              Container(
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                  border: Border.all(color: AppColors.border),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _niveau,
                    isExpanded: true,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    items: _niveaux.map((n) => DropdownMenuItem(value: n, child: Text(n))).toList(),
                    onChanged: (v) { if (v != null) setState(() => _niveau = v); },
                  ),
                ),
              ),
              const SizedBox(height: 24),

              EQButton(
                label: 'Enregistrer',
                icon: Icons.check_rounded,
                onPressed: () {
                  Navigator.of(context).pop();
                  EQSnackbar.show(context, message: 'Profil mis à jour');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.controller, this.keyboardType});
  final String label;
  final TextEditingController controller;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.background,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppTheme.radiusMD),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppTheme.radiusMD),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppTheme.radiusMD),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}
