import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../data/academic_calendar_data.dart';
import '../../state/parent_students_state.dart';
import '../../theme.dart';
import '../widgets/parent_child_dropdown.dart';

class ParentCalendarScreen extends StatefulWidget {
  const ParentCalendarScreen({super.key});

  @override
  State<ParentCalendarScreen> createState() => _ParentCalendarScreenState();
}

class _ParentCalendarScreenState extends State<ParentCalendarScreen> {
  static final _yearStart = DateTime(2025, 6, 1);
  static final _yearEnd = DateTime(2026, 5, 1);

  late DateTime _month; // first day of visible month
  DateTime? _selectedDay;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final candidate = DateTime(now.year, now.month, 1);
    if (!candidate.isBefore(_yearStart) && !candidate.isAfter(_yearEnd)) {
      _month = candidate;
    } else {
      _month = _yearStart;
    }
    _selectedDay = DateTime(now.year, now.month, now.day);
  }

  int? _gradeForChild(Map<String, dynamic>? child) {
    if (child == null) return null;
    final section = child['section'] is Map
        ? Map<String, dynamic>.from(child['section'] as Map)
        : null;
    final className = section?['class'] is Map
        ? (section!['class'] as Map)['name']?.toString()
        : null;
    return gradeFromClassName(className);
  }

  void _prevMonth() {
    final prev = DateTime(_month.year, _month.month - 1, 1);
    if (prev.isBefore(_yearStart)) return;
    setState(() {
      _month = prev;
      _selectedDay = null;
    });
  }

  void _nextMonth() {
    final next = DateTime(_month.year, _month.month + 1, 1);
    if (next.isAfter(_yearEnd)) return;
    setState(() {
      _month = next;
      _selectedDay = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final students = context.watch<ParentStudentsState>();
    final child = students.selected;
    final grade = _gradeForChild(child);
    final senior = isSeniorSecondary(grade);
    final allEvents = eventsForGrade(grade);
    final monthLabel = DateFormat('MMMM yyyy').format(_month);
    final bandLabel = senior ? 'Classes 10–12' : 'Classes 1–9';

    final monthEvents = allEvents.where((e) {
      final start = DateTime(e.start.year, e.start.month, 1);
      final end = DateTime(e.end.year, e.end.month, 1);
      final cur = DateTime(_month.year, _month.month, 1);
      return !cur.isBefore(start) && !cur.isAfter(end);
    }).toList();

    final selectedEvents =
        _selectedDay == null ? const <AcademicEvent>[] : eventsOnDay(allEvents, _selectedDay!);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const ParentChildDropdown(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
            children: [
              // Header
              Container(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
                decoration: BoxDecoration(
                  color: PresenceColors.primaryDark,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'School Calendar',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Academic Year 2025–26 · $bandLabel',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Month navigator
              Row(
                children: [
                  IconButton(
                    onPressed: _month.isAfter(_yearStart) ? _prevMonth : null,
                    icon: const Icon(Icons.chevron_left),
                    color: PresenceColors.primaryDark,
                  ),
                  Expanded(
                    child: Text(
                      monthLabel,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: PresenceColors.primaryDark,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: _month.isBefore(_yearEnd) ? _nextMonth : null,
                    icon: const Icon(Icons.chevron_right),
                    color: PresenceColors.primaryDark,
                  ),
                ],
              ),
              const SizedBox(height: 4),

              // Month grid
              _MonthGrid(
                month: _month,
                events: allEvents,
                selectedDay: _selectedDay,
                onSelect: (d) => setState(() => _selectedDay = d),
              ),
              const SizedBox(height: 14),

              // Selected day / month events list
              Text(
                _selectedDay == null
                    ? 'This month'
                    : DateFormat('EEEE, d MMMM yyyy').format(_selectedDay!),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
              ),
              const SizedBox(height: 8),
              if ((_selectedDay == null ? monthEvents : selectedEvents).isEmpty)
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Text(
                      'No scheduled events.',
                      style: TextStyle(color: PresenceColors.muted),
                    ),
                  ),
                )
              else
                for (final e in (_selectedDay == null ? monthEvents : selectedEvents))
                  Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: e.isHoliday
                            ? const Color(0xFFFEE2E2)
                            : PresenceColors.primarySoft,
                        child: Icon(
                          e.isHoliday ? Icons.beach_access : Icons.event,
                          size: 18,
                          color: e.isHoliday
                              ? PresenceColors.danger
                              : PresenceColors.primaryDark,
                        ),
                      ),
                      title: Text(
                        e.title,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        [
                          formatEventRange(e),
                          if (e.isHoliday) 'Holiday / Vacation',
                        ].join(' · '),
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

class _MonthGrid extends StatelessWidget {
  const _MonthGrid({
    required this.month,
    required this.events,
    required this.selectedDay,
    required this.onSelect,
  });

  final DateTime month;
  final List<AcademicEvent> events;
  final DateTime? selectedDay;
  final ValueChanged<DateTime> onSelect;

  static const _weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  @override
  Widget build(BuildContext context) {
    final first = DateTime(month.year, month.month, 1);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    // DateTime.weekday: Mon=1 … Sun=7 → convert so Sun=0
    final startOffset = first.weekday % 7;
    final totalCells = ((startOffset + daysInMonth + 6) ~/ 7) * 7;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: PresenceColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Weekday header
          Container(
            color: PresenceColors.primaryDark,
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                for (final label in _weekdayLabels)
                  Expanded(
                    child: Text(
                      label,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 11,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          for (var row = 0; row < totalCells ~/ 7; row++)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var col = 0; col < 7; col++)
                    Expanded(
                      child: _buildCell(startOffset, daysInMonth, row * 7 + col, col),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCell(int startOffset, int daysInMonth, int index, int weekdayCol) {
    final dayNum = index - startOffset + 1;
    final isWeekend = weekdayCol == 0 || weekdayCol == 6;
    final outside = dayNum < 1 || dayNum > daysInMonth;

    if (outside) {
      return Container(
        constraints: const BoxConstraints(minHeight: 64),
        decoration: BoxDecoration(
          color: isWeekend ? const Color(0xFFEFF6FF) : Colors.white,
          border: Border.all(color: PresenceColors.border.withValues(alpha: 0.6), width: 0.5),
        ),
      );
    }

    final day = DateTime(month.year, month.month, dayNum);
    final dayEvents = eventsOnDay(events, day);
    final selected = selectedDay != null &&
        selectedDay!.year == day.year &&
        selectedDay!.month == day.month &&
        selectedDay!.day == day.day;
    final hasHoliday = dayEvents.any((e) => e.isHoliday);
    final hasEvent = dayEvents.isNotEmpty;

    return Material(
      color: selected
          ? const Color(0xFFDBEAFE)
          : isWeekend
              ? const Color(0xFFEFF6FF)
              : Colors.white,
      child: InkWell(
        onTap: () => onSelect(day),
        child: Container(
          constraints: const BoxConstraints(minHeight: 64),
          padding: const EdgeInsets.fromLTRB(4, 4, 4, 6),
          decoration: BoxDecoration(
            border: Border.all(
              color: selected
                  ? PresenceColors.primaryDark
                  : PresenceColors.border.withValues(alpha: 0.6),
              width: selected ? 1.5 : 0.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$dayNum',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                  color: hasHoliday
                      ? PresenceColors.danger
                      : PresenceColors.primaryDark,
                ),
              ),
              if (hasEvent) ...[
                const SizedBox(height: 2),
                for (final e in dayEvents.take(2))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Text(
                      e.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 8.5,
                        height: 1.15,
                        fontWeight: FontWeight.w600,
                        color: e.isHoliday
                            ? PresenceColors.danger
                            : PresenceColors.primaryDark,
                      ),
                    ),
                  ),
                if (dayEvents.length > 2)
                  Text(
                    '+${dayEvents.length - 2} more',
                    style: const TextStyle(
                      fontSize: 8,
                      color: PresenceColors.muted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
