import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../api/presence_api.dart';
import '../config.dart';

const _channelId = 'notices';
const _channelName = 'Notice Board';
const _prefsFcmToken = 'presence_fcm_token';
const _prefsSocketToken = 'presence_socket_device_token';

/// Shows a system notification when a notice is posted for this parent.
/// Uses FCM when Firebase is configured; always uses Socket.IO while logged in.
class ParentPushService {
  ParentPushService(this.api);

  final PresenceApi api;
  final _local = FlutterLocalNotificationsPlugin();
  io.Socket? _socket;
  bool _ready = false;
  bool _firebaseOk = false;
  String? _deviceToken;
  void Function(String route)? onOpenRoute;

  Future<void> init() async {
    if (_ready) return;

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidInit);
    await _local.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (resp) {
        final payload = resp.payload;
        if (payload != null && payload.isNotEmpty) {
          onOpenRoute?.call(payload);
        }
      },
    );

    final androidPlugin = _local.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        _channelId,
        _channelName,
        description: 'New school notices for parents',
        importance: Importance.high,
      ),
    );

    if (Platform.isAndroid) {
      await Permission.notification.request();
    }

    try {
      await Firebase.initializeApp();
      _firebaseOk = true;
      FirebaseMessaging.onMessage.listen((msg) {
        final title = msg.notification?.title ?? msg.data['title'] ?? 'Notice Board';
        final body = msg.notification?.body ?? msg.data['body'] ?? '';
        _showLocal(title.toString(), body.toString(), route: msg.data['route'] ?? '/parent/notices');
      });
      FirebaseMessaging.onMessageOpenedApp.listen((msg) {
        onOpenRoute?.call(msg.data['route'] ?? '/parent/notices');
      });
    } catch (e) {
      debugPrint('Firebase not configured — using Socket.IO notices only: $e');
      _firebaseOk = false;
    }

    _ready = true;
  }

  Future<void> startForParent() async {
    await init();
    await _registerToken();
    _connectSocket();
  }

  Future<void> stop() async {
    _socket?.dispose();
    _socket = null;
    if (_deviceToken != null) {
      try {
        await api.unregisterDeviceToken(_deviceToken!);
      } catch (_) {}
    }
  }

  Future<void> _registerToken() async {
    final prefs = await SharedPreferences.getInstance();
    String? token;

    if (_firebaseOk) {
      try {
        final messaging = FirebaseMessaging.instance;
        await messaging.requestPermission(alert: true, badge: true, sound: true);
        token = await messaging.getToken();
        if (token != null) {
          await prefs.setString(_prefsFcmToken, token);
          await api.registerDeviceToken(token, platform: Platform.isIOS ? 'ios' : 'android');
          _deviceToken = token;
          return;
        }
      } catch (e) {
        debugPrint('FCM token failed: $e');
      }
    }

    // Fallback device id so server can still track the parent session;
    // realtime delivery uses Socket.IO room.
    token = prefs.getString(_prefsSocketToken);
    if (token == null || token.isEmpty) {
      token = 'sock_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(1 << 32)}';
      await prefs.setString(_prefsSocketToken, token);
    }
    try {
      await api.registerDeviceToken(token, platform: 'socket');
      _deviceToken = token;
    } catch (e) {
      debugPrint('Device token register failed: $e');
    }
  }

  void _connectSocket() {
    _socket?.dispose();
    final base = AppConfig.apiBase;
    final socket = io.io(
      base,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .enableReconnection()
          .setPath('/socket.io')
          .build(),
    );
    _socket = socket;

    socket.onConnect((_) {
      final token = api.client.token;
      if (token != null) {
        socket.emit('auth:join', {'token': token});
      }
    });

    socket.on('notice:new', (data) {
      try {
        final map = data is Map
            ? Map<String, dynamic>.from(data)
            : Map<String, dynamic>.from(jsonDecode(jsonEncode(data)) as Map);
        final title = map['title']?.toString() ?? 'Notice Board';
        final body = map['body']?.toString() ?? 'New notice available';
        _showLocal(title, body, route: '/parent/notices');
      } catch (e) {
        debugPrint('notice:new parse error: $e');
      }
    });

    socket.connect();
  }

  Future<void> _showLocal(String title, String body, {String route = '/parent/notices'}) async {
    await _local.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: 'New school notices for parents',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
      ),
      payload: route,
    );
  }
}

/// Background FCM handler (must be top-level).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {}
}
