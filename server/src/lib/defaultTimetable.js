function cell(subject, teacher) {
  return { subject, teacher };
}

function breakRow() {
  return TIMETABLE_DAYS.map(() => null);
}

function withBreakRows(teachingRows) {
  return [
    teachingRows[0],
    teachingRows[1],
    teachingRows[2],
    breakRow(),
    teachingRows[3],
    teachingRows[4],
    breakRow(),
    teachingRows[5],
    teachingRows[6],
    teachingRows[7],
  ];
}

/** Primary (Classes 1–9) weekly grid: [periodIndex][dayIndex] Mon–Sat. */
export function buildPrimaryWeeklyTimetable() {
  return withBreakRows([
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
  ]);
}

/** Senior secondary (Classes 10–12) weekly grid. */
export function buildSeniorWeeklyTimetable() {
  return withBreakRows([
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
  ]);
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
  { period: 1, time: '08:45 AM - 09:30 AM', kind: 'period' },
  { period: 2, time: '09:30 AM - 10:15 AM', kind: 'period' },
  { period: 3, time: '10:15 AM - 11:00 AM', kind: 'period' },
  { period: null, time: '11:00 AM - 11:15 AM', kind: 'break', label: 'Short Break' },
  { period: 4, time: '11:15 AM - 12:00 PM', kind: 'period' },
  { period: 5, time: '12:00 PM - 12:45 PM', kind: 'period' },
  { period: null, time: '12:45 PM - 01:30 PM', kind: 'break', label: 'Lunch Break' },
  { period: 6, time: '01:30 PM - 02:15 PM', kind: 'period' },
  { period: 7, time: '02:15 PM - 03:00 PM', kind: 'period' },
  { period: 8, time: '03:00 PM - 03:45 PM', kind: 'period' },
];

export function isBreakSlot(slot) {
  return slot?.kind === 'break';
}

function cloneRow(row) {
  if (!Array.isArray(row)) return TIMETABLE_DAYS.map(() => null);
  return TIMETABLE_DAYS.map((_, d) => {
    const cell = row[d];
    if (!cell || typeof cell !== 'object') return null;
    return { subject: cell.subject || '', teacher: cell.teacher || '' };
  });
}

/** Align a stored grid to PERIOD_TIMES (inserts break rows for older 8-period saves). */
export function normalizeWeeklyGrid(grid, classHint) {
  if (!Array.isArray(grid) || grid.length === 0) {
    return buildDefaultWeeklyTimetable(classHint);
  }
  if (grid.length === PERIOD_TIMES.length) {
    return PERIOD_TIMES.map((slot, i) => (isBreakSlot(slot) ? breakRow() : cloneRow(grid[i])));
  }
  const teaching = Array.from({ length: 8 }, (_, i) => cloneRow(grid[i]));
  return withBreakRows(teaching);
}
