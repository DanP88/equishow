import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_colors.dart';

/// Equishow — Thème Material 3
abstract final class AppTheme {
  // ── Radii ─────────────────────────────────────────────────
  static const radiusXS  = 6.0;
  static const radiusSM  = 8.0;
  static const radiusMD  = 10.0;
  static const radiusLG  = 14.0;
  static const radiusXL  = 18.0;
  static const radiusXXL = 24.0;

  // ── Spacing ────────────────────────────────────────────────
  static const sp4  = 4.0;
  static const sp6  = 6.0;
  static const sp8  = 8.0;
  static const sp10 = 10.0;
  static const sp12 = 12.0;
  static const sp16 = 16.0;
  static const sp20 = 20.0;
  static const sp24 = 24.0;

  // ── Touch targets ─────────────────────────────────────────
  static const touchMin = 44.0;

  // ── Shadows ───────────────────────────────────────────────
  static List<BoxShadow> get shadowCard => [
    BoxShadow(
      color: Colors.black.withOpacity(0.05),
      blurRadius: 8,
      offset: const Offset(0, 2),
    ),
  ];
  static List<BoxShadow> get shadowModal => [
    BoxShadow(
      color: Colors.black.withOpacity(0.18),
      blurRadius: 40,
      offset: const Offset(0, 8),
    ),
  ];
  static List<BoxShadow> get shadowFab => [
    BoxShadow(
      color: AppColors.primary.withOpacity(0.35),
      blurRadius: 16,
      offset: const Offset(0, 4),
    ),
  ];

  static ThemeData get light {
    const colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.primary,
      onPrimary: AppColors.textInverse,
      primaryContainer: AppColors.primaryLight,
      onPrimaryContainer: AppColors.primaryDark,
      secondary: AppColors.gold,
      onSecondary: AppColors.textInverse,
      secondaryContainer: AppColors.goldBg,
      onSecondaryContainer: AppColors.gold,
      error: AppColors.urgent,
      onError: AppColors.textInverse,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      surfaceContainerHighest: AppColors.background,
      outline: AppColors.border,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,

      // ── Typography ─────────────────────────────────────────
      textTheme: const TextTheme(
        headlineLarge:  TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: -0.5),
        headlineMedium: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: -0.3),
        headlineSmall:  TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        titleLarge:     TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        titleMedium:    TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        titleSmall:     TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        bodyLarge:      TextStyle(fontSize: 15, fontWeight: FontWeight.w400, color: AppColors.textPrimary, height: 1.5),
        bodyMedium:     TextStyle(fontSize: 14, fontWeight: FontWeight.w400, color: AppColors.textSecondary, height: 1.5),
        bodySmall:      TextStyle(fontSize: 12, fontWeight: FontWeight.w400, color: AppColors.textTertiary, height: 1.4),
        labelLarge:     TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary, letterSpacing: 0.1),
        labelMedium:    TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
        labelSmall:     TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textTertiary, letterSpacing: 0.08),
      ),

      // ── AppBar ─────────────────────────────────────────────
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarBrightness: Brightness.light,
          statusBarIconBrightness: Brightness.dark,
        ),
        titleTextStyle: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
        iconTheme: IconThemeData(color: AppColors.textPrimary),
        toolbarHeight: 56,
      ),

      // ── Bottom navigation ─────────────────────────────────
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textTertiary,
        showSelectedLabels: true,
        showUnselectedLabels: true,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
        unselectedLabelStyle: TextStyle(fontSize: 10, fontWeight: FontWeight.w500),
        elevation: 0,
      ),

      // ── Cards ─────────────────────────────────────────────
      cardTheme: CardTheme(
        color: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusLG),
          side: const BorderSide(color: AppColors.border),
        ),
        margin: EdgeInsets.zero,
      ),

      // ── Inputs ────────────────────────────────────────────
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMD),
          borderSide: const BorderSide(color: AppColors.borderMedium, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMD),
          borderSide: const BorderSide(color: AppColors.borderMedium, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMD),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        hintStyle: const TextStyle(color: AppColors.textTertiary, fontSize: 14),
        labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600),
      ),

      // ── Elevated button ───────────────────────────────────
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.textInverse,
          minimumSize: const Size.fromHeight(touchMin),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusMD)),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
          elevation: 0,
        ),
      ),

      // ── Outlined button ───────────────────────────────────
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          minimumSize: const Size.fromHeight(touchMin),
          side: const BorderSide(color: AppColors.borderMedium),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusMD)),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),

      // ── Chip ──────────────────────────────────────────────
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceVariant,
        labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusSM)),
      ),

      // ── Divider ───────────────────────────────────────────
      dividerTheme: const DividerThemeData(
        color: AppColors.border,
        thickness: 1,
        space: 1,
      ),
    );
  }
}
