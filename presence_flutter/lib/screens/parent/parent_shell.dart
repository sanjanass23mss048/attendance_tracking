import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../state/auth_state.dart';
import '../../state/parent_students_state.dart';
import '../../theme.dart';
import '../widgets/student_identity_chip.dart';

class ParentShell extends StatelessWidget {
  const ParentShell({super.key, required this.child});
  final Widget child;

  static const destinations = [
    _Dest('/parent/notices', 'Notice Board', Icons.campaign_outlined, Color(0xFFF97316)),
    _Dest('/parent/profile', 'Student Profile', Icons.person_outline, Color(0xFF6366F1)),
    _Dest('/parent/diary', 'Class Diary', Icons.menu_book_outlined, Color(0xFF92400E)),
    _Dest('/parent/timetable', 'Timetable', Icons.grid_on_outlined, Color(0xFF0EA5E9)),
    _Dest('/parent/calendar', 'Calendar', Icons.calendar_month_outlined, Color(0xFFEF4444)),
  ];

  @override
  Widget build(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    final auth = context.watch<AuthState>();
    final students = context.watch<ParentStudentsState>();
    final selectedRaw = destinations.indexWhere((d) => loc.startsWith(d.path));
    final selected = selectedRaw < 0 ? 0 : selectedRaw;

    if (auth.isParent && !students.loaded && !students.loading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        students.load();
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(destinations[selected].label),
        actions: [
          IconButton(
            tooltip: 'Log out',
            onPressed: () async {
              await auth.logout();
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _DrawerHeader(auth: auth, students: students),
              Expanded(
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    for (final d in destinations) ...[
                      ListTile(
                        leading: CircleAvatar(
                          radius: 18,
                          backgroundColor: d.iconColor.withValues(alpha: 0.12),
                          child: Icon(d.icon, color: d.iconColor, size: 20),
                        ),
                        title: Text(
                          d.label,
                          style: TextStyle(
                            fontWeight: loc.startsWith(d.path) ? FontWeight.w700 : FontWeight.w500,
                            color: PresenceColors.text,
                          ),
                        ),
                        selected: loc.startsWith(d.path),
                        onTap: () {
                          Navigator.pop(context);
                          context.go(d.path);
                        },
                      ),
                      const Divider(height: 1),
                    ],
                  ],
                ),
              ),
              ListTile(
                leading: const Icon(Icons.logout, color: PresenceColors.muted),
                title: const Text('Log out'),
                onTap: () async {
                  Navigator.pop(context);
                  await auth.logout();
                },
              ),
            ],
          ),
        ),
      ),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected.clamp(0, destinations.length - 1),
        onDestinationSelected: (i) => context.go(destinations[i].path),
        destinations: [
          for (final d in destinations)
            NavigationDestination(
              icon: Icon(d.icon),
              label: d.label.split(' ').first,
            ),
        ],
      ),
    );
  }
}

class _DrawerHeader extends StatelessWidget {
  const _DrawerHeader({required this.auth, required this.students});
  final AuthState auth;
  final ParentStudentsState students;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: PresenceColors.primaryDark,
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.15),
                  border: Border.all(color: Colors.white24, width: 2),
                ),
                child: Center(
                  child: Text(
                    ParentStudentsState.initialsFor(auth.user?['name']?.toString()),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  students.parentDisplayName(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          if (students.children.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text(
              'My Children',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final child in students.children)
                  StudentIdentityChip.fromChild(students, child, compact: true),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Dest {
  final String path;
  final String label;
  final IconData icon;
  final Color iconColor;
  const _Dest(this.path, this.label, this.icon, this.iconColor);
}
