import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

enum EQButtonVariant { primary, secondary, ghost, danger }

/// Bouton tactile Equishow — min-height 44px garanti
class EQButton extends StatelessWidget {
  const EQButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.variant = EQButtonVariant.primary,
    this.isLoading = false,
    this.fullWidth = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final EQButtonVariant variant;
  final bool isLoading;
  final bool fullWidth;

  static EQButton primary({required String label, required VoidCallback? onPressed, IconData? icon, bool isLoading = false, bool fullWidth = false}) =>
      EQButton(label: label, onPressed: onPressed, icon: icon, isLoading: isLoading, fullWidth: fullWidth);

  static EQButton secondary({required String label, required VoidCallback? onPressed, IconData? icon, bool isLoading = false, bool fullWidth = false}) =>
      EQButton(label: label, onPressed: onPressed, icon: icon, isLoading: isLoading, fullWidth: fullWidth, variant: EQButtonVariant.secondary);

  static EQButton ghost({required String label, required VoidCallback? onPressed, IconData? icon}) =>
      EQButton(label: label, onPressed: onPressed, icon: icon, variant: EQButtonVariant.ghost);

  @override
  Widget build(BuildContext context) {
    final style = _styleFor(variant);

    Widget content = isLoading
        ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: style.fgColor))
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[Icon(icon, size: 16, color: style.fgColor, semanticLabel: ''), const SizedBox(width: 6)],
              Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: style.fgColor)),
            ],
          );

    if (style.gradient != null) {
      return Semantics(
        label: label,
        button: true,
        enabled: onPressed != null,
        child: Container(
        constraints: const BoxConstraints(minHeight: AppTheme.touchMin),
        width: fullWidth ? double.infinity : null,
        decoration: BoxDecoration(
          gradient: style.gradient,
          borderRadius: BorderRadius.circular(AppTheme.radiusMD),
          boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 3))],
        ),
        child: Material(
          color: Colors.transparent,
          clipBehavior: Clip.antiAlias,
          borderRadius: BorderRadius.circular(AppTheme.radiusMD),
          child: InkWell(
            onTap: onPressed,
            splashColor: Colors.white.withOpacity(0.15),
            excludeFromSemantics: true,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Center(child: content),
            ),
          ),
        ),
      ),
      );
    }

    return Semantics(
      label: label,
      button: true,
      enabled: onPressed != null,
      child: Container(
        constraints: const BoxConstraints(minHeight: AppTheme.touchMin),
        width: fullWidth ? double.infinity : null,
        child: Material(
          color: style.bgColor,
          borderRadius: BorderRadius.circular(AppTheme.radiusMD),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onPressed,
            excludeFromSemantics: true,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppTheme.radiusMD),
                border: style.border,
              ),
              child: Center(child: content),
            ),
          ),
        ),
      ),
    );
  }

  _EQButtonStyle _styleFor(EQButtonVariant v) => switch (v) {
    EQButtonVariant.primary => _EQButtonStyle(
        gradient: const LinearGradient(colors: [AppColors.primary, AppColors.primaryDark]),
        bgColor: AppColors.primary,
        fgColor: Colors.white,
      ),
    EQButtonVariant.secondary => _EQButtonStyle(
        bgColor: AppColors.surface,
        fgColor: AppColors.textPrimary,
        border: Border.all(color: AppColors.borderMedium),
      ),
    EQButtonVariant.ghost => _EQButtonStyle(
        bgColor: Colors.transparent,
        fgColor: AppColors.textSecondary,
      ),
    EQButtonVariant.danger => _EQButtonStyle(
        bgColor: AppColors.urgentBg,
        fgColor: AppColors.urgent,
        border: Border.all(color: AppColors.urgentBorder),
      ),
  };
}

class _EQButtonStyle {
  const _EQButtonStyle({required this.bgColor, required this.fgColor, this.gradient, this.border});
  final Color bgColor;
  final Color fgColor;
  final Gradient? gradient;
  final BoxBorder? border;
}
