import 'package:flutter/material.dart';

class PresenceColors {
  static const bg = Color(0xFFF0F7FF);
  static const card = Colors.white;
  static const primary = Color(0xFF0F766E);
  static const primaryDark = Color(0xFF1E3A8A);
  static const primarySoft = Color(0xFFCCFBF1);
  static const text = Color(0xFF0F172A);
  static const muted = Color(0xFF64748B);
  static const border = Color(0xFFE2E8F0);
  static const danger = Color(0xFFDC2626);
  static const success = Color(0xFF16A34A);
}

ThemeData buildPresenceTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: PresenceColors.primaryDark,
      primary: PresenceColors.primary,
      secondary: PresenceColors.primaryDark,
    ),
    scaffoldBackgroundColor: PresenceColors.bg,
  );
  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: PresenceColors.primaryDark,
      foregroundColor: Colors.white,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: PresenceColors.card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: PresenceColors.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: PresenceColors.primary,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
  );
}
