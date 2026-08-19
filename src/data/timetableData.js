/** Weekly timetable demo data. Grid is [periodIndex][dayIndex]; UI shows periods as columns, days as rows. */

export const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Fixed school day slots — 8 teaching periods with short break and lunch. */
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

export function slotRowKey(slot, index) {
  return isBreakSlot(slot) ? `break-${slot.label}-${index}` : `period-${slot.period}`;
}

export const SUBJECT_STYLES = {
  English: 'bg-sky-100 text-sky-900 border-sky-200',
  Maths: 'bg-violet-100 text-violet-900 border-violet-200',
  EVS: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  Hindi: 'bg-rose-100 text-rose-900 border-rose-200',
  Computer: 'bg-orange-100 text-orange-900 border-orange-200',
  Drawing: 'bg-amber-100 text-amber-900 border-amber-200',
  Games: 'bg-lime-100 text-lime-900 border-lime-200',
  Library: 'bg-yellow-100 text-yellow-900 border-yellow-200',
  Science: 'bg-teal-100 text-teal-900 border-teal-200',
  Social: 'bg-indigo-100 text-indigo-900 border-indigo-200',
};

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

function emptyCell() {
  return { subject: '', teacher: '' };
}

function emptyTeachingRow() {
  return TIMETABLE_DAYS.map(() => emptyCell());
}

function cloneRow(row) {
  if (!Array.isArray(row)) return emptyTeachingRow();
  return TIMETABLE_DAYS.map((_, d) => {
    const cell = row[d];
    if (!cell || typeof cell !== 'object') return emptyCell();
    return { subject: cell.subject || '', teacher: cell.teacher || '' };
  });
}

/**
 * Align a stored grid to the fixed PERIOD_TIMES layout (breaks included).
 * Older 8-row grids (no break rows) are expanded.
 */
export function normalizeWeeklyGrid(grid) {
  if (!Array.isArray(grid) || grid.length === 0) return buildEmptyWeeklyTimetable();
  if (grid.length === PERIOD_TIMES.length) {
    return PERIOD_TIMES.map((slot, i) => (isBreakSlot(slot) ? breakRow() : cloneRow(grid[i])));
  }
  const teaching = Array.from({ length: 8 }, (_, i) => cloneRow(grid[i]));
  return withBreakRows(teaching);
}

/** Empty weekly grid for all teaching periods (break rows stay null). */
export function buildEmptyWeeklyTimetable() {
  return withBreakRows(Array.from({ length: 8 }, () => emptyTeachingRow()));
}

/** Default Class 1-A style weekly grid: [periodIndex][dayIndex] */
export function buildDefaultWeeklyTimetable() {
  const pattern = [
    // P1
    [cell('English', 'Neha Sharma'), cell('Maths', 'Rakesh Verma'), cell('EVS', 'Priya Nair'), cell('Hindi', 'Anita Desai'), cell('English', 'Neha Sharma'), cell('Games', 'Vikram Singh')],
    // P2
    [cell('Maths', 'Rakesh Verma'), cell('English', 'Neha Sharma'), cell('Maths', 'Rakesh Verma'), cell('EVS', 'Priya Nair'), cell('Computer', 'Sonal Mehta'), cell('Library', 'Kavita Rao')],
    // P3
    [cell('EVS', 'Priya Nair'), cell('Hindi', 'Anita Desai'), cell('English', 'Neha Sharma'), cell('Maths', 'Rakesh Verma'), cell('Hindi', 'Anita Desai'), cell('Drawing', 'Meera Joshi')],
    // P4
    [cell('Hindi', 'Anita Desai'), cell('Computer', 'Sonal Mehta'), cell('Hindi', 'Anita Desai'), cell('English', 'Neha Sharma'), cell('EVS', 'Priya Nair'), cell('Games', 'Vikram Singh')],
    // P5
    [cell('Computer', 'Sonal Mehta'), cell('EVS', 'Priya Nair'), cell('Drawing', 'Meera Joshi'), cell('Computer', 'Sonal Mehta'), cell('Maths', 'Rakesh Verma'), cell('Library', 'Kavita Rao')],
    // P6
    [cell('Drawing', 'Meera Joshi'), cell('Games', 'Vikram Singh'), cell('Maths', 'Rakesh Verma'), cell('Library', 'Kavita Rao'), cell('Drawing', 'Meera Joshi'), cell('English', 'Neha Sharma')],
    // P7
    [cell('Games', 'Vikram Singh'), cell('Library', 'Kavita Rao'), cell('Computer', 'Sonal Mehta'), cell('Games', 'Vikram Singh'), cell('Social', 'Amit Khanna'), cell('Science', 'Deepa Iyer')],
    // P8
    [cell('Library', 'Kavita Rao'), cell('Drawing', 'Meera Joshi'), cell('Games', 'Vikram Singh'), cell('Drawing', 'Meera Joshi'), cell('Science', 'Deepa Iyer'), cell('Social', 'Amit Khanna')],
  ];
  return withBreakRows(pattern);
}

export const DEFAULT_TEACHERS = [
  { name: 'Neha Sharma', subject: 'English', role: 'Class Teacher' },
  { name: 'Rakesh Verma', subject: 'Maths', role: 'Subject Teacher' },
  { name: 'Priya Nair', subject: 'EVS', role: 'Subject Teacher' },
  { name: 'Anita Desai', subject: 'Hindi', role: 'Subject Teacher' },
  { name: 'Sonal Mehta', subject: 'Computer', role: 'Subject Teacher' },
  { name: 'Meera Joshi', subject: 'Drawing', role: 'Subject Teacher' },
  { name: 'Vikram Singh', subject: 'Games', role: 'Subject Teacher' },
  { name: 'Kavita Rao', subject: 'Library', role: 'Subject Teacher' },
];
