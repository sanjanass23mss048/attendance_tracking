import { ATTENDANCE_STATUS, PERIOD_COUNT } from '../data/mockData';

/** School timezone — keep in sync with server SCHOOL_TIMEZONE. */
const SCHOOL_TIMEZONE = 'Asia/Kolkata';

/** Today's date as YYYY-MM-DD (for date inputs). */
export function getTodayAttendanceDate(timeZone = SCHOOL_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Default attendance date = today (not a fixed demo date). */
export const DEFAULT_ATTENDANCE_DATE = getTodayAttendanceDate();
export const TODAY_IDX = PERIOD_COUNT - 1;

/** Legacy On Duty (`O`) reads as OD - Full Day (`OF`). */
export function normalizeStatus(status) {
  if (status === 'O') return 'OF';
  return status;
}

export function formatAttendanceDate(isoDate = DEFAULT_ATTENDANCE_DATE) {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function countTodaySummary(grid) {
  const todayCol = grid.map((row) => normalizeStatus(row[TODAY_IDX]));
  return {
    present: todayCol.filter((s) => s === 'P').length,
    absent: todayCol.filter((s) => s === 'A').length,
    late: todayCol.filter((s) => s === 'L').length,
    halfDay: todayCol.filter((s) => s === 'H').length,
    odHalfDay: todayCol.filter((s) => s === 'OH').length,
    odFullDay: todayCol.filter((s) => s === 'OF').length,
  };
}

function summaryMarkedTotal(summary) {
  return (
    summary.present +
    summary.absent +
    summary.late +
    summary.halfDay +
    (summary.odHalfDay || 0) +
    (summary.odFullDay || 0) +
    (summary.onDuty || 0)
  );
}

export function getAttendancePercent(summary) {
  const total = summaryMarkedTotal(summary);
  if (total === 0) return 0;
  return Math.round((summary.present / total) * 100);
}

export function getSummaryBreakdown(summary) {
  const total = summaryMarkedTotal(summary);
  const pct = (n) => (total === 0 ? 0 : Math.round((n / total) * 1000) / 10);

  return [
    { label: 'Present', count: summary.present, percent: pct(summary.present), color: '#22c55e' },
    { label: 'Absent', count: summary.absent, percent: pct(summary.absent), color: '#ef4444' },
    { label: 'Late', count: summary.late, percent: pct(summary.late), color: '#f59e0b' },
    { label: 'Half Day', count: summary.halfDay, percent: pct(summary.halfDay), color: '#8b5cf6' },
    {
      label: 'OD - Half Day',
      count: summary.odHalfDay || 0,
      percent: pct(summary.odHalfDay || 0),
      color: '#06b6d4',
    },
    {
      label: 'OD - Full Day',
      count: summary.odFullDay || 0,
      percent: pct(summary.odFullDay || 0),
      color: '#0f766e',
    },
  ];
}

/** Parent SMS/email only for non-present marked statuses (not P / empty). */
const PARENT_NOTIFY_STATUSES = new Set(['A', 'L', 'H', 'OH', 'OF']);

export function needsParentNotification(status) {
  return PARENT_NOTIFY_STATUSES.has(normalizeStatus(status));
}

export function getNotificationStudent(students, grid) {
  const priority = ['A', 'L', 'H', 'OH', 'OF'];

  for (const status of priority) {
    const rowIdx = grid.findIndex((row) => normalizeStatus(row[TODAY_IDX]) === status);
    if (rowIdx !== -1) {
      return { student: students[rowIdx], status: normalizeStatus(grid[rowIdx][TODAY_IDX]) };
    }
  }

  return { student: null, status: null };
}

export function getStudentsByStatus(students, grid, status) {
  return students.filter((_, i) => normalizeStatus(grid[i][TODAY_IDX]) === status);
}

export function getStatusDisplay(status) {
  const normalized = normalizeStatus(status);
  if (!normalized || !ATTENDANCE_STATUS[normalized]) {
    return {
      label: 'Select status',
      color: 'bg-gray-200',
      text: 'text-gray-600',
      textColor: 'text-gray-500',
    };
  }
  return ATTENDANCE_STATUS[normalized];
}

export function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

export function gridsEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((row, i) => row.length === b[i].length && row.every((cell, j) => cell === b[i][j]));
}

export function isValidAttendanceStatus(status) {
  return Boolean(status && ATTENDANCE_STATUS[normalizeStatus(status)]);
}

export function countMarkedToday(grid) {
  return grid.filter((row) => isValidAttendanceStatus(row[TODAY_IDX])).length;
}

export function getUnmarkedStudents(students, grid) {
  return students.filter((_, i) => !isValidAttendanceStatus(grid[i]?.[TODAY_IDX]));
}

export function validateAttendanceGrid(students, grid) {
  const unmarked = getUnmarkedStudents(students, grid);
  if (unmarked.length === 0) {
    return { ok: true, unmarked: [] };
  }
  const names = unmarked
    .slice(0, 5)
    .map((s) => `${s.name} (Roll ${s.roll})`)
    .join(', ');
  const more = unmarked.length > 5 ? ` and ${unmarked.length - 5} more` : '';
  return {
    ok: false,
    unmarked,
    message: `${unmarked.length} student(s) have no status selected: ${names}${more}. Mark all students before saving.`,
  };
}

export function setTodayStatus(grid, rowIdx, status) {
  const next = cloneGrid(grid);
  next[rowIdx][TODAY_IDX] = status;
  return next;
}

export function markAbsentByRolls(grid, students, rollInput) {
  const rolls = rollInput
    .split(/[,;\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));

  const next = cloneGrid(grid);
  students.forEach((student, rowIdx) => {
    next[rowIdx][TODAY_IDX] = rolls.includes(student.roll) ? 'A' : 'P';
  });
  return next;
}

export function generateParentMessage(student, classLabel, status, date = '08 May 2026') {
  const normalized = normalizeStatus(status);

  if (normalized === 'OH') {
    return `Dear Parent,

This is to inform you that your child ${student.name} (${classLabel}), Roll No. ${student.roll} was marked OD - Half Day on ${date}. They were engaged in school-approved duty for part of the day and are not marked Absent.

Thank you.
— Bright Future Public School`;
  }

  if (normalized === 'OF') {
    return `Dear Parent,

This is to inform you that your child ${student.name} (${classLabel}), Roll No. ${student.roll} was marked OD - Full Day on ${date}. They were engaged in school-approved duty and are not marked Absent.

Thank you.
— Bright Future Public School`;
  }

  const statusLabel = getStatusDisplay(normalized).label;
  return `Dear Parent,

This is to inform you that your child ${student.name} (${classLabel}), Roll No. ${student.roll} was marked ${statusLabel} on ${date}.

Thank you.
— Bright Future Public School`;
}

export function getAllStudentNotifications(students, grid, classLabel, date = '08 May 2026') {
  const priority = { A: 0, L: 1, H: 2, OH: 3, OF: 4, P: 5 };

  return students
    .map((student, rowIdx) => {
      const status = normalizeStatus(grid[rowIdx][TODAY_IDX]);
      return {
        student,
        status,
        statusLabel: getStatusDisplay(status).label,
        message: generateParentMessage(student, classLabel, status, date),
      };
    })
    .sort((a, b) => (priority[a.status] ?? 99) - (priority[b.status] ?? 99));
}

export function getParentNotifications(students, grid, classLabel, date = '08 May 2026') {
  return getAllStudentNotifications(students, grid, classLabel, date).filter((n) =>
    needsParentNotification(n.status)
  );
}

export function getMessagesToSend(
  students,
  grid,
  classLabel,
  lastSentStatusByStudent = null,
  date = '08 May 2026'
) {
  const notifications = getParentNotifications(students, grid, classLabel, date);

  if (!lastSentStatusByStudent) {
    return notifications;
  }

  return notifications.filter((n) => {
    const key = String(n.student.id);
    const previouslySent = normalizeStatus(lastSentStatusByStudent[key]);
    return previouslySent !== n.status;
  });
}
