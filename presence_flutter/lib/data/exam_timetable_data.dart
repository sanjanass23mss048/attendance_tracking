// Mock exam schedules for parent Timetable → Exam timetable view.

class ExamSlot {
  const ExamSlot({
    required this.dateLabel,
    required this.dayLabel,
    required this.subject,
    required this.time,
    this.kind = 'Theory',
    this.venue,
  });

  final String dateLabel;
  final String dayLabel;
  final String subject;
  final String time;
  /// Theory | Practical
  final String kind;
  final String? venue;
}

/// Class 1-A (Aarav) — Term / Annual style primary exams.
const List<ExamSlot> examTimetableClass1A = [
  ExamSlot(
    dateLabel: '16 Feb 2026',
    dayLabel: 'Monday',
    subject: 'English',
    time: '09:00 AM – 11:00 AM',
    kind: 'Theory',
  ),
  ExamSlot(
    dateLabel: '17 Feb 2026',
    dayLabel: 'Tuesday',
    subject: 'Mathematics',
    time: '09:00 AM – 11:00 AM',
    kind: 'Theory',
  ),
  ExamSlot(
    dateLabel: '18 Feb 2026',
    dayLabel: 'Wednesday',
    subject: 'EVS / Science',
    time: '09:00 AM – 11:00 AM',
    kind: 'Theory',
  ),
  ExamSlot(
    dateLabel: '19 Feb 2026',
    dayLabel: 'Thursday',
    subject: 'Hindi',
    time: '09:00 AM – 11:00 AM',
    kind: 'Theory',
  ),
  ExamSlot(
    dateLabel: '20 Feb 2026',
    dayLabel: 'Friday',
    subject: 'Computer',
    time: '09:00 AM – 10:30 AM',
    kind: 'Practical',
  ),
  ExamSlot(
    dateLabel: '23 Feb 2026',
    dayLabel: 'Monday',
    subject: 'Drawing / Activity',
    time: '09:00 AM – 10:30 AM',
    kind: 'Practical',
  ),
];

/// Class 11-A (Ved) — Pre-board / model style senior exams.
const List<ExamSlot> examTimetableClass11A = [
  ExamSlot(
    dateLabel: '9 Feb 2026',
    dayLabel: 'Monday',
    subject: 'Physics',
    time: '09:30 AM – 12:30 PM',
    kind: 'Theory',
  ),
  ExamSlot(
    dateLabel: '10 Feb 2026',
    dayLabel: 'Tuesday',
    subject: 'Chemistry',
    time: '09:30 AM – 12:30 PM',
    kind: 'Theory',
  ),
  ExamSlot(
    dateLabel: '11 Feb 2026',
    dayLabel: 'Wednesday',
    subject: 'Mathematics',
    time: '09:30 AM – 12:30 PM',
    kind: 'Theory',
  ),
  ExamSlot(
    dateLabel: '12 Feb 2026',
    dayLabel: 'Thursday',
    subject: 'English Core',
    time: '09:30 AM – 12:30 PM',
    kind: 'Theory',
  ),
  ExamSlot(
    dateLabel: '13 Feb 2026',
    dayLabel: 'Friday',
    subject: 'Biology / Computer Science',
    time: '09:30 AM – 12:30 PM',
    kind: 'Theory',
  ),
  ExamSlot(
    dateLabel: '16 Feb 2026',
    dayLabel: 'Monday',
    subject: 'Physics',
    time: '10:00 AM – 01:00 PM',
    kind: 'Practical',
  ),
  ExamSlot(
    dateLabel: '17 Feb 2026',
    dayLabel: 'Tuesday',
    subject: 'Chemistry',
    time: '10:00 AM – 01:00 PM',
    kind: 'Practical',
  ),
];

List<ExamSlot> examTimetableForSection(String? sectionId) {
  final id = (sectionId ?? '').toUpperCase();
  if (id.contains('11') || id.startsWith('CS-11')) {
    return examTimetableClass11A;
  }
  // Default / primary (1-A and other junior classes)
  return examTimetableClass1A;
}
