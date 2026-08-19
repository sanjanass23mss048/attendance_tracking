import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';
import '../widgets/mobile_ui.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.child});
  final Widget child;

  static const bottomTabs = [
    (path: '/dashboard', label: 'Dashboard', icon: Icons.dashboard_outlined),
    (path: '/attendance', label: 'Attendance', icon: Icons.fact_check_outlined),
    (path: '/notices', label: 'Notice', icon: Icons.campaign_outlined),
    (path: '/students', label: 'Students', icon: Icons.groups_outlined),
    (path: '/calendar', label: 'Calendar', icon: Icons.calendar_month_outlined),
  ];

  static const _titles = {
    '/dashboard': 'Dashboard',
    '/attendance': 'Attendance',
    '/notices': 'Notice Board',
    '/students': 'Students',
    '/calendar': 'Academic Calendar',
    '/classes': 'Classes',
    '/reports': 'Attendance Reports',
    '/notifications': 'Notifications',
    '/settings': 'Settings',
    '/support': 'Help / Support',
    '/teachers': 'Staff',
    '/approvals': 'Edit Approvals',
    '/tc-requests': 'Transfer Certificate',
    '/audit-logs': 'Audit Logs',
  };

  @override
  Widget build(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    final auth = context.watch<AuthState>();
    final drawerItems = [
      const _Dest('/dashboard', 'Dashboard', Icons.dashboard_outlined),
      const _Dest('/attendance', 'Attendance', Icons.fact_check_outlined),
      const _Dest('/notices', 'Notice Board', Icons.campaign_outlined),
      const _Dest('/students', 'Students', Icons.groups_outlined),
      const _Dest('/calendar', 'Academic Calendar', Icons.calendar_month_outlined),
      const _Dest('/classes', 'Classes', Icons.menu_book_outlined),
      const _Dest('/reports', 'Reports', Icons.bar_chart_outlined),
      const _Dest('/notifications', 'Alerts', Icons.notifications_outlined),
      const _Dest('/settings', 'Settings', Icons.settings_outlined),
      if (auth.isStaffManager) const _Dest('/teachers', 'Staff', Icons.school_outlined),
      if (auth.isStaffManager) const _Dest('/approvals', 'Approvals', Icons.verified_user_outlined),
      if (auth.isAdmin) const _Dest('/audit-logs', 'Audit Logs', Icons.history_edu_outlined),
    ];

    var title = 'Presence';
    for (final e in _titles.entries) {
      if (loc == e.key || loc.startsWith('${e.key}/')) {
        title = e.value;
        break;
      }
    }

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(title),
        leading: Builder(
          builder: (ctx) => IconButton(
            icon: const Icon(Icons.menu_rounded),
            tooltip: 'Open menu',
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => context.go('/notifications'),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              DrawerHeader(
                decoration: const BoxDecoration(color: PresenceColors.primaryDark),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Presence',
                      style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      auth.user?['name']?.toString() ?? '',
                      style: const TextStyle(color: Colors.white),
                    ),
                    Text(
                      auth.role,
                      style: const TextStyle(color: Color(0xFFBFDBFE), fontSize: 12),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  children: [
                    for (final d in drawerItems)
                      ListTile(
                        leading: Icon(d.icon),
                        title: Text(d.label),
                        selected: loc.startsWith(d.path),
                        onTap: () {
                          Navigator.pop(context);
                          context.go(d.path);
                        },
                      ),
                  ],
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(
                  Icons.headset_mic_outlined,
                  color: loc.startsWith('/support')
                      ? PresenceColors.primaryDark
                      : PresenceColors.muted,
                ),
                title: Text(
                  'Help / Support',
                  style: TextStyle(
                    fontWeight: loc.startsWith('/support') ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
                selected: loc.startsWith('/support'),
                onTap: () {
                  Navigator.pop(context);
                  context.go('/support');
                },
              ),
            ],
          ),
        ),
      ),
      body: child,
      bottomNavigationBar: PresenceBottomNav(
        tabs: bottomTabs,
        location: loc,
        onSelect: (path) => context.go(path),
      ),
    );
  }
}

class _Dest {
  final String path;
  final String label;
  final IconData icon;
  const _Dest(this.path, this.label, this.icon);
}
