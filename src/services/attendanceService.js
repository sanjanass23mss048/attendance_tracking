import {
  createSampleGrid,
  mockDailyStatusForStudent,
  schoolStats,
  DAYWISE_PERIOD_COUNT,
  PERIOD_COUNT,
  STUDENTS_PER_SECTION,
} from '../data/mockData.js';
import { generateSectionRoster, mockStudentId } from '../data/studentRoster.js';
import { apiFetch, useMock } from './api.js';
import { mockSectionId, resolveSectionId } from './classService.js';
import { TODAY_IDX, normalizeStatus } from '../utils/attendance.js';

const mockDailyStore = new Map();
const mockPeriodStore = new Map();

function dailyKey(sectionId, date) {
  return `${sectionId}|${date}`;
}

function mockStudentsForSection(sectionId) {
  const match = String(sectionId).match(/^mock-section-(.+)-(.+)$/);
  const className = match?.[1] || '1';
  const sectionName = match?.[2] || 'A';
  return generateSectionRoster(className, sectionName).map((s) => ({
    id: mockStudentId(sectionId, className, sectionName, s.rollNo),
    roll: s.rollNo,
    name: s.name,
  }));
}

async function resolveQuerySectionId(query) {
  if (query.sectionId) return query.sectionId;
  return resolveSectionId(query.class || '1', query.section || 'A');
}

/** Build UI grid rows for daily marking (last column = today's status).
 * Missing or null API status defaults to Present (`P`) in the UI. */
export function gridFromDailyMarks(marks, studentCount) {
  const count = studentCount ?? marks.length;
  const grid = Array.from({ length: count }, () => Array(PERIOD_COUNT).fill(''));
  marks.forEach((mark, i) => {
    if (i < grid.length) {
      grid[i][TODAY_IDX] = normalizeStatus(mark.status) || 'P';
    }
  });
  for (let i = 0; i < count; i++) {
    if (!grid[i][TODAY_IDX]) {
      grid[i][TODAY_IDX] = 'P';
    }
  }
  return grid;
}

/** Full period sheet with every student × period set to Present. */
export function createPresentPeriodSheet(students, periodCount) {
  const sheet = {};
  const periodIds = Array.from({ length: periodCount }, (_, i) => String(i + 1));
  for (const student of students || []) {
    sheet[String(student.id)] = Object.fromEntries(periodIds.map((pid) => [pid, 'P']));
  }
  return sheet;
}

/** Extract daily PUT marks from grid + students.
 * Present (`P`) is omitted — the server treats missing rows as Present. */
export function marksFromDailyGrid(students, grid) {
  return (students || [])
    .map((student, rowIdx) => {
      const raw = grid[rowIdx]?.[TODAY_IDX];
      const status = normalizeStatus(raw) || 'P';
      return { studentId: String(student.id), status };
    })
    .filter((mark) => mark.status !== 'P');
}

/** Period sheet map: { [studentId]: { [periodId]: status } } */
export function sheetFromPeriodMarks(marks) {
  const sheet = {};
  for (const mark of marks || []) {
    const sid = String(mark.studentId);
    if (!sheet[sid]) sheet[sid] = {};
    sheet[sid][String(mark.periodNo)] = normalizeStatus(mark.status) || mark.status;
  }
  return sheet;
}

export function marksFromPeriodSheet(sheet) {
  const marks = [];
  for (const [studentId, byPeriod] of Object.entries(sheet || {})) {
    for (const [periodId, status] of Object.entries(byPeriod || {})) {
      if (!status) continue;
      marks.push({
        studentId: String(studentId),
        periodNo: Number(periodId),
        status,
      });
    }
  }
  return marks;
}

/**
 * School-wide daily summary for dashboard.
 * @param {{ date: string }} query
 */
export async function getAttendanceSummary(query) {
  if (useMock()) {
    return {
      date: query.date,
      totalClasses: schoolStats.totalClasses,
      totalSections: 42,
      totalStudents: schoolStats.totalStudents ?? schoolStats.presentToday + schoolStats.absentToday,
      marked: schoolStats.presentToday + schoolStats.absentToday,
      present: schoolStats.presentToday,
      absent: schoolStats.absentToday,
      late: schoolStats.lateToday,
      halfDay: schoolStats.halfDayToday,
      odHalfDay: schoolStats.odHalfDayToday,
      odFullDay: schoolStats.odFullDayToday,
      attendancePercent: schoolStats.attendancePercent,
    };
  }

  const params = new URLSearchParams({ date: query.date });
  return apiFetch(`/api/attendance/summary?${params.toString()}`);
}

/**
 * @param {{ date: string, sectionId?: string, class?: string, section?: string }} query
 */
