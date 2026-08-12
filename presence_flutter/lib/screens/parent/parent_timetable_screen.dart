import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/auth_state.dart';
import '../../state/parent_students_state.dart';
import '../../theme.dart';
import '../widgets/parent_child_dropdown.dart';

class ParentTimetableScreen extends StatefulWidget {
  const ParentTimetableScreen({super.key});

  @override
  State<ParentTimetableScreen> createState() => _ParentTimetableScreenState();
}

class _ParentTimetableScreenState extends State<ParentTimetableScreen> {
  Map<String, dynamic>? timetable;
  bool loading = true;
  String? error;
  ParentStudentsState? _students;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _students = context.read<ParentStudentsState>();
      _students!.addListener(_onChildChanged);
      _load();
    });
  }

  @override
  void dispose() {
    _students?.removeListener(_onChildChanged);
    super.dispose();
  }

  void _onChildChanged() {
    _load();
  }

  Future<void> _load() async {
    final students = context.read<ParentStudentsState>();
    final sectionId = students.selectedSectionId;

    setState(() {
      loading = true;
      error = null;
    });

    try {
      final api = context.read<AuthState>().api;
      final data = sectionId != null && sectionId.isNotEmpty
          ? await api.parentTimetable(classSectionId: sectionId)
          : await api.parentTimetable();
      if (!mounted) return;
      setState(() => timetable = data);
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
    final child = students.selected;
    final classLabel =
        child != null ? ParentStudentsState.displayClassLabelFor(child) : '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const ParentChildDropdown(),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error != null
                    ? ListView(
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(error!, style: const TextStyle(color: PresenceColors.danger)),
                          ),
                        ],
                      )
                    : timetable == null
                        ? ListView(
                            children: const [
                              SizedBox(height: 80),
                              Center(child: Text('No timetable available.')),
                            ],
                          )
                        : ListView(
                            padding: const EdgeInsets.all(12),
                            children: [
                              Text(
                                classLabel.isEmpty ? 'Weekly timetable' : '$classLabel timetable',
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                              ),
                              const SizedBox(height: 12),
                              _TimetableTable(timetable: timetable!),
                            ],
                          ),
          ),
        ),
      ],
    );
  }
}

class _TimetableTable extends StatelessWidget {
  const _TimetableTable({required this.timetable});
  final Map<String, dynamic> timetable;

  @override
  Widget build(BuildContext context) {
    final days = (timetable['days'] as List?)?.map((e) => e.toString()).toList() ?? [];
    final periods = (timetable['periods'] as List?) ?? [];
    final grid = (timetable['grid'] as List?) ?? [];

    return SingleChildScrollView(
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
                for (var d = 0; d < days.length; d++) DataCell(_cell(grid[p], d)),
              ],
            ),
        ],
      ),
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
