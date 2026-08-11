import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/presence_api.dart';
import '../config.dart';
import '../services/parent_push_service.dart';

class AuthState extends ChangeNotifier {
  AuthState(this.client) : api = PresenceApi(client);

  final ApiClient client;
  final PresenceApi api;
  ParentPushService? _push;

  bool booting = true;
  String? error;

  Map<String, dynamic>? get user => client.user;
  bool get isLoggedIn => client.isLoggedIn;

  String get role => (user?['role'] ?? user?['role_id'] ?? '').toString().toUpperCase();

  bool get isParent => role == 'PARENT';

  bool get isStaffManager => AppConfig.staffManagerRoles.contains(role);

  void attachPush(ParentPushService push) {
    _push = push;
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
      }
    } catch (_) {
      await client.clearSession();
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
    await api.logout();
    notifyListeners();
  }

  Future<void> _syncPush() async {
    if (!isParent) return;
    try {
      await _push?.startForParent();
    } catch (e) {
      debugPrint('Parent push start failed: $e');
    }
  }
}
