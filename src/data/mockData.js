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

/**
 * Showcase patterns — enough Present / Absent / Late / Half Day / OD
 * so Attendance Reports demos look realistic.
 */
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
  ['P', 'P', 'A', 'P', 'P', 'L', 'P', 'P', 'P', 'P'],
  ['P', 'P', 'P', 'P', 'OH', 'P', 'P', 'P', 'P', 'P'],
  ['P', 'P', 'P', 'P', 'P', 'OF', 'P', 'P', 'A', 'P'],
  ['P', 'H', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['A', 'A', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['P', 'P', 'P', 'L', 'L', 'P', 'P', 'P', 'P', 'P'],
];

export const createSampleGrid = (rowCount = STUDENTS_PER_SECTION) =>
  Array.from({ length: rowCount }, (_, i) => [...SAMPLE_VARIANTS[i % SAMPLE_VARIANTS.length]]);

/**
 * Deterministic mock daily status for reports demos.
 * Biases ~80%+ present with clear absent/late/half-day pockets.
 */
export function mockDailyStatusForStudent(studentIndex, dateStr) {
  const day = Number(String(dateStr || '').slice(-2)) || 1;
  const month = Number(String(dateStr || '').slice(5, 7)) || 1;
  const seed = (studentIndex * 17 + day * 3 + month * 5) % 100;

  // ~8% absent, ~4% late, ~2% half day, ~1% OD half, ~1% OD full, rest present
  if (seed < 8) return 'A';
  if (seed < 12) return 'L';
  if (seed < 14) return 'H';
  if (seed < 15) return 'OH';
  if (seed < 16) return 'OF';

  // Extra absents on a few roll numbers for Class demos (e.g. rolls 5, 12, 28)
  const roll = (studentIndex % STUDENTS_PER_SECTION) + 1;
  if ((day % 5 === 0 || day % 7 === 0) && [5, 12, 18, 28].includes(roll)) return 'A';
  if (day % 6 === 0 && [3, 9].includes(roll)) return 'L';

  return 'P';
}

export const todayClasses = [
  { id: '1-A', classNum: '1', section: 'A', label: 'Class 1 - A', students: 40, percent: 91.0 },
  { id: '1-B', classNum: '1', section: 'B', label: 'Class 1 - B', students: 40, percent: 90.0 },
  { id: '2-A', classNum: '2', section: 'A', label: 'Class 2 - A', students: 40, percent: 87.5 },
  { id: '2-B', classNum: '2', section: 'B', label: 'Class 2 - B', students: 40, percent: 88.5 },
  { id: '3-A', classNum: '3', section: 'A', label: 'Class 3 - A', students: 40, percent: 87.1 },
  { id: '3-B', classNum: '3', section: 'B', label: 'Class 3 - B', students: 40, percent: 86.7 },
  { id: '3-C', classNum: '3', section: 'C', label: 'Class 3 - C', students: 40, percent: 91.2 },
  { id: 'LKG-A', classNum: 'LKG', section: 'A', label: 'LKG - A', students: 40, percent: 87.0 },
  { id: 'UKG-A', classNum: 'UKG', section: 'A', label: 'UKG - A', students: 40, percent: 89.0 },
];

/** School-wide KPIs for Attendance Reports overview (demo). */
export const schoolStats = {
  totalClasses: 24,
  totalStudents: 710,
  presentToday: 568,
  absentToday: 142,
  lateToday: 20,
  halfDayToday: 12,
  odHalfDayToday: 4,
  odFullDayToday: 3,
  attendancePercent: 92.4,
};

export const schoolSummaryBreakdown = [
  { label: 'Present', count: 568, percent: 80, color: '#22c55e' },
  { label: 'Absent', count: 142, percent: 20, color: '#ef4444' },
  { label: 'Late', count: 20, percent: 2.8, color: '#f59e0b' },
  { label: 'Half Day', count: 12, percent: 1.7, color: '#8b5cf6' },
  { label: 'OD - Half Day', count: 4, percent: 0.6, color: '#06b6d4' },
  { label: 'OD - Full Day', count: 3, percent: 0.4, color: '#0f766e' },
];
