import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// En-tête de section avec titre + action optionnelle
class EQSectionHeader extends StatelessWidget {
  const EQSectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
    this.trailing,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
        ),
        if (trailing != null) trailing!,
        if (actionLabel != null && onAction != null)
          Semantics(
            label: actionLabel,
            button: true,
            child: GestureDetector(
              onTap: onAction,
              child: Text(
                actionLabel!,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.primary),
              ),
            ),
          ),
      ],
    );
  }
}

/// Séparateur de section
class EQDivider extends StatelessWidget {
  const EQDivider({super.key, this.label});
  final String? label;

  @override
  Widget build(BuildContext context) {
    if (label == null) return const Divider(color: AppColors.border, height: 1);
    return Row(
      children: [
        const Expanded(child: Divider(color: AppColors.border)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            label!.toUpperCase(),
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textTertiary, letterSpacing: 0.8),
          ),
        ),
        const Expanded(child: Divider(color: AppColors.border)),
      ],
    );
  }
}