export async function getDailyAttendance(query) {
  const sectionId = await resolveQuerySectionId(query);
  if (!sectionId) {
    throw new Error('Section not found for the selected class/section');
  }
  const { date } = query;

  if (useMock()) {
    const key = dailyKey(sectionId, date);
    let marks = mockDailyStore.get(key);
    if (!marks) {
      const roster = mockStudentsForSection(sectionId);
      marks = roster.map((s, i) => ({
        studentId: String(s.id),
        rollNo: s.roll,
        name: s.name,
        status: mockDailyStatusForStudent(i, date),
      }));
      mockDailyStore.set(key, marks);
    }
    return { date, sectionId, marks, sentMessages: [] };
  }

  const params = new URLSearchParams({ date, sectionId });
  return apiFetch(`/api/attendance/daily?${params.toString()}`);
}

/**
 * Persist parent notifications for section/date (with initiated + submitted timestamps).
 * @param {{
 *   sectionId: string,
 *   date: string,
 *   initiatedAt?: string,
 *   channel?: 'whatsapp' | 'sms' | 'whatsapp_sms',
 *   recipient?: 'father' | 'mother' | 'both',
 *   messages: { studentId: string, status: string, message?: string }[],
 * }} body
 */
export async function submitParentMessages(body) {
  if (useMock()) {
    return {
      ok: true,
      date: body.date,
      sectionId: body.sectionId,
      recorded: body.messages?.length || 0,
      channel: body.channel || 'sms',
      recipient: body.recipient || 'father',
      sentMessages: (body.messages || []).map((m) => ({
        studentId: m.studentId,
        status: m.status,
        initiatedAt: body.initiatedAt || new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      })),
    };
  }

  return apiFetch('/api/attendance/parent-messages', { method: 'POST', json: body });
}

/**
 * @param {{ sectionId: string, date: string, marks: { studentId: string, status: string }[] }} body
 */
export async function saveDailyAttendance(body) {
  if (useMock()) {
    const key = dailyKey(body.sectionId, body.date);
    const existing = mockDailyStore.get(key) || [];
    const byId = Object.fromEntries(existing.map((m) => [m.studentId, m]));
    for (const mark of body.marks) {
      if (mark.status === 'P') {
        delete byId[mark.studentId];
      } else {
        byId[mark.studentId] = {
          ...(byId[mark.studentId] || { studentId: mark.studentId }),
          status: mark.status,
        };
      }
    }
    mockDailyStore.set(key, Object.values(byId));
    return { ok: true, date: body.date, sectionId: body.sectionId, updated: body.marks.length };
  }

  return apiFetch('/api/attendance/daily', { method: 'PUT', json: body });
}

/**
 * @param {{ date: string, sectionId?: string, class?: string, section?: string }} query
 */
export async function getPeriodAttendance(query) {
  const sectionId = await resolveQuerySectionId(query);
  if (!sectionId) {
    throw new Error('Section not found for the selected class/section');
  }
  const { date } = query;

  if (useMock()) {
    const key = dailyKey(sectionId, date);
    let stored = mockPeriodStore.get(key);
    if (!stored) {
      const grid = createSampleGrid(STUDENTS_PER_SECTION);
      const roster = mockStudentsForSection(sectionId);
      const marks = [];
      roster.forEach((s, i) => {
        for (let p = 1; p <= DAYWISE_PERIOD_COUNT; p++) {
          marks.push({
            studentId: String(s.id),
            periodNo: p,
            status: grid[i]?.[p - 1] ?? 'P',
            date,
          });
        }
      });
      stored = {
        date,
        sectionId,
        periodCount: DAYWISE_PERIOD_COUNT,
        marks,
        students: roster.map((s) => ({
          id: String(s.id),
          rollNo: s.roll,
          name: s.name,
        })),
      };
      mockPeriodStore.set(key, stored);
    }
    return stored;
  }

  const params = new URLSearchParams({ date, sectionId });
  return apiFetch(`/api/attendance/periods?${params.toString()}`);
}

/**
 * @param {{ sectionId: string, date: string, marks: { studentId: string, periodNo: number, status: string }[] }} body
 */
export async function savePeriodAttendance(body) {
  if (useMock()) {
    const key = dailyKey(body.sectionId, body.date);
    const roster = mockStudentsForSection(body.sectionId);
    const stored = mockPeriodStore.get(key) || {
      date: body.date,
      sectionId: body.sectionId,
      periodCount: DAYWISE_PERIOD_COUNT,
      marks: [],
      students: roster.map((s) => ({
        id: String(s.id),
        rollNo: s.roll,
        name: s.name,
      })),
    };
    const index = new Map(
      stored.marks.map((m) => [`${m.studentId}:${m.periodNo}`, m])
    );
    for (const mark of body.marks) {
      index.set(`${mark.studentId}:${mark.periodNo}`, {
        studentId: mark.studentId,
        periodNo: mark.periodNo,
        status: mark.status,
        date: body.date,
      });
    }
    stored.marks = [...index.values()];
    mockPeriodStore.set(key, stored);
    return { ok: true, date: body.date, sectionId: body.sectionId, updated: body.marks.length };
  }

  return apiFetch('/api/attendance/periods', { method: 'PUT', json: body });
}
