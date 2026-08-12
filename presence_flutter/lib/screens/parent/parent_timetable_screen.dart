import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/auth_state.dart';
import '../../state/parent_students_state.dart';
import '../../theme.dart';
import '../widgets/student_identity_chip.dart';

class ParentTimetableScreen extends StatefulWidget {
  const ParentTimetableScreen({super.key});

  @override
  State<ParentTimetableScreen> createState() => _ParentTimetableScreenState();
}

class _ParentTimetableScreenState extends State<ParentTimetableScreen> {
  /// sectionId → timetable payload
  final Map<String, Map<String, dynamic>> _bySection = {};
  bool loading = true;
  String? error;
  ParentStudentsState? _students;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _students = context.read<ParentStudentsState>();
      _students!.addListener(_onStudentsChanged);
      _load();
    });
  }

  @override
  void dispose() {
    _students?.removeListener(_onStudentsChanged);
    super.dispose();
  }

  void _onStudentsChanged() {
    _load();
  }

  Future<void> _load() async {
    final students = context.read<ParentStudentsState>();
    final sectionIds = <String>{};
    for (final child in students.children) {
      final id = child['sectionId']?.toString();
      if (id != null && id.isNotEmpty) sectionIds.add(id);
    }

    setState(() {
      loading = true;
      error = null;
    });

    try {
      final api = context.read<AuthState>().api;
      final next = <String, Map<String, dynamic>>{};
      if (sectionIds.isEmpty) {
        final data = await api.parentTimetable();
        next['_default'] = data;
      } else {
        for (final sectionId in sectionIds) {
          final data = await api.parentTimetable(classSectionId: sectionId);
          next[sectionId] = data;
        }
      }
      if (!mounted) return;
      setState(() {
        _bySection
          ..clear()
          ..addAll(next);
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final students = context.watch<ParentStudentsState>();

    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) {
      return Center(child: Text(error!, style: const TextStyle(color: PresenceColors.danger)));
    }
    if (_bySection.isEmpty) {
      return const Center(child: Text('No timetable available.'));
    }

    // Unique sections in child order.
    final sections = <String>[];
    final seen = <String>{};
    for (final child in students.children) {
      final id = child['sectionId']?.toString();
      if (id == null || id.isEmpty || seen.contains(id)) continue;
      if (_bySection.containsKey(id)) {
        seen.add(id);
        sections.add(id);
      }
    }
    if (sections.isEmpty) {
      sections.addAll(_bySection.keys);
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          const Text(
            'Weekly timetable',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
          const SizedBox(height: 4),
          const Text(
            'Combined view for all your children — each timetable is tagged.',
            style: TextStyle(color: PresenceColors.muted, fontSize: 13),
          ),
          const SizedBox(height: 12),
          for (final sectionId in sections) ...[
            _TimetableBlock(
              students: students,
              sectionId: sectionId,
              timetable: _bySection[sectionId]!,
            ),
            const SizedBox(height: 20),
          ],
        ],
      ),
    );
  }
}

class _TimetableBlock extends StatelessWidget {
  const _TimetableBlock({
    required this.students,
    required this.sectionId,
    required this.timetable,
  });

  final ParentStudentsState students;
  final String sectionId;
  final Map<String, dynamic> timetable;

  @override
  Widget build(BuildContext context) {
    final matched = students.childrenForSection(sectionId);
    final days = (timetable['days'] as List?)?.map((e) => e.toString()).toList() ?? [];
    final periods = (timetable['periods'] as List?) ?? [];
    final grid = (timetable['grid'] as List?) ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (matched.isNotEmpty)
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final child in matched) StudentIdentityChip.fromChild(students, child),
            ],
          )
        else
          Text(
            sectionId == '_default' ? 'Class timetable' : 'Section $sectionId',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowColor: WidgetStateProperty.all(const Color(0xFFEEF2FF)),
            columns: [
              const DataColumn(label: Text('Period')),
              for (final d in days)
                DataColumn(label: Text(d.length >= 3 ? d.substring(0, 3) : d)),
            ],
            rows: [
              for (var p = 0; p < grid.length; p++)
                DataRow(
                  cells: [
                    DataCell(
                      Text(
                        periods.length > p
                            ? 'P${(periods[p] as Map)['period'] ?? (p + 1)}'
                            : 'P${p + 1}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    for (var d = 0; d < days.length; d++)
                      DataCell(_cell(grid[p], d)),
                  ],
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _cell(dynamic row, int dayIndex) {
    if (row is! List || dayIndex >= row.length) return const Text('—');
    final cell = row[dayIndex];
    if (cell is! Map) return Text(cell?.toString() ?? '—');
    final subject = cell['subject']?.toString() ?? '';
    final teacher = cell['teacher']?.toString() ?? '';
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(subject, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
          if (teacher.isNotEmpty)
            Text(teacher, style: const TextStyle(fontSize: 10, color: PresenceColors.muted)),
        ],
      ),
    );
  }
}
