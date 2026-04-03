import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Badge générique Equishow
class EQBadge extends StatelessWidget {
  const EQBadge({
    super.key,
    required this.label,
    required this.color,
    required this.backgroundColor,
    this.borderColor,
    this.fontSize = 11,
    this.fontWeight = FontWeight.w700,
  });

  final String label;
  final Color color;
  final Color backgroundColor;
  final Color? borderColor;
  final double fontSize;
  final FontWeight fontWeight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppTheme.radiusSM),
        border: borderColor != null ? Border.all(color: borderColor!) : null,
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: fontSize, fontWeight: fontWeight, color: color),
      ),
    );
  }
}

/// Badge discipline équestre
class DisciplineBadge extends StatelessWidget {
  const DisciplineBadge({super.key, required this.discipline});
  final Discipline discipline;

  @override
  Widget build(BuildContext context) {
    return EQBadge(
      label: discipline.label,
      color: discipline.color,
      backgroundColor: discipline.color.withOpacity(0.12),
    );
  }
}

/// Badge statut transport
class TransportStatusBadge extends StatelessWidget {
  const TransportStatusBadge({super.key, required this.status});
  final TransportStatus status;

  @override
  Widget build(BuildContext context) {
    return EQBadge(
      label: status.label,
      color: status.color,
      backgroundColor: status.bgColor,
    );
  }
}

enum Discipline {
  cso('CSO', AppColors.cso),
  dressage('Dressage', AppColors.dressage),
  cce('CCE', AppColors.cce),
  hunter('Hunter', AppColors.hunter),
  equifun('Equifun', AppColors.equifun);

  const Discipline(this.label, this.color);
  final String label;
  final Color color;
}

enum TransportStatus {
  ouvert('Places dispo', AppColors.transportOpen, AppColors.transportOpenBg),
  complet('Complet', AppColors.transportFull, AppColors.transportFullBg),
  cloture('Clôturé', AppColors.transportClosed, AppColors.transportClosedBg);

  const TransportStatus(this.label, this.color, this.bgColor);
  final String label;
  final Color color;
  final Color bgColor;
}
