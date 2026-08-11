import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../state/auth_state.dart';
import '../../state/parent_students_state.dart';
import '../../theme.dart';

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
                          students.setDrawerExpanded(false);
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
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (students.selected != null) _StudentSwitcherBar(students: students),
          Expanded(child: child),
        ],
      ),
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
    final selected = students.selected;
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
          if (selected != null) ...[
            const SizedBox(height: 18),
            Row(
              children: [
                Icon(Icons.people_alt_outlined, size: 18, color: Colors.white.withValues(alpha: 0.9)),
                const SizedBox(width: 8),
                const Text(
                  'Switch Student',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _StudentDropdownCard(students: students),
          ],
        ],
      ),
    );
  }
}

class _StudentSwitcherBar extends StatelessWidget {
  const _StudentSwitcherBar({required this.students});
  final ParentStudentsState students;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: PresenceColors.bg,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
        child: _StudentPill(students: students),
      ),
    );
  }
}

class _StudentPill extends StatelessWidget {
  const _StudentPill({required this.students});
  final ParentStudentsState students;

  @override
  Widget build(BuildContext context) {
    final child = students.selected!;
    final name = child['name']?.toString() ?? 'Student';
    final classLabel = ParentStudentsState.classLabelFor(child);
    final canSwitch = students.children.length > 1;

    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: canSwitch
          ? () => _openSwitcherSheet(context, students)
          : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: PresenceColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            _StudentAvatar(name: name, radius: 16),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: PresenceColors.text,
                    ),
                  ),
                  if (classLabel.isNotEmpty)
                    Text(
                      classLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: PresenceColors.muted,
                      ),
                    ),
                ],
              ),
            ),
            if (canSwitch)
              const Icon(Icons.keyboard_arrow_down_rounded, color: PresenceColors.muted),
          ],
        ),
      ),
    );
  }
}

class _StudentDropdownCard extends StatelessWidget {
  const _StudentDropdownCard({required this.students});

  final ParentStudentsState students;

  @override
  Widget build(BuildContext context) {
    final selected = students.selected!;
    final name = selected['name']?.toString() ?? 'Student';
    final classLabel = ParentStudentsState.classLabelFor(selected);
    final roll = selected['rollNo'];
    final rollLabel = roll == null ? '' : 'Roll No. ${roll.toString().padLeft(2, '0')}';
    final subtitle = [classLabel, rollLabel].where((s) => s.isNotEmpty).join(' | ');
    final canSwitch = students.children.length > 1;

    return Column(
      children: [
        Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: canSwitch ? () => students.toggleDrawerExpanded() : null,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  _StudentAvatar(name: name, radius: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: PresenceColors.text,
                          ),
                        ),
                        if (subtitle.isNotEmpty)
                          Text(
                            subtitle,
                            style: const TextStyle(
                              fontSize: 12,
                              color: PresenceColors.muted,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (canSwitch)
                    Icon(
                      students.drawerExpanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      color: PresenceColors.muted,
                    ),
                ],
              ),
            ),
          ),
        ),
        if (students.drawerExpanded && canSwitch) ...[
          const SizedBox(height: 8),
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            child: Column(
              children: [
                for (var i = 0; i < students.children.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  _StudentOptionTile(
                    child: students.children[i],
                    selected: students.children[i]['id']?.toString() == students.selectedId,
                    onTap: () async {
                      final id = students.children[i]['id']?.toString();
                      if (id != null) await students.select(id);
                    },
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _StudentOptionTile extends StatelessWidget {
  const _StudentOptionTile({
    required this.child,
    required this.selected,
    required this.onTap,
  });

  final Map<String, dynamic> child;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name = child['name']?.toString() ?? 'Student';
    final classLabel = ParentStudentsState.classLabelFor(child);
    final roll = child['rollNo'];
    final rollLabel = roll == null ? '' : 'Roll No. ${roll.toString().padLeft(2, '0')}';
    final subtitle = [classLabel, rollLabel].where((s) => s.isNotEmpty).join(' | ');

    return ListTile(
      onTap: onTap,
      leading: _StudentAvatar(name: name, radius: 18),
      title: Text(
        name,
        style: TextStyle(
          fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          color: PresenceColors.text,
        ),
      ),
      subtitle: subtitle.isEmpty
          ? null
          : Text(subtitle, style: const TextStyle(fontSize: 12, color: PresenceColors.muted)),
      trailing: selected
          ? const Icon(Icons.check_circle, color: PresenceColors.primaryDark)
          : const SizedBox(width: 24),
      dense: true,
    );
  }
}

Future<void> _openSwitcherSheet(BuildContext context, ParentStudentsState students) async {
  await showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(12, 8, 12, 4),
                child: Text(
                  'Switch Student',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
              ),
              for (final child in students.children)
                _StudentOptionTile(
                  child: child,
                  selected: child['id']?.toString() == students.selectedId,
                  onTap: () async {
                    final id = child['id']?.toString();
                    if (id != null) await students.select(id);
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                ),
            ],
          ),
        ),
      );
    },
  );
}

class _StudentAvatar extends StatelessWidget {
  const _StudentAvatar({required this.name, required this.radius});
  final String name;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: radius,
      backgroundColor: const Color(0xFFDBEAFE),
      child: Text(
        ParentStudentsState.initialsFor(name),
        style: TextStyle(
          color: PresenceColors.primaryDark,
          fontWeight: FontWeight.w800,
          fontSize: radius * 0.75,
        ),
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
