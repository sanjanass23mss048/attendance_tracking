import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/exam_timetable_data.dart';
import '../../state/auth_state.dart';
import '../../state/parent_students_state.dart';
import '../../theme.dart';
import '../widgets/parent_child_dropdown.dart';

enum _TimetableMode { classWeekly, exam }

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
  _TimetableMode _mode = _TimetableMode.classWeekly;

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
    final sectionId = students.selectedSectionId;
    final examSlots = examTimetableForSection(sectionId);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const ParentChildDropdown(),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: loading && _mode == _TimetableMode.classWeekly
                ? const Center(child: CircularProgressIndicator())
                : error != null && _mode == _TimetableMode.classWeekly
                    ? ListView(
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(error!, style: const TextStyle(color: PresenceColors.danger)),
                          ),
                        ],
                      )
                    : ListView(
                        padding: const EdgeInsets.all(12),
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Expanded(
                                child: Text(
                                  classLabel.isEmpty
                                      ? (_mode == _TimetableMode.exam
                                          ? 'Exam timetable'
                                          : 'Weekly timetable')
                                      : (_mode == _TimetableMode.exam
                                          ? '$classLabel · Exam'
                                          : '$classLabel timetable'),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 16,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Flexible(
                                child: ConstrainedBox(
                                  constraints: const BoxConstraints(maxWidth: 180),
                                  child: InputDecorator(
                                    decoration: InputDecoration(
                                      isDense: true,
                                      contentPadding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 2,
                                      ),
                                      filled: true,
                                      fillColor: Colors.white,
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(10),
                                        borderSide: const BorderSide(color: PresenceColors.border),
                                      ),
                                      enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(10),
                                        borderSide: const BorderSide(color: PresenceColors.border),
                                      ),
                                    ),
                                    child: DropdownButtonHideUnderline(
                                      child: DropdownButton<_TimetableMode>(
                                        isExpanded: true,
                                        value: _mode,
                                        items: const [
                                          DropdownMenuItem(
                                            value: _TimetableMode.classWeekly,
                                            child: Text('Class timetable', style: TextStyle(fontSize: 13)),
                                          ),
                                          DropdownMenuItem(
                                            value: _TimetableMode.exam,
                                            child: Text('Exam timetable', style: TextStyle(fontSize: 13)),
                                          ),
                                        ],
                                        onChanged: (v) {
                                          if (v != null) setState(() => _mode = v);
                                        },
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (_mode == _TimetableMode.classWeekly)
                            timetable == null
                                ? const Padding(
                                    padding: EdgeInsets.all(40),
                                    child: Center(child: Text('No timetable available.')),
                                  )
                                : _TimetableTable(timetable: timetable!)
                          else
                            _ExamTimetableList(slots: examSlots),
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

class _ExamTimetableList extends StatelessWidget {
  const _ExamTimetableList({required this.slots});
  final List<ExamSlot> slots;

  @override
  Widget build(BuildContext context) {
    if (slots.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(20),
          child: Text('No exam timetable published yet.'),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Upcoming examination schedule',
          style: TextStyle(color: PresenceColors.muted, fontSize: 13),
        ),
        const SizedBox(height: 8),
        for (final slot in slots)
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: PresenceColors.primarySoft,
                child: Text(
                  slot.dateLabel.split(' ').first,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    color: PresenceColors.primaryDark,
                  ),
                ),
              ),
              title: Text(slot.subject, style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(
                [
                  slot.dateLabel,
                  slot.dayLabel,
                  slot.time,
                  if (slot.venue != null) slot.venue,
                ].join(' · '),
              ),
            ),
          ),
      ],
    );
  }
}
