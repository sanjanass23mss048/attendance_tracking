import 'package:flutter/material.dart';

class PresenceColors {
  static const bg = Color(0xFFF5F7FB);
  static const card = Colors.white;
  static const primary = Color(0xFF1E3A8A);
  static const primaryDark = Color(0xFF1E3A8A);
  static const primarySoft = Color(0xFFDBEAFE);
  static const accent = Color(0xFFF5C542);
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
      primary: PresenceColors.primaryDark,
      secondary: PresenceColors.accent,
    ),
    scaffoldBackgroundColor: PresenceColors.bg,
  );
  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: PresenceColors.primaryDark,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        color: Colors.white,
        fontSize: 18,
        fontWeight: FontWeight.w700,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: Colors.transparent,
      elevation: 8,
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 11,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: selected ? PresenceColors.primaryDark : PresenceColors.muted,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          size: 24,
          color: selected ? PresenceColors.primaryDark : PresenceColors.muted,
        );
      }),
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
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: PresenceColors.primaryDark,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
  );
}
