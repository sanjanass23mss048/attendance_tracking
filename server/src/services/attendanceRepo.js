import { prisma } from '../lib/prisma.js';
import {
  attendanceHeaderId,
  DAILY_SESSION,
  newId,
  periodFromSession,
  sectionIdFromAttendanceId,
  sessionForPeriod,
  toDateString,
} from '../lib/ids.js';
import {
  codeFromStatusId,
  getStatusMap,
  isPresentStatus,
  normalizeAppStatus,
  statusIdFromCode,
} from '../lib/statusMap.js';
import { listEnrollmentsForSection } from './schoolRepo.js';

async function ensureHeader(classSectionId, date, markedBy = null) {
  const dateStr = toDateString(date);
  const Attendance_id = attendanceHeaderId(classSectionId, dateStr);
  const existing = await prisma.tblAttendance.findUnique({ where: { Attendance_id } });
  if (existing) return existing;
  return prisma.tblAttendance.create({
    data: {
      Attendance_id,
      Attendance_Date: date,
      Attendance_Marked_By: markedBy,
    },
  });
}

async function resolveStatusId(code, { allowPresent = false } = {}) {
  const normalized = normalizeAppStatus(code);
  if (!allowPresent && isPresentStatus(normalized)) {
    throw new Error('Present status must not be stored');
  }
  const map = await getStatusMap();
  return map[normalized] || statusIdFromCode(normalized);
}

async function deleteDailyMark(attendanceId, studentId) {
  return prisma.tblStudentAtt_list.deleteMany({
    where: {
      Attendance_id: attendanceId,
      student_class_id: studentId,
      OR: [{ Session: DAILY_SESSION }, { Session: null }],
    },
  });
}

function dailyStatusCode(statusId) {
  const code = codeFromStatusId(statusId) || statusId;
  return isPresentStatus(code) ? null : code;
}

function mergeDailyRow(byStudent, row) {
  const code = dailyStatusCode(row.Status_id);
  if (!code) return;
  if (!byStudent.has(row.student_class_id) || row.Session === DAILY_SESSION) {
    byStudent.set(row.student_class_id, code);
  }
}

/**
 * Daily marks for a class-section on a date (Session = 'D').
 * Returns Map<student_class_id, appStatusCode>
 */
export async function getDailyMarks(classSectionId, date) {
  const dateStr = toDateString(date);
  const Attendance_id = attendanceHeaderId(classSectionId, dateStr);
  const rows = await prisma.tblStudentAtt_list.findMany({
    where: {
      Attendance_id,
      OR: [{ Session: DAILY_SESSION }, { Session: null }],
    },
    select: { student_class_id: true, Status_id: true, Session: true },
  });

  // Prefer explicit daily session over null if both exist; skip stored Present (legacy or new).
  const byStudent = new Map();
  for (const row of rows) {
    mergeDailyRow(byStudent, row);
  }
  return byStudent;
}

export async function upsertDailyMarks(classSectionId, date, marks, markedBy = null) {
  const header = await ensureHeader(classSectionId, date, markedBy);
  const results = [];

  for (const mark of marks) {
    const studentId = String(mark.studentId);
    const normalized = normalizeAppStatus(mark.status);

    if (isPresentStatus(normalized)) {
      const deleted = await deleteDailyMark(header.Attendance_id, studentId);
      if (deleted.count) results.push({ deleted: true, studentId });
      continue;
    }

    const Status_id = await resolveStatusId(normalized);
    const existing = await prisma.tblStudentAtt_list.findFirst({
      where: {
        Attendance_id: header.Attendance_id,
        student_class_id: studentId,
        OR: [{ Session: DAILY_SESSION }, { Session: null }],
      },
    });

    if (existing) {
      results.push(
        await prisma.tblStudentAtt_list.update({
          where: { SAL_id: existing.SAL_id },
          data: {
            Status_id,
            Session: DAILY_SESSION,
          },
        })
      );
    } else {
      results.push(
        await prisma.tblStudentAtt_list.create({
          data: {
            SAL_id: newId('SAL'),
            Attendance_id: header.Attendance_id,
            student_class_id: studentId,
            Status_id,
            Session: DAILY_SESSION,
          },
        })
      );
    }
  }

  return results;
}

/**
 * Period marks — Session holds period number as string.
 * Returns [{ studentId, periodNo, status, date }]
 */
