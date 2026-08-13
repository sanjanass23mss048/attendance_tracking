import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/presence_api.dart';
import '../config.dart';
import '../services/parent_push_service.dart';
import 'parent_students_state.dart';

class AuthState extends ChangeNotifier {
  AuthState(this.client) : api = PresenceApi(client);

  final ApiClient client;
  final PresenceApi api;
  ParentPushService? _push;
  ParentStudentsState? students;

  bool booting = true;
  String? error;

  Map<String, dynamic>? get user => client.user;
  bool get isLoggedIn => client.isLoggedIn;

  String get role => (user?['role'] ?? user?['role_id'] ?? '').toString().toUpperCase();

  bool get isParent => role == 'PARENT';

  bool get isAdmin => role == 'ADMIN';

  bool get isStaffManager => AppConfig.staffManagerRoles.contains(role);

  void attachPush(ParentPushService push) {
    _push = push;
  }

  ParentPushService? get push => _push;

  void attachStudents(ParentStudentsState state) {
    students = state;
  }

  Future<void> boot() async {
    booting = true;
    error = null;
    notifyListeners();
    try {
      await client.loadSession();
      if (client.isLoggedIn) {
        await api.me();
        await _syncPush();
        await students?.load(force: true);
      } else {
        await students?.clear();
      }
    } catch (_) {
      await client.clearSession();
      await students?.clear();
    } finally {
      booting = false;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    error = null;
    notifyListeners();
    try {
      await api.login(email, password);
      await _syncPush();
      await students?.load(force: true);
      notifyListeners();
    } catch (e) {
      error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> logout() async {
    try {
      await _push?.stop();
    } catch (_) {}
    await students?.clear();
    await api.logout();
    notifyListeners();
  }

  Future<void> _syncPush() async {
    if (!isParent) return;
    try {
      await _push?.startForParent();
      _push?.flushPendingRoute();
    } catch (e) {
      debugPrint('Parent push start failed: $e');
    }
  }
}
