function cell(subject, teacher) {
  return { subject, teacher };
}

/** Primary (Classes 1–9) weekly grid: [periodIndex][dayIndex] Mon–Sat. */
export function buildPrimaryWeeklyTimetable() {
  return [
    [
      cell('English', 'Neha Sharma'),
      cell('Maths', 'Rakesh Verma'),
      cell('EVS', 'Priya Nair'),
      cell('Hindi', 'Anita Desai'),
      cell('English', 'Neha Sharma'),
      cell('Games', 'Vikram Singh'),
    ],
    [
      cell('Maths', 'Rakesh Verma'),
      cell('English', 'Neha Sharma'),
      cell('Maths', 'Rakesh Verma'),
      cell('EVS', 'Priya Nair'),
      cell('Computer', 'Sonal Mehta'),
      cell('Library', 'Kavita Rao'),
    ],
    [
      cell('EVS', 'Priya Nair'),
      cell('Hindi', 'Anita Desai'),
      cell('English', 'Neha Sharma'),
      cell('Maths', 'Rakesh Verma'),
      cell('Hindi', 'Anita Desai'),
      cell('Drawing', 'Meera Joshi'),
    ],
    [
      cell('Hindi', 'Anita Desai'),
      cell('Computer', 'Sonal Mehta'),
      cell('Hindi', 'Anita Desai'),
      cell('English', 'Neha Sharma'),
      cell('EVS', 'Priya Nair'),
      cell('Games', 'Vikram Singh'),
    ],
    [
      cell('Computer', 'Sonal Mehta'),
      cell('EVS', 'Priya Nair'),
      cell('Drawing', 'Meera Joshi'),
      cell('Computer', 'Sonal Mehta'),
      cell('Maths', 'Rakesh Verma'),
      cell('Library', 'Kavita Rao'),
    ],
    [
      cell('Drawing', 'Meera Joshi'),
      cell('Games', 'Vikram Singh'),
      cell('Maths', 'Rakesh Verma'),
      cell('Library', 'Kavita Rao'),
      cell('Drawing', 'Meera Joshi'),
      cell('English', 'Neha Sharma'),
    ],
    [
      cell('Games', 'Vikram Singh'),
      cell('Library', 'Kavita Rao'),
      cell('Computer', 'Sonal Mehta'),
      cell('Games', 'Vikram Singh'),
      cell('Social', 'Amit Khanna'),
      cell('Science', 'Deepa Iyer'),
    ],
    [
      cell('Library', 'Kavita Rao'),
      cell('Drawing', 'Meera Joshi'),
      cell('Games', 'Vikram Singh'),
      cell('Drawing', 'Meera Joshi'),
      cell('Science', 'Deepa Iyer'),
      cell('Social', 'Amit Khanna'),
    ],
  ];
}

/** Senior secondary (Classes 10–12) weekly grid. */
export function buildSeniorWeeklyTimetable() {
  return [
    [
      cell('Physics', 'Dr. Anil Kapoor'),
      cell('Mathematics', 'Rakesh Verma'),
      cell('Chemistry', 'Dr. Meena Rao'),
      cell('English', 'Neha Sharma'),
      cell('Physics', 'Dr. Anil Kapoor'),
      cell('Computer Sci.', 'Sonal Mehta'),
    ],
    [
      cell('Mathematics', 'Rakesh Verma'),
      cell('Chemistry', 'Dr. Meena Rao'),
      cell('Physics Lab', 'Dr. Anil Kapoor'),
      cell('Mathematics', 'Rakesh Verma'),
      cell('Biology', 'Deepa Iyer'),
      cell('Library', 'Kavita Rao'),
    ],
    [
      cell('Chemistry', 'Dr. Meena Rao'),
      cell('English', 'Neha Sharma'),
      cell('Mathematics', 'Rakesh Verma'),
      cell('Physics', 'Dr. Anil Kapoor'),
      cell('Chemistry', 'Dr. Meena Rao'),
      cell('Games', 'Vikram Singh'),
    ],
    [
      cell('English', 'Neha Sharma'),
      cell('Physics', 'Dr. Anil Kapoor'),
      cell('Biology', 'Deepa Iyer'),
      cell('Computer Sci.', 'Sonal Mehta'),
      cell('English', 'Neha Sharma'),
      cell('Career Guidance', 'Anita Desai'),
    ],
    [
      cell('Computer Sci.', 'Sonal Mehta'),
      cell('Biology', 'Deepa Iyer'),
      cell('Chemistry Lab', 'Dr. Meena Rao'),
      cell('English', 'Neha Sharma'),
      cell('Mathematics', 'Rakesh Verma'),
      cell('Library', 'Kavita Rao'),
    ],
    [
      cell('Biology', 'Deepa Iyer'),
      cell('Computer Sci.', 'Sonal Mehta'),
      cell('English', 'Neha Sharma'),
      cell('Chemistry', 'Dr. Meena Rao'),
      cell('Physics', 'Dr. Anil Kapoor'),
      cell('Mathematics', 'Rakesh Verma'),
    ],
    [
      cell('Maths Practice', 'Rakesh Verma'),
      cell('Physics', 'Dr. Anil Kapoor'),
      cell('Computer Sci.', 'Sonal Mehta'),
      cell('Biology Lab', 'Deepa Iyer'),
      cell('Project Work', 'Sonal Mehta'),
      cell('Games', 'Vikram Singh'),
    ],
    [
      cell('Remedial', 'Anita Desai'),
      cell('Chemistry', 'Dr. Meena Rao'),
      cell('Mathematics', 'Rakesh Verma'),
      cell('Physics', 'Dr. Anil Kapoor'),
      cell('Assembly / Club', 'Priya Nair'),
      cell('Self Study', '—'),
    ],
  ];
}

function gradeFromClassName(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  const m = s.match(/(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : null;
}

/** @param {string | number | null | undefined} classHint class name or section id like CS-11-A */
export function buildDefaultWeeklyTimetable(classHint) {
  const hint = String(classHint || '');
  let grade = gradeFromClassName(hint);
  if (grade == null && /CS-1[0-2]-/i.test(hint)) {
    const m = hint.match(/CS-(1[0-2])-/i);
    grade = m ? Number(m[1]) : null;
  }
  if (grade != null && grade >= 10) return buildSeniorWeeklyTimetable();
  return buildPrimaryWeeklyTimetable();
}

export const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const PERIOD_TIMES = [
  { period: 1, time: '08:00 AM - 08:40 AM' },
  { period: 2, time: '08:40 AM - 09:20 AM' },
  { period: 3, time: '09:20 AM - 10:00 AM' },
  { period: 4, time: '10:20 AM - 11:00 AM' },
  { period: 5, time: '11:00 AM - 11:40 AM' },
  { period: 6, time: '11:40 AM - 12:20 PM' },
  { period: 7, time: '01:00 PM - 01:40 PM' },
  { period: 8, time: '01:40 PM - 02:20 PM' },
];
