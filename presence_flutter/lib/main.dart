import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'api/api_client.dart';
import 'screens/app_shell.dart';
import 'screens/approvals_screen.dart';
import 'screens/audit_logs_screen.dart';
import 'screens/attendance_classes_screen.dart';
import 'screens/attendance_mark_screen.dart';
import 'screens/calendar_screen.dart';
import 'screens/classes_screen.dart';
import 'screens/compose_notice_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/login_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/parent/parent_calendar_screen.dart';
import 'screens/parent/parent_diary_screen.dart';
import 'screens/parent/parent_notice_board_screen.dart';
import 'screens/parent/parent_profile_screen.dart';
import 'screens/parent/parent_shell.dart';
import 'screens/parent/parent_timetable_screen.dart';
import 'screens/reports_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/staff_notice_board_screen.dart';
import 'screens/students_screen.dart';
import 'screens/teachers_screen.dart';
import 'services/parent_push_service.dart';
import 'state/auth_state.dart';
import 'state/parent_students_state.dart';
import 'theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (_) {}
  runApp(PresenceApp(client: ApiClient()));
}

class PresenceApp extends StatefulWidget {
  const PresenceApp({super.key, required this.client});
  final ApiClient client;

  @override
  State<PresenceApp> createState() => _PresenceAppState();
}

class _PresenceAppState extends State<PresenceApp> {
  late final AuthState auth;
  late final ParentStudentsState parentStudents;
  late final ParentPushService push;
  late final GoRouter router;

  @override
  void initState() {
    super.initState();
    auth = AuthState(widget.client);
    parentStudents = ParentStudentsState(auth);
    auth.attachStudents(parentStudents);
    push = ParentPushService(auth.api);
    auth.attachPush(push);
    push.onOpenRoute = (route) {
      void attempt() {
        if (auth.booting) {
          Future.delayed(const Duration(milliseconds: 120), attempt);
          return;
        }
        if (!auth.isLoggedIn) return;
        router.go(route);
      }

      Future.microtask(attempt);
    };

    router = GoRouter(
      initialLocation: '/login',
      refreshListenable: auth,
      redirect: (context, state) {
        if (auth.booting) {
          if (state.matchedLocation != '/boot') return '/boot';
          return null;
        }
        final loc = state.matchedLocation;
        final onBoot = loc == '/boot';
        final loggingIn = loc == '/login';
        final isParentPath = loc.startsWith('/parent');

        if (!auth.isLoggedIn) {
          return loggingIn ? null : '/login';
        }

        if (loggingIn || onBoot) {
          return auth.isParent ? '/parent/notices' : '/dashboard';
        }

        if (auth.isParent && !isParentPath) {
          return '/parent/notices';
        }
        if (!auth.isParent && isParentPath) {
          return '/dashboard';
        }
        if (loc.startsWith('/audit-logs') && !auth.isAdmin) {
          return '/dashboard';
        }
        return null;
      },
      routes: [
        GoRoute(
          path: '/boot',
          builder: (_, __) => const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          ),
        ),
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
        ShellRoute(
          builder: (context, state, child) => AppShell(child: child),
          routes: [
            GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
            GoRoute(path: '/attendance', builder: (_, __) => const AttendanceClassesScreen()),
            GoRoute(path: '/notices', builder: (_, __) => const StaffNoticeBoardScreen()),
            GoRoute(path: '/students', builder: (_, __) => const StudentsScreen()),
            GoRoute(path: '/calendar', builder: (_, __) => const CalendarScreen()),
            GoRoute(path: '/classes', builder: (_, __) => const ClassesScreen()),
            GoRoute(path: '/reports', builder: (_, __) => const ReportsScreen()),
            GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
            GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
            GoRoute(path: '/teachers', builder: (_, __) => const TeachersScreen()),
            GoRoute(path: '/approvals', builder: (_, __) => const ApprovalsScreen()),
            GoRoute(path: '/audit-logs', builder: (_, __) => const AuditLogsScreen()),
          ],
        ),
        ShellRoute(
          builder: (context, state, child) => ParentShell(child: child),
          routes: [
            GoRoute(path: '/parent/notices', builder: (_, __) => const ParentNoticeBoardScreen()),
            GoRoute(path: '/parent/profile', builder: (_, __) => const ParentProfileScreen()),
            GoRoute(path: '/parent/diary', builder: (_, __) => const ParentDiaryScreen()),
            GoRoute(path: '/parent/timetable', builder: (_, __) => const ParentTimetableScreen()),
            GoRoute(path: '/parent/calendar', builder: (_, __) => const ParentCalendarScreen()),
          ],
        ),
        GoRoute(
          path: '/notices/compose',
          builder: (_, __) => const ComposeNoticeScreen(),
        ),
        GoRoute(
          path: '/attendance/mark',
          builder: (context, state) {
            final q = state.uri.queryParameters;
            return AttendanceMarkScreen(
              sectionId: q['sectionId'] ?? '',
              className: q['className'] ?? '',
              sectionName: q['sectionName'] ?? '',
            );
          },
        ),
      ],
    );
    auth.boot().then((_) {
      // Notification tap that launched a killed app — navigate once session is ready.
      push.flushPendingRoute();
    });
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider.value(value: parentStudents),
      ],
      child: MaterialApp.router(
        title: 'Presence',
        debugShowCheckedModeBanner: false,
        theme: buildPresenceTheme(),
        routerConfig: router,
      ),
    );
  }
}
