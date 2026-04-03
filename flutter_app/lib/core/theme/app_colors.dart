import 'package:flutter/material.dart';

/// Equishow — Design System : Couleurs
///
/// Hiérarchie :
///   primary    → orange #F97316  (CTA, actif, accent principal — identique à Equistra)
///   gold       → #C9A84C        (accent premium / podium)
///   surface    → white / #F8F7F4 (fond app, chaud et neutre)
///   onSurface  → #111827        (texte principal)
abstract final class AppColors {
  // ── Brand ──────────────────────────────────────────────────
  static const primary        = Color(0xFFF97316);
  static const primaryDark    = Color(0xFFEA580C);
  static const primaryLight   = Color(0xFFFFF7ED);
  static const primaryBorder  = Color(0xFFFED7AA);

  // ── Gold (podium / premium) ─────────────────────────────────
  static const gold           = Color(0xFFC9A84C);
  static const goldBg         = Color(0xFFFDF8EC);
  static const goldBorder     = Color(0xFFE8D08A);

  // ── Surface & background ───────────────────────────────────
  static const background          = Color(0xFFF8F7F4);
  static const surface             = Color(0xFFFFFFFF);
  static const surfaceVariant      = Color(0xFFF5F4F0);
  static const backgroundSecondary = Color(0xFFF0EFEA);
  static const border              = Color(0xFFEEEDEA);
  static const borderMedium        = Color(0xFFE2E0DB);

  // ── Text ───────────────────────────────────────────────────
  static const textPrimary    = Color(0xFF111827);
  static const textSecondary  = Color(0xFF6B7280);
  static const textTertiary   = Color(0xFF9CA3AF);
  static const textInverse    = Color(0xFFFFFFFF);

  // ── Semantic ───────────────────────────────────────────────
  static const urgent         = Color(0xFFDC2626);
  static const urgentBg       = Color(0xFFFEF2F2);
  static const urgentBorder   = Color(0xFFFECACA);

  static const warning        = Color(0xFFD97706);
  static const warningBg      = Color(0xFFFFFBEB);
  static const warningBorder  = Color(0xFFFDE68A);

  static const success        = Color(0xFF16A34A);
  static const successBg      = Color(0xFFF0FDF4);
  static const successBorder  = Color(0xFFA7F3D0);

  static const info           = Color(0xFF3B82F6);
  static const infoBg         = Color(0xFFEFF6FF);
  static const infoBorder     = Color(0xFFBFDBFE);

  // ── Disciplines (couleurs par discipline équestre) ─────────
  static const cso            = Color(0xFF16A34A); // Saut d'obstacles → vert
  static const dressage       = Color(0xFF7C3AED); // Dressage → violet élégant
  static const cce            = Color(0xFFEA580C); // Concours complet → orange foncé
  static const hunter         = Color(0xFF0369A1); // Hunter → bleu
  static const equifun        = Color(0xFFD97706); // Equifun → ambre

  // ── Transport status ───────────────────────────────────────
  static const transportOpen     = Color(0xFF16A34A);
  static const transportOpenBg   = Color(0xFFF0FDF4);
  static const transportFull     = Color(0xFFD97706);
  static const transportFullBg   = Color(0xFFFFFBEB);
  static const transportClosed   = Color(0xFF9CA3AF);
  static const transportClosedBg = Color(0xFFF3F4F6);
}
