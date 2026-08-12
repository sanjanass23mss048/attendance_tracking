// School academic calendar 2025–26.
// Banded by grade: Classes 1–9 vs Classes 10–12.

class AcademicEvent {
  AcademicEvent({
    required this.title,
    required this.start,
    required this.end,
    this.isHoliday = false,
  });

  final String title;
  final DateTime start;
  final DateTime end;
  final bool isHoliday;

  bool covers(DateTime day) {
    final d = DateTime(day.year, day.month, day.day);
    final s = DateTime(start.year, start.month, start.day);
    final e = DateTime(end.year, end.month, end.day);
    return !d.isBefore(s) && !d.isAfter(e);
  }
}

DateTime _d(int y, int m, int day) => DateTime(y, m, day);

/// Classes 1–9 academic calendar.
final List<AcademicEvent> academicEventsClasses1to9 = [
  AcademicEvent(title: 'School Reopening', start: _d(2025, 6, 2), end: _d(2025, 6, 2)),
  AcademicEvent(
    title: 'Orientation / Introduction Week',
    start: _d(2025, 6, 16),
    end: _d(2025, 6, 20),
  ),
  AcademicEvent(title: 'Unit Test 1', start: _d(2025, 7, 7), end: _d(2025, 7, 11)),
  AcademicEvent(
    title: 'Independence Day Celebration',
    start: _d(2025, 8, 15),
    end: _d(2025, 8, 15),
    isHoliday: true,
  ),
  AcademicEvent(
    title: 'Periodic Assessment 1',
    start: _d(2025, 8, 25),
    end: _d(2025, 8, 29),
  ),
  AcademicEvent(title: "Teachers' Day", start: _d(2025, 9, 5), end: _d(2025, 9, 5)),
  AcademicEvent(
    title: 'Quarterly Examination',
    start: _d(2025, 9, 15),
    end: _d(2025, 9, 19),
  ),
  AcademicEvent(
    title: 'Gandhi Jayanti / Holiday',
    start: _d(2025, 10, 2),
    end: _d(2025, 10, 2),
    isHoliday: true,
  ),
  AcademicEvent(title: 'Term 1 Revision', start: _d(2025, 10, 13), end: _d(2025, 10, 17)),
  AcademicEvent(
    title: 'Term 1 / Half-Yearly Examination',
    start: _d(2025, 10, 20),
    end: _d(2025, 10, 24),
  ),
  AcademicEvent(title: 'Diwali Celebration', start: _d(2025, 10, 29), end: _d(2025, 10, 29)),
  AcademicEvent(
    title: 'Remedial / Activity Week',
    start: _d(2025, 11, 10),
    end: _d(2025, 11, 14),
  ),
  AcademicEvent(title: 'Unit Test 2', start: _d(2025, 12, 1), end: _d(2025, 12, 5)),
  AcademicEvent(
    title: 'Winter Vacation',
    start: _d(2025, 12, 22),
    end: _d(2026, 1, 2),
    isHoliday: true,
  ),
  AcademicEvent(
    title: 'Pongal / Cultural Activities',
    start: _d(2026, 1, 12),
    end: _d(2026, 1, 12),
  ),
  AcademicEvent(
    title: 'Periodic Assessment 2',
    start: _d(2026, 1, 19),
    end: _d(2026, 1, 23),
  ),
  AcademicEvent(
    title: 'Republic Day',
    start: _d(2026, 1, 26),
    end: _d(2026, 1, 26),
    isHoliday: true,
  ),
  AcademicEvent(
    title: 'Annual Exam Revision',
    start: _d(2026, 2, 9),
    end: _d(2026, 2, 13),
  ),
  AcademicEvent(
    title: 'Annual Examination – Part 1',
    start: _d(2026, 2, 16),
    end: _d(2026, 2, 20),
  ),
  AcademicEvent(
    title: 'Annual Examination – Part 2',
    start: _d(2026, 2, 23),
    end: _d(2026, 2, 27),
  ),
  AcademicEvent(
    title: 'Projects / Practical Activities',
    start: _d(2026, 3, 2),
    end: _d(2026, 3, 6),
  ),
  AcademicEvent(title: 'Result Preparation', start: _d(2026, 3, 16), end: _d(2026, 3, 16)),
  AcademicEvent(
    title: 'Annual Day / Cultural Event',
    start: _d(2026, 3, 20),
    end: _d(2026, 3, 20),
  ),
  AcademicEvent(title: 'Last Working Day', start: _d(2026, 3, 27), end: _d(2026, 3, 27)),
  AcademicEvent(
    title: 'Summer Vacation',
    start: _d(2026, 3, 30),
    end: _d(2026, 5, 31),
    isHoliday: true,
  ),
];

