import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../state/auth_state.dart';
import '../../state/parent_students_state.dart';
import '../../theme.dart';
import '../../widgets/mobile_ui.dart';
import '../widgets/student_identity_chip.dart';

class ParentShell extends StatelessWidget {
  const ParentShell({super.key, required this.child});
  final Widget child;

  static const destinations = [
    _Dest('/parent/notices', 'Notice', Icons.campaign_outlined, Icons.campaign),
    _Dest('/parent/profile', 'Student', Icons.person_outline, Icons.person),
    _Dest('/parent/diary', 'Class', Icons.menu_book_outlined, Icons.menu_book),
    _Dest('/parent/timetable', 'Timetable', Icons.grid_view_outlined, Icons.grid_view),
    _Dest('/parent/calendar', 'Calendar', Icons.calendar_month_outlined, Icons.calendar_month),
    _Dest('/parent/tc', 'TC', Icons.assignment_outlined, Icons.assignment),
  ];

  static const _titles = {
    '/parent/notices': 'Notice Board',
    '/parent/profile': 'Student Profile',
    '/parent/diary': 'Class Diary',
    '/parent/timetable': 'Timetable',
    '/parent/calendar': 'Calendar',
    '/parent/tc': 'Transfer Certificate',
    '/parent/support': 'Help / Support',
  };

  @override
  Widget build(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    final auth = context.watch<AuthState>();
    final students = context.watch<ParentStudentsState>();
    final selectedRaw = destinations.indexWhere((d) => loc.startsWith(d.path));
    final selected = selectedRaw < 0 ? 0 : selectedRaw;
    final title = _titles[loc] ?? _titles[destinations[selected].path] ?? destinations[selected].label;

    if (auth.isParent && !students.loaded && !students.loading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        students.load();
      });
    }

    return Scaffold(
      backgroundColor: PresenceColors.bg,
      appBar: AppBar(
        title: Text(title),
        leading: Builder(
          builder: (ctx) => IconButton(
            icon: const Icon(Icons.menu_rounded),
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => context.go('/parent/notices'),
            icon: Badge(
              isLabelVisible: true,
              smallSize: 8,
              backgroundColor: PresenceColors.accent,
              child: const Icon(Icons.notifications_none_rounded),
            ),
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
                        leading: Icon(
                          loc.startsWith(d.path) ? d.activeIcon : d.icon,
                          color: loc.startsWith(d.path)
                              ? PresenceColors.primaryDark
                              : PresenceColors.muted,
                        ),
                        title: Text(
                          _titles[d.path] ?? d.label,
                          style: TextStyle(
                            fontWeight:
                                loc.startsWith(d.path) ? FontWeight.w700 : FontWeight.w500,
                            color: PresenceColors.text,
                          ),
                        ),
                        selected: loc.startsWith(d.path),
                        onTap: () {
                          Navigator.pop(context);
                          context.go(d.path);
                        },
                      ),
                    ],
                  ],
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(
                  Icons.headset_mic_outlined,
                  color: loc.startsWith('/parent/support')
                      ? PresenceColors.primaryDark
                      : PresenceColors.muted,
                ),
                title: Text(
                  'Help / Support',
                  style: TextStyle(
                    fontWeight:
                        loc.startsWith('/parent/support') ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
                selected: loc.startsWith('/parent/support'),
                onTap: () {
                  Navigator.pop(context);
                  context.go('/parent/support');
                },
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
      bottomNavigationBar: PresenceBottomNav(
        tabs: [
          for (final d in destinations.take(5)) (path: d.path, label: d.label, icon: d.icon),
        ],
        location: loc,
        onSelect: (path) => context.go(path),
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
  final IconData activeIcon;
  const _Dest(this.path, this.label, this.icon, this.activeIcon);
}
