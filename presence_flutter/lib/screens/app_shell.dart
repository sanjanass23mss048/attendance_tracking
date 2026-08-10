import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.child});
  final Widget child;

  static const destinations = [
    _Dest('/dashboard', 'Dashboard', Icons.dashboard_outlined),
    _Dest('/attendance', 'Attendance', Icons.fact_check_outlined),
    _Dest('/students', 'Students', Icons.groups_outlined),
    _Dest('/calendar', 'Calendar', Icons.calendar_month_outlined),
    _Dest('/classes', 'Classes', Icons.menu_book_outlined),
    _Dest('/reports', 'Reports', Icons.bar_chart_outlined),
    _Dest('/notifications', 'Alerts', Icons.notifications_outlined),
    _Dest('/settings', 'Settings', Icons.settings_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    final auth = context.watch<AuthState>();
    final items = [
      ...destinations,
      if (auth.isStaffManager)
        const _Dest('/teachers', 'Teachers', Icons.school_outlined),
      if (auth.isStaffManager)
        const _Dest('/approvals', 'Approvals', Icons.verified_user_outlined),
    ];

    final selectedRaw = items.indexWhere((d) => loc.startsWith(d.path));
    final selected = selectedRaw < 0 ? 0 : selectedRaw;
    final bottomItems = items.take(5).toList();
    final bottomSelected = selected.clamp(0, bottomItems.length - 1);

    return Scaffold(
      appBar: AppBar(
        title: Text(items[selected.clamp(0, items.length - 1)].label),
        actions: [
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => context.go('/notifications'),
            icon: const Icon(Icons.notifications_none),
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
                    const Text('Presence',
                        style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Text(auth.user?['name']?.toString() ?? '',
                        style: const TextStyle(color: Colors.white)),
                    Text(auth.role,
                        style: const TextStyle(color: Color(0xFFBFDBFE), fontSize: 12)),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  children: [
                    for (final d in items)
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
            ],
          ),
        ),
      ),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: bottomSelected,
        onDestinationSelected: (i) {
          if (i >= 0 && i < bottomItems.length) {
            context.go(bottomItems[i].path);
          }
        },
        destinations: [
          for (final d in bottomItems)
            NavigationDestination(icon: Icon(d.icon), label: d.label.split(' ').first),
        ],
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
