import { generateSectionRoster, STUDENTS_PER_SECTION } from './studentRoster.js';

export const ATTENDANCE_STATUS = {
  P: { label: 'Present', color: 'bg-green-500', text: 'text-white', textColor: 'text-green-600' },
  A: { label: 'Absent', color: 'bg-red-500', text: 'text-white', textColor: 'text-red-600' },
  L: { label: 'Late', color: 'bg-amber-400', text: 'text-white', textColor: 'text-amber-600' },
  H: { label: 'Half Day', color: 'bg-violet-500', text: 'text-white', textColor: 'text-violet-600' },
  OH: { label: 'OD - Half Day', color: 'bg-cyan-500', text: 'text-white', textColor: 'text-cyan-600' },
  OF: { label: 'OD - Full Day', color: 'bg-teal-700', text: 'text-white', textColor: 'text-teal-700' },
};

export const STATUS_CYCLE = ['P', 'A', 'L', 'H', 'OH', 'OF'];

/** Class 1-A demo roster (40 students). */
export const students = generateSectionRoster('1', 'A').map((s) => ({
  id: s.rollNo,
  name: s.name,
  roll: s.rollNo,
}));

export { STUDENTS_PER_SECTION };

export const PERIOD_COUNT = 10;

/** Periods shown on Day-wise Attendance (school-typical timetable). */
export const DAYWISE_PERIOD_COUNT = 8;

const SAMPLE_VARIANTS = [
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'A', 'P', 'A'],
  ['P', 'P', 'P', 'L', 'P', 'P', 'P', 'P', 'P', 'A'],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['P', 'A', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'A'],
  ['P', 'P', 'P', 'P', 'H', 'P', 'P', 'P', 'P', 'P'],
  ['P', 'P', 'P', 'P', 'P', 'P', 'A', 'P', 'P', 'P'],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'L', 'P', 'P'],
  ['A', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'L'],
];

export const createSampleGrid = (rowCount = STUDENTS_PER_SECTION) =>
  Array.from({ length: rowCount }, (_, i) => [...SAMPLE_VARIANTS[i % SAMPLE_VARIANTS.length]]);

/** Deterministic mock daily status for a student index on YYYY-MM-DD. */
export function mockDailyStatusForStudent(studentIndex, dateStr) {
  const grid = createSampleGrid();
  const day = Number(String(dateStr || '').slice(-2)) || 1;
  const col = Math.min(grid[0].length - 1, (day + studentIndex) % grid[0].length);
  return grid[studentIndex % grid.length]?.[col] ?? 'P';
}

export const todayClasses = [
  { id: '1-A', classNum: '1', section: 'A', label: 'Class 1 - A', students: 40, percent: 85.0 },
  { id: '1-B', classNum: '1', section: 'B', label: 'Class 1 - B', students: 40, percent: 90.0 },
  { id: '2-A', classNum: '2', section: 'A', label: 'Class 2 - A', students: 40, percent: 87.5 },
  { id: '2-B', classNum: '2', section: 'B', label: 'Class 2 - B', students: 40, percent: 82.5 },
  { id: '3-A', classNum: '3', section: 'A', label: 'Class 3 - A', students: 40, percent: 88.0 },
];

export const schoolStats = {
  totalClasses: 24,
  presentToday: 480,
  absentToday: 72,
  lateToday: 14,
  halfDayToday: 5,
  odHalfDayToday: 2,
  odFullDayToday: 2,
  attendancePercent: 87,
};

export const schoolSummaryBreakdown = [
  { label: 'Present', count: 480, percent: 87, color: '#22c55e' },
  { label: 'Absent', count: 72, percent: 13, color: '#ef4444' },
  { label: 'Late', count: 14, percent: 3, color: '#f59e0b' },
  { label: 'Half Day', count: 5, percent: 1, color: '#8b5cf6' },
  { label: 'OD - Half Day', count: 2, percent: 0.4, color: '#06b6d4' },
  { label: 'OD - Full Day', count: 2, percent: 0.4, color: '#0f766e' },
];
