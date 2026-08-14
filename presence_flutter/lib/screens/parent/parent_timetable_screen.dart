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
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      classLabel.isEmpty ? 'Timetable' : classLabel,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 16,
                                        color: PresenceColors.primaryDark,
                                      ),
                                    ),
                                    Text(
                                      _mode == _TimetableMode.exam
                                          ? 'Exam Timetable'
                                          : 'Class Timetable',
                                      style: const TextStyle(
                                        color: PresenceColors.muted,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              _ModeDropdown(
                                mode: _mode,
                                onChanged: (v) => setState(() => _mode = v),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
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

class _ModeDropdown extends StatelessWidget {
  const _ModeDropdown({required this.mode, required this.onChanged});
  final _TimetableMode mode;
  final ValueChanged<_TimetableMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: PresenceColors.border),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<_TimetableMode>(
          value: mode,
          isDense: true,
          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 20),
          items: const [
            DropdownMenuItem(
              value: _TimetableMode.classWeekly,
              child: Text('Class Timetable', style: TextStyle(fontSize: 13)),
            ),
            DropdownMenuItem(
              value: _TimetableMode.exam,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.calendar_month_outlined, size: 16, color: PresenceColors.primaryDark),
                  SizedBox(width: 6),
                  Text('Final Exam Timetable', style: TextStyle(fontSize: 13)),
                ],
              ),
            ),
          ],
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ),
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

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: PresenceColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingRowColor: WidgetStateProperty.all(PresenceColors.primaryDark),
          headingTextStyle: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 12,
          ),
          dataRowMinHeight: 52,
          dataRowMaxHeight: 72,
          columnSpacing: 18,
          columns: [
            const DataColumn(label: Text('Period')),
            for (final d in days)
              DataColumn(label: Text(d.length >= 3 ? d.substring(0, 3) : d)),
          ],
          rows: [
            for (var p = 0; p < grid.length; p++)
              DataRow(
                color: WidgetStateProperty.all(
                  p.isOdd ? const Color(0xFFF8FAFC) : Colors.white,
                ),
                cells: [
                  DataCell(
                    Text(
                      periods.length > p
                          ? 'P${(periods[p] as Map)['period'] ?? (p + 1)}'
                          : 'P${p + 1}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: PresenceColors.primaryDark,
                      ),
                    ),
                  ),
                  for (var d = 0; d < days.length; d++) DataCell(_cell(grid[p], d)),
                ],
              ),
          ],
        ),
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
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: PresenceColors.primarySoft,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFBFDBFE)),
          ),
          child: const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.calendar_month_rounded, color: PresenceColors.primaryDark),
              SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Final Examination Schedule',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: PresenceColors.primaryDark,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Please check the dates, timings carefully.',
                      style: TextStyle(
                        fontSize: 12,
                        color: PresenceColors.text,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        for (final slot in slots) ...[
          _ExamCard(slot: slot),
          const SizedBox(height: 10),
        ],
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF8E1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFF5C542).withValues(alpha: 0.5)),
          ),
          child: const Row(
            children: [
              Icon(Icons.star_rounded, size: 18, color: Color(0xFFD97706)),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Reach at least 15 minutes before the exam time.',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: PresenceColors.text,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ExamCard extends StatelessWidget {
  const _ExamCard({required this.slot});
  final ExamSlot slot;

  static IconData _iconFor(String subject) {
    final s = subject.toLowerCase();
    if (s.contains('math')) return Icons.calculate_outlined;
    if (s.contains('english') || s.contains('hindi')) return Icons.menu_book_outlined;
    if (s.contains('science') || s.contains('evs') || s.contains('physics') || s.contains('chem') || s.contains('bio')) {
      return Icons.science_outlined;
    }
    if (s.contains('computer')) return Icons.computer_outlined;
    if (s.contains('draw') || s.contains('art')) return Icons.brush_outlined;
    return Icons.school_outlined;
  }

  /// Parses "16 Feb 2026" → (Feb, 16, Mon)
  (String month, String day, String weekday) _parts() {
    final bits = slot.dateLabel.trim().split(RegExp(r'\s+'));
    final dayNum = bits.isNotEmpty ? bits.first : '';
    final month = bits.length > 1 ? bits[1] : '';
    final weekday = slot.dayLabel.length >= 3 ? slot.dayLabel.substring(0, 3) : slot.dayLabel;
    return (month, dayNum, weekday);
  }

  @override
  Widget build(BuildContext context) {
    final (month, day, weekday) = _parts();
    final isPractical = slot.kind.toLowerCase() == 'practical';
    final tagBg = isPractical ? const Color(0xFFFFEDD5) : const Color(0xFFFEF3C7);
    final tagFg = isPractical ? const Color(0xFFC2410C) : const Color(0xFFB45309);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: PresenceColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 64,
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
              decoration: const BoxDecoration(
                color: PresenceColors.primaryDark,
                borderRadius: BorderRadius.horizontal(left: Radius.circular(15)),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    month,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    day,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      height: 1.1,
                    ),
                  ),
                  Text(
                    weekday,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: PresenceColors.primarySoft,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            _iconFor(slot.subject),
                            size: 18,
                            color: PresenceColors.primaryDark,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            slot.subject,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                              color: PresenceColors.text,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: tagBg,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            slot.kind,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: tagFg,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    // Time only — room/venue intentionally omitted
                    Row(
                      children: [
                        const Icon(Icons.schedule_rounded, size: 15, color: PresenceColors.muted),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            slot.time,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: PresenceColors.text,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