export async function getPeriodMarks(classSectionId, date) {
  const dateStr = toDateString(date);
  const Attendance_id = attendanceHeaderId(classSectionId, dateStr);
  const rows = await prisma.tblStudentAtt_list.findMany({
    where: {
      Attendance_id,
      AND: [{ Session: { not: null } }, { Session: { not: DAILY_SESSION } }],
    },
    select: { student_class_id: true, Status_id: true, Session: true },
  });

  return rows
    .map((row) => {
      const periodNo = periodFromSession(row.Session);
      if (!periodNo) return null;
      return {
        studentId: row.student_class_id,
        periodNo,
        status: codeFromStatusId(row.Status_id) || row.Status_id,
        date: dateStr,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.studentId.localeCompare(b.studentId) || a.periodNo - b.periodNo);
}

export async function upsertPeriodMarks(classSectionId, date, marks, markedBy = null) {
  const header = await ensureHeader(classSectionId, date, markedBy);
  const results = [];

  for (const mark of marks) {
    const Session = sessionForPeriod(mark.periodNo);
    const Status_id = await resolveStatusId(mark.status, { allowPresent: true });
    const existing = await prisma.tblStudentAtt_list.findFirst({
      where: {
        Attendance_id: header.Attendance_id,
        student_class_id: mark.studentId,
        Session,
      },
    });

    if (existing) {
      results.push(
        await prisma.tblStudentAtt_list.update({
          where: { SAL_id: existing.SAL_id },
          data: { Status_id },
        })
      );
    } else {
      results.push(
        await prisma.tblStudentAtt_list.create({
          data: {
            SAL_id: newId('SAL'),
            Attendance_id: header.Attendance_id,
            student_class_id: mark.studentId,
            Status_id,
            Session,
          },
        })
      );
    }
  }

  return results;
}

/** School-wide daily summary counts (daily session only). */
export async function summarizeDailyMarks(date) {
  const dateStr = toDateString(date);
  const headers = await prisma.tblAttendance.findMany({
    where: { Attendance_Date: date },
    select: { Attendance_id: true },
  });
  if (!headers.length) {
    return { P: 0, A: 0, L: 0, H: 0, OH: 0, OF: 0, marked: 0 };
  }

  const rows = await prisma.tblStudentAtt_list.findMany({
    where: {
      Attendance_id: { in: headers.map((h) => h.Attendance_id) },
      OR: [{ Session: DAILY_SESSION }, { Session: null }],
    },
    select: { Status_id: true, Session: true, student_class_id: true, Attendance_id: true },
  });

  const marksByHeader = new Map();
  for (const row of rows) {
    const code = dailyStatusCode(row.Status_id);
    if (!code) continue;
    const key = row.Attendance_id;
    if (!marksByHeader.has(key)) marksByHeader.set(key, new Map());
    mergeDailyRow(marksByHeader.get(key), row);
  }

  const counts = { P: 0, A: 0, L: 0, H: 0, OH: 0, OF: 0 };
  let marked = 0;

  for (const header of headers) {
    const sectionId = sectionIdFromAttendanceId(header.Attendance_id, dateStr);
    if (!sectionId) continue;

    const students = await listEnrollmentsForSection(sectionId);
    const byStudent = marksByHeader.get(header.Attendance_id) || new Map();

    for (const student of students) {
      const code = byStudent.get(student.id);
      if (code && counts[code] != null) {
        counts[code] += 1;
      } else {
        counts.P += 1;
      }
      marked += 1;
    }
  }

  return {
    ...counts,
    marked,
  };
}

/** Fetch daily marks for student_class ids in a date range (for reports). */
export async function getDailyMarksInRange(studentClassIds, start, end) {
  if (!studentClassIds.length) return [];

  const headers = await prisma.tblAttendance.findMany({
    where: { Attendance_Date: { gte: start, lte: end } },
    select: { Attendance_id: true, Attendance_Date: true },
  });
  if (!headers.length) return [];

  const headerDate = Object.fromEntries(
    headers.map((h) => [h.Attendance_id, toDateString(h.Attendance_Date)])
  );

  const rows = await prisma.tblStudentAtt_list.findMany({
    where: {
      Attendance_id: { in: headers.map((h) => h.Attendance_id) },
      student_class_id: { in: studentClassIds },
      OR: [{ Session: DAILY_SESSION }, { Session: null }],
    },
    select: { Attendance_id: true, student_class_id: true, Status_id: true, Session: true },
  });

  const byKey = new Map();
  for (const row of rows) {
    const status = dailyStatusCode(row.Status_id);
    if (!status) continue;
    const key = `${row.Attendance_id}:${row.student_class_id}`;
    const prev = byKey.get(key);
    if (!prev || (prev.session !== DAILY_SESSION && row.Session === DAILY_SESSION)) {
      byKey.set(key, {
        studentId: row.student_class_id,
        date: headerDate[row.Attendance_id],
        status,
        session: row.Session,
      });
    }
  }
  return [...byKey.values()].map(({ studentId, date, status }) => ({
    studentId,
    date,
    status,
  }));
}

/**
 * Count days in range that have a daily attendance header for this class-section.
 * Used so monthly reports can treat unmarked students as Present on those days.
 */
export async function countAttendanceDaysForSection(classSectionId, start, end) {
  if (!classSectionId) return 0;
  return prisma.tblAttendance.count({
    where: {
      Attendance_Date: { gte: start, lte: end },
      Attendance_id: { endsWith: `-${classSectionId}` },
    },
  });
}

/** Remove legacy daily Present rows (Session D or null). Safe to run once after deploy. */
export async function cleanupStoredPresentDailyMarks() {
  return prisma.tblStudentAtt_list.deleteMany({
    where: {
      Status_id: 'P',
      OR: [{ Session: DAILY_SESSION }, { Session: null }],
    },
  });
}