/// Classes 10–12 academic calendar.
final List<AcademicEvent> academicEventsClasses10to12 = [
  AcademicEvent(title: 'School Reopening', start: _d(2025, 6, 2), end: _d(2025, 6, 2)),
  AcademicEvent(
    title: 'Bridge / Diagnostic Test',
    start: _d(2025, 6, 9),
    end: _d(2025, 6, 13),
  ),
  AcademicEvent(title: 'Unit Test 1', start: _d(2025, 6, 23), end: _d(2025, 6, 27)),
  AcademicEvent(
    title: 'Independence Day',
    start: _d(2025, 8, 15),
    end: _d(2025, 8, 15),
    isHoliday: true,
  ),
  AcademicEvent(title: 'Periodic Test 1', start: _d(2025, 8, 18), end: _d(2025, 8, 22)),
  AcademicEvent(
    title: 'Quarterly Examination',
    start: _d(2025, 9, 8),
    end: _d(2025, 9, 12),
  ),
  AcademicEvent(
    title: 'Practical / Record Submission – Phase 1',
    start: _d(2025, 9, 22),
    end: _d(2025, 9, 26),
  ),
  AcademicEvent(
    title: 'Gandhi Jayanti / Holiday',
    start: _d(2025, 10, 2),
    end: _d(2025, 10, 2),
    isHoliday: true,
  ),
  AcademicEvent(title: 'Term 1 Revision', start: _d(2025, 10, 13), end: _d(2025, 10, 17)),
  AcademicEvent(
    title: 'Half-Yearly Examination',
    start: _d(2025, 10, 20),
    end: _d(2025, 10, 31),
  ),
  AcademicEvent(
    title: 'Half-Yearly Review / Remedial Classes',
    start: _d(2025, 11, 3),
    end: _d(2025, 11, 7),
  ),
  AcademicEvent(title: 'Unit Test 2', start: _d(2025, 11, 17), end: _d(2025, 11, 21)),
  AcademicEvent(title: 'Periodic Test 2', start: _d(2025, 12, 1), end: _d(2025, 12, 5)),
  AcademicEvent(
    title: 'Practical Examination – Phase 1',
    start: _d(2025, 12, 15),
    end: _d(2025, 12, 19),
  ),
  AcademicEvent(
    title: 'Winter Vacation',
    start: _d(2025, 12, 22),
    end: _d(2026, 1, 2),
    isHoliday: true,
  ),
  AcademicEvent(
    title: 'Pongal / Cultural Activities',
    start: _d(2026, 1, 12),
    end: _d(2026, 1, 12),
  ),
  AcademicEvent(
    title: 'Model Examination 1',
    start: _d(2026, 1, 19),
    end: _d(2026, 1, 23),
  ),
  AcademicEvent(
    title: 'Practical Examination – Phase 2',
    start: _d(2026, 2, 2),
    end: _d(2026, 2, 6),
  ),
  AcademicEvent(
    title: 'Model / Pre-Board Examination 2',
    start: _d(2026, 2, 9),
    end: _d(2026, 2, 13),
  ),
  AcademicEvent(
    title: 'Pre-Board Examination 3',
    start: _d(2026, 2, 16),
    end: _d(2026, 2, 20),
  ),
  AcademicEvent(
    title: 'Final Revision / Doubt Clearing',
    start: _d(2026, 2, 23),
    end: _d(2026, 2, 27),
  ),
  AcademicEvent(
    title: 'Board Examination Period',
    start: _d(2026, 3, 1),
    end: _d(2026, 3, 31),
  ),
  AcademicEvent(
    title: 'Internal Assessment / Project Completion',
    start: _d(2026, 4, 6),
    end: _d(2026, 4, 10),
  ),
  AcademicEvent(
    title: 'Practical / Viva / Project Evaluation',
    start: _d(2026, 4, 13),
    end: _d(2026, 4, 17),
  ),
  AcademicEvent(title: 'Last Working Day', start: _d(2026, 4, 24), end: _d(2026, 4, 24)),
  AcademicEvent(
    title: 'Summer Vacation',
    start: _d(2026, 4, 27),
    end: _d(2026, 5, 31),
    isHoliday: true,
  ),
];

/// Parse grade number from class name like "1", "11", "Class 11", "XI".
int? gradeFromClassName(String? raw) {
  if (raw == null || raw.trim().isEmpty) return null;
  final s = raw.trim().toUpperCase();
  const roman = {
    'I': 1,
    'II': 2,
    'III': 3,
    'IV': 4,
    'V': 5,
    'VI': 6,
    'VII': 7,
    'VIII': 8,
    'IX': 9,
    'X': 10,
    'XI': 11,
    'XII': 12,
  };
  for (final entry in roman.entries) {
    if (s == entry.key || s == 'CLASS ${entry.key}' || s.endsWith(' ${entry.key}')) {
      return entry.value;
    }
  }
  final m = RegExp(r'(\d{1,2})').firstMatch(s);
  if (m == null) return null;
  final n = int.tryParse(m.group(1)!);
  if (n == null || n < 1 || n > 12) return null;
  return n;
}

bool isSeniorSecondary(int? grade) => grade != null && grade >= 10;

List<AcademicEvent> eventsForGrade(int? grade) {
  if (isSeniorSecondary(grade)) return academicEventsClasses10to12;
  return academicEventsClasses1to9;
}

List<AcademicEvent> eventsOnDay(List<AcademicEvent> all, DateTime day) {
  return all.where((e) => e.covers(day)).toList();
}

String formatEventRange(AcademicEvent e) {
  final same = e.start.year == e.end.year &&
      e.start.month == e.end.month &&
      e.start.day == e.end.day;
  if (same) {
    return '${e.start.day} ${_monthShort(e.start.month)} ${e.start.year}';
  }
  if (e.start.year == e.end.year && e.start.month == e.end.month) {
    return '${e.start.day}–${e.end.day} ${_monthShort(e.start.month)} ${e.start.year}';
  }
  return '${e.start.day} ${_monthShort(e.start.month)} ${e.start.year} – '
      '${e.end.day} ${_monthShort(e.end.month)} ${e.end.year}';
}

String _monthShort(int m) {
  const names = [
    '',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return names[m];
}
