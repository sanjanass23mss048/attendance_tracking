import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';

class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, {this.status});
  @override
  String toString() => message;
}

class ApiClient {
  static const _tokenKey = 'presence_auth_token';
  static const _userKey = 'presence_auth_user';

  String? _token;
  Map<String, dynamic>? _user;

  String? get token => _token;
  Map<String, dynamic>? get user => _user;
  bool get isLoggedIn => _token != null && _token!.isNotEmpty;

  Future<void> loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    final raw = prefs.getString(_userKey);
    if (raw != null) {
      try {
        _user = jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {
        _user = null;
      }
    }
  }

  Future<void> setSession(String token, Map<String, dynamic> user) async {
    _token = token;
    _user = user;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userKey, jsonEncode(user));
  }

  Future<void> clearSession() async {
    _token = null;
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }

  Future<dynamic> fetch(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? jsonBody,
  }) async {
    final uri = Uri.parse(
      '${AppConfig.apiBase}${path.startsWith('/') ? path : '/$path'}',
    );
    final headers = <String, String>{
      'Accept': 'application/json',
      if (jsonBody != null) 'Content-Type': 'application/json',
      if (_token != null && _token!.isNotEmpty) 'Authorization': 'Bearer $_token',
    };

    late http.Response res;
    switch (method.toUpperCase()) {
      case 'POST':
        res = await http.post(uri, headers: headers, body: jsonBody == null ? null : jsonEncode(jsonBody));
        break;
      case 'PUT':
        res = await http.put(uri, headers: headers, body: jsonBody == null ? null : jsonEncode(jsonBody));
        break;
      case 'DELETE':
        res = await http.delete(uri, headers: headers);
        break;
      default:
        res = await http.get(uri, headers: headers);
    }

    dynamic data;
    try {
      data = res.body.isEmpty ? null : jsonDecode(res.body);
    } catch (_) {
      data = {'raw': res.body};
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = (data is Map && (data['error'] != null || data['message'] != null))
          ? (data['error'] ?? data['message']).toString()
          : 'HTTP ${res.statusCode}';
      throw ApiException(msg, status: res.statusCode);
    }
    return data;
  }
}
