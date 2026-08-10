import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';

class AttendanceClassesScreen extends StatefulWidget {
  const AttendanceClassesScreen({super.key});

  @override
  State<AttendanceClassesScreen> createState() => _AttendanceClassesScreenState();
}

class _AttendanceClassesScreenState extends State<AttendanceClassesScreen> {
  List<_SectionRow> rows = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final classes = await context.read<AuthState>().api.classes();
      final next = <_SectionRow>[];
      for (final klass in classes) {
        final map = Map<String, dynamic>.from(klass as Map);
        final className = map['name']?.toString() ?? '';
        for (final sec in (map['sections'] as List? ?? [])) {
          final s = Map<String, dynamic>.from(sec as Map);
          next.add(_SectionRow(
            sectionId: s['id']?.toString() ?? '',
            className: className,
            sectionName: s['name']?.toString() ?? '',
            studentCount: int.tryParse('${s['studentCount'] ?? 0}') ?? 0,
          ));
        }
      }
      setState(() => rows = next);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Choose a class section to mark today’s attendance.',
            style: TextStyle(color: PresenceColors.muted),
          ),
          if (error != null) ...[
            const SizedBox(height: 8),
            Text(error!, style: const TextStyle(color: PresenceColors.danger)),
          ],
          const SizedBox(height: 12),
          if (loading && rows.isEmpty)
            const Padding(
              padding: EdgeInsets.all(40),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (rows.isEmpty)
            const Padding(
              padding: EdgeInsets.all(40),
              child: Text('No classes assigned.', textAlign: TextAlign.center),
            )
          else
            ...rows.map((r) => Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    title: Text('Class ${r.className} — ${r.sectionName}',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${r.studentCount} students'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push(
                      '/attendance/mark'
                      '?sectionId=${Uri.encodeComponent(r.sectionId)}'
                      '&className=${Uri.encodeComponent(r.className)}'
                      '&sectionName=${Uri.encodeComponent(r.sectionName)}',
                    ),
                  ),
                )),
        ],
      ),
    );
  }
}

class _SectionRow {
  final String sectionId;
  final String className;
  final String sectionName;
  final int studentCount;
  _SectionRow({
    required this.sectionId,
    required this.className,
    required this.sectionName,
    required this.studentCount,
  });
}
