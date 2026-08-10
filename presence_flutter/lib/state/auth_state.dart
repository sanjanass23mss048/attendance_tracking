import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/presence_api.dart';
import '../config.dart';

class AuthState extends ChangeNotifier {
  AuthState(this.client) : api = PresenceApi(client);

  final ApiClient client;
  final PresenceApi api;

  bool booting = true;
  String? error;

  Map<String, dynamic>? get user => client.user;
  bool get isLoggedIn => client.isLoggedIn;

  String get role => (user?['role'] ?? user?['role_id'] ?? '').toString().toUpperCase();

  bool get isStaffManager => AppConfig.staffManagerRoles.contains(role);

  Future<void> boot() async {
    booting = true;
    error = null;
    notifyListeners();
    try {
      await client.loadSession();
      if (client.isLoggedIn) {
        await api.me();
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
      notifyListeners();
    } catch (e) {
      error = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> logout() async {
    await api.logout();
    notifyListeners();
  }
}
