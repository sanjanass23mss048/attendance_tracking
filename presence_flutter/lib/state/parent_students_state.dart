import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/presence_api.dart';
import 'auth_state.dart';

/// Linked children + currently selected student for the parent portal.
class ParentStudentsState extends ChangeNotifier {
  ParentStudentsState(this.auth);

  final AuthState auth;

  static const _prefsKey = 'parent_selected_student_class_id';

  List<Map<String, dynamic>> children = [];
  String? selectedId;
  bool loading = false;
  bool loaded = false;
  String? error;
  bool drawerExpanded = false;

  PresenceApi get _api => auth.api;

  Map<String, dynamic>? get selected {
    if (children.isEmpty) return null;
    final match = children.where((c) => c['id']?.toString() == selectedId);
    if (match.isNotEmpty) return match.first;
    return children.first;
  }

  String get selectedName => selected?['name']?.toString() ?? 'Student';

  String get selectedClassLabel {
    final child = selected;
    if (child == null) return '';
    return classLabelFor(child);
  }

  String get selectedRollLabel {
    final roll = selected?['rollNo'];
    if (roll == null) return '';
    return 'Roll No. ${roll.toString().padLeft(2, '0')}';
  }

  String? get selectedSectionId => selected?['sectionId']?.toString();

  String? get selectedStudentClassId => selected?['id']?.toString();

  static String classLabelFor(Map<String, dynamic> child) {
    final section = child['section'] is Map
        ? Map<String, dynamic>.from(child['section'] as Map)
        : null;
    final className = section?['class'] is Map
        ? (section!['class'] as Map)['name']?.toString()
        : null;
    final sectionName = section?['name']?.toString();
    if (className != null && sectionName != null) {
      return 'Class $className - $sectionName';
    }
    return className ?? sectionName ?? '';
  }

  static String initialsFor(String? name) {
    final parts = (name ?? '').trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  String parentDisplayName() {
    final raw = auth.user?['name']?.toString().trim() ?? '';
    if (raw.isEmpty) return 'Parent';
    final lower = raw.toLowerCase();
    if (lower.contains('parent')) return raw;
    return '$raw (Parent)';
  }

  void toggleDrawerExpanded() {
    drawerExpanded = !drawerExpanded;
    notifyListeners();
  }

  void setDrawerExpanded(bool value) {
    if (drawerExpanded == value) return;
    drawerExpanded = value;
    notifyListeners();
  }

  Future<void> load({bool force = false}) async {
    if (!auth.isParent || !auth.isLoggedIn) {
      await clear();
      return;
    }
    if (loading) return;
    if (loaded && !force) return;

    loading = true;
    error = null;
    notifyListeners();
    try {
      final list = await _api.parentChildren();
      children = list
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();

      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_prefsKey);
      if (saved != null && children.any((c) => c['id']?.toString() == saved)) {
        selectedId = saved;
      } else if (children.isNotEmpty) {
        selectedId = children.first['id']?.toString();
      } else {
        selectedId = null;
      }
      loaded = true;
    } catch (e) {
      error = e.toString();
      debugPrint('Parent children load failed: $e');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> select(String studentClassId) async {
    if (selectedId == studentClassId) {
      drawerExpanded = false;
      notifyListeners();
      return;
    }
    selectedId = studentClassId;
    drawerExpanded = false;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, studentClassId);
  }

  Future<void> clear() async {
    children = [];
    selectedId = null;
    loaded = false;
    loading = false;
    error = null;
    drawerExpanded = false;
    notifyListeners();
  }
}
