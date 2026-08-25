import { prisma } from '../lib/prisma.js';
import { toDateString, fullName, parseDateOnly } from '../lib/ids.js';
import { getDailyMarksInRange } from './attendanceRepo.js';
import {
  DEFAULT_INTELLIGENCE_THRESHOLDS,
  getIntelligenceThresholds,
} from '../lib/attendanceIntelligenceConfig.js';
import {
  buildDemoAttendanceIntelligence,
} from '../lib/attendanceIntelligenceDemo.js';
import { ensureAttendanceIntelligenceTables } from '../lib/ensureAttendanceIntelligenceTables.js';
import { listMeetings, meetingCounts, enrichMeetingsWithStudents } from './attendanceMeetingRepo.js';

const ABSENT_LIKE = new Set(['A']);
const HALF_LIKE = new Set(['H', 'OH']);
const PRESENT_LIKE = new Set(['P', 'L', 'OF']); // OF counts as present for % purposes in many schools; treat as not absent

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

function todayIso() {
  return toDateString(new Date());
}

function weekdayMon0(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.getDay(); // 0 Sun … 5 Fri 6 Sat
}

function isMonOrFri(iso) {
  const w = weekdayMon0(iso);
  return w === 1 || w === 5;
}

function pct(presentish, total) {
  if (!total) return null;
  return Math.round((presentish / total) * 1000) / 10;
}

function buildStudentDayMap(marks) {
  const byStudent = new Map();
  for (const m of marks) {
    if (!byStudent.has(m.studentId)) byStudent.set(m.studentId, new Map());
    byStudent.get(m.studentId).set(m.date, m.status);
  }
  return byStudent;
}

function consecutiveAbsentEnding(dayMap, asOf) {
  let count = 0;
  let cursor = asOf;
  for (let i = 0; i < 60; i += 1) {
    const status = dayMap.get(cursor);
    if (!status) {
      // no mark that day — stop streak (weekend/holiday unmarked)
      break;
    }
    if (ABSENT_LIKE.has(status)) {
      count += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }
  return count;
}

function lastAttended(dayMap, asOf) {
  let cursor = asOf;
  for (let i = 0; i < 120; i += 1) {
    const status = dayMap.get(cursor);
    if (status && !ABSENT_LIKE.has(status)) return cursor;
    cursor = addDays(cursor, -1);
  }
  return null;
}

function windowStats(dayMap, start, end) {
  let absent = 0;
  let half = 0;
  let presentish = 0;
  let marked = 0;
  let monFriAbsent = 0;
  const cursorStart = start;
  let cursor = end;
  // iterate known marked days only
  for (const [date, status] of dayMap.entries()) {
    if (date < start || date > end) continue;
    marked += 1;
    if (ABSENT_LIKE.has(status)) {
      absent += 1;
      if (isMonOrFri(date)) monFriAbsent += 1;
    } else if (HALF_LIKE.has(status)) {
      half += 1;
      presentish += 0.5;
    } else {
      presentish += 1;
    }
  }
  return { absent, half, presentish, marked, monFriAbsent, start: cursorStart, end };
}

async function loadActiveEnrollments() {
  const rows = await prisma.tblStudent_Class.findMany({
    where: { Int_Status: 1 },
    include: {
      tblStudents: true,
      tblClass_Section: { include: { tblClass: true, tblSection: true } },
    },
  });
  return rows
    .filter((sc) => sc.tblStudents?.Int_Status !== 0)
    .map((sc) => ({
      studentClassId: sc.student_class_id,
      studentRecordId: sc.Student_id,
      name: fullName(sc.tblStudents?.First_Name, sc.tblStudents?.Last_Name) || 'Student',
      className: sc.tblClass_Section?.tblClass?.Class_Name || '',
      sectionName: sc.tblClass_Section?.tblSection?.Section_Name || '',
      rollNo: sc.Roll_No || '',
      fatherName: sc.tblStudents?.Father_Name || '',
      motherName: sc.tblStudents?.Mother_Name || '',
      guardianName: sc.tblStudents?.Guardian_Name || '',
      fatherPhone: sc.tblStudents?.Father_Number || '',
      motherPhone: sc.tblStudents?.Mother_Number || '',
      classSectionId: sc.class_section_id,
    }));
}

async function parentInformedSet(studentClassIds, sinceIso) {
  if (!studentClassIds.length) return new Set();
  const since = parseDateOnly(sinceIso);
  const rows = await prisma.tblParent_Attendance_Messages.findMany({
    where: {
      Student_Class_id: { in: studentClassIds },
      Attendance_Date: { gte: since },
      Int_Status: { not: 0 },
    },
    select: { Student_Class_id: true },
    distinct: ['Student_Class_id'],
  });
  return new Set(rows.map((r) => r.Student_Class_id));
}

async function leaveLetterCoverage(studentRecordIds) {
  if (!studentRecordIds.length) return new Map();
  const docs = await prisma.tblDocuments.findMany({
    where: {
      Entity_Type: 'student',
      Entity_Id: { in: studentRecordIds },
      Int_Status: { not: 0 },
      OR: [
        { Document_Type: { in: ['leave_letter', 'medical_leave', 'od_letter'] } },
        { Leave_From: { not: null } },
      ],
    },
    select: { Entity_Id: true, Leave_From: true, Leave_To: true },
  });
  const byStudent = new Map();
  for (const d of docs) {
    if (!byStudent.has(d.Entity_Id)) byStudent.set(d.Entity_Id, []);
    byStudent.get(d.Entity_Id).push({
      from: toDateString(d.Leave_From),
      to: toDateString(d.Leave_To) || toDateString(d.Leave_From),
    });
  }
  return byStudent;
}

function hasLeaveCover(ranges, date) {
  if (!ranges?.length) return false;
  return ranges.some((r) => r.from && date >= r.from && date <= (r.to || r.from));
}

/**
 * Core intelligence scan — long absences, patterns, dashboard summary.
 * Returns live school data only. Demo/walkthrough only when forceDemo or env flag.
 */
export async function buildAttendanceIntelligence({ asOf = todayIso(), forceDemo = false } = {}) {
  const demoAsOf = asOf || todayIso();
  let thresholds = DEFAULT_INTELLIGENCE_THRESHOLDS;
  try {
    thresholds = await getIntelligenceThresholds();
  } catch (err) {
    console.warn('intelligence thresholds fallback', err?.message || err);
  }

  if (forceDemo || process.env.ATTENDANCE_INTELLIGENCE_DEMO === '1') {
    return buildDemoAttendanceIntelligence(demoAsOf, thresholds);
  }

  // Tenant DBs (e.g. st-joseph) are not covered by apex-only startup DDL.
  await ensureAttendanceIntelligenceTables();

  const enrollments = await loadActiveEnrollments();
  const ids = enrollments.map((e) => e.studentClassId);
  const lookbackStart = addDays(demoAsOf, -180);
  const start30 = addDays(demoAsOf, -29);
  const months = Math.max(1, thresholds.pctDropLookbackMonths);
  const olderEnd = addDays(demoAsOf, -Math.round(months * 30));
  const olderStart = addDays(olderEnd, -Math.round(months * 30) + 1);

  const marks = ids.length
    ? await getDailyMarksInRange(ids, parseDateOnly(lookbackStart), parseDateOnly(demoAsOf))
    : [];
  const byStudent = buildStudentDayMap(marks);
  const informed = await parentInformedSet(ids, start30);
  const leaveByRecord = await leaveLetterCoverage(
    [...new Set(enrollments.map((e) => e.studentRecordId).filter(Boolean))]
  );

  const longAbsences = [];
  const patterns = [];

  for (const en of enrollments) {
    const dayMap = byStudent.get(en.studentClassId) || new Map();
    const streak = consecutiveAbsentEnding(dayMap, demoAsOf);
    const last30 = windowStats(dayMap, start30, demoAsOf);
    const recentWindow = windowStats(dayMap, olderEnd, demoAsOf);
    const priorWindow = windowStats(dayMap, olderStart, addDays(olderEnd, -1));
    const recentPct = pct(recentWindow.presentish, recentWindow.marked);
    const priorPct = pct(priorWindow.presentish, priorWindow.marked);
    const drop =
      recentPct != null && priorPct != null ? Math.round((priorPct - recentPct) * 10) / 10 : 0;

    let uncoveredAbsences = 0;
    for (const [date, status] of dayMap.entries()) {
      if (date < start30 || date > demoAsOf) continue;
      if (!ABSENT_LIKE.has(status)) continue;
      if (!hasLeaveCover(leaveByRecord.get(en.studentRecordId), date)) uncoveredAbsences += 1;
    }

    const reasons = [];
    let severity = 'watch';

    if (streak >= thresholds.consecutiveAbsentDays) {
      reasons.push(`Absent for ${streak} consecutive days`);
      severity = streak >= thresholds.consecutiveAbsentDays + 2 ? 'critical' : 'high';
    }
    if (last30.absent >= thresholds.absentDaysIn30) {
      reasons.push(`${last30.absent} absent days in the last 30 days`);
      if (severity === 'watch') severity = 'high';
    }
    if (last30.half >= thresholds.halfDayDaysIn30) {
      reasons.push(`${last30.half} half-days / OD half-days in the last 30 days`);
      if (severity === 'watch') severity = 'medium';
    }
    if (last30.monFriAbsent >= thresholds.mondayFridayMinAbsences) {
      reasons.push(`${last30.monFriAbsent} Monday/Friday absences in the last 30 days`);
      if (severity === 'watch') severity = 'medium';
    }
    if (
      priorPct != null &&
      recentPct != null &&
      drop >= thresholds.pctDropThreshold &&
      priorWindow.marked >= 5 &&
      recentWindow.marked >= 5
    ) {
      reasons.push(`Attendance dropped from ${priorPct}% → ${recentPct}% in ~${months} months`);
      if (severity === 'watch') severity = 'high';
    }
    if (uncoveredAbsences >= thresholds.leaveWithoutLetterMin) {
      reasons.push(`${uncoveredAbsences} absences without a leave letter (30 days)`);
      if (severity === 'watch') severity = 'medium';
    }
    if (last30.absent >= thresholds.highRiskAbsentIn30) {
      severity = 'critical';
    }

    const base = {
      studentClassId: en.studentClassId,
      studentRecordId: en.studentRecordId,
      name: en.name,
      className: en.className,
      sectionName: en.sectionName,
      classLabel: [en.className, en.sectionName].filter(Boolean).join('-'),
      rollNo: en.rollNo,
      fatherName: en.fatherName || '',
      motherName: en.motherName || '',
      guardianName: en.guardianName || '',
      lastAttended: lastAttended(dayMap, demoAsOf),
      consecutiveAbsent: streak,
      absentIn30: last30.absent,
      halfIn30: last30.half,
      monFriAbsentIn30: last30.monFriAbsent,
      attendancePct30: pct(last30.presentish, last30.marked),
      attendancePctRecent: recentPct,
      attendancePctPrior: priorPct,
      pctDrop: drop,
      parentInformed: informed.has(en.studentClassId),
      uncoveredAbsences,
      severity,
      reasons,
    };

    if (streak >= thresholds.consecutiveAbsentDays || last30.absent >= thresholds.absentDaysIn30) {
      longAbsences.push({
        ...base,
        headline:
          streak >= thresholds.consecutiveAbsentDays
            ? `Absent for ${streak} consecutive days`
            : `${last30.absent} absences in the last 30 days`,
        meetingRequired: severity === 'critical' || severity === 'high',
      });
    }

    if (reasons.length) {
      const risk =
        severity === 'critical' || last30.absent >= thresholds.highRiskAbsentIn30
          ? 'High'
          : severity === 'high'
            ? 'Medium'
            : 'Watch';
      patterns.push({
        ...base,
        risk,
        summary: reasons.slice(0, 3),
      });
    }
  }

  const sevRank = { critical: 0, high: 1, medium: 2, watch: 3 };
  longAbsences.sort(
    (a, b) =>
      (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9) ||
      b.consecutiveAbsent - a.consecutiveAbsent ||
      b.absentIn30 - a.absentIn30
  );
  patterns.sort(
    (a, b) =>
      (a.risk === 'High' ? 0 : a.risk === 'Medium' ? 1 : 2) -
        (b.risk === 'High' ? 0 : b.risk === 'Medium' ? 1 : 2) ||
      b.absentIn30 - a.absentIn30
  );

  const meetings = await enrichMeetingsWithStudents(await listMeetings({}));
  const mCounts = await meetingCounts();
  const immediate = longAbsences.filter((a) => a.severity === 'critical' || a.severity === 'high');
  const highRiskPatterns = patterns.filter((p) => p.risk === 'High');

  const patternCategories = [
    {
      key: 'monFri',
      label: 'Repeated Monday/Friday Absence',
      count: patterns.filter((p) => p.monFriAbsentIn30 >= thresholds.mondayFridayMinAbsences).length,
      color: '#6366f1',
    },
    {
      key: 'half',
      label: 'Frequent Half Days',
      count: patterns.filter((p) => p.halfIn30 >= thresholds.halfDayDaysIn30).length,
      color: '#f59e0b',
    },
    {
      key: 'streak',
      label: 'Consecutive Absence',
      count: patterns.filter((p) => p.consecutiveAbsent >= thresholds.consecutiveAbsentDays).length,
      color: '#ef4444',
    },
    {
      key: 'drop',
      label: 'Falling Attendance %',
      count: patterns.filter((p) => (p.pctDrop || 0) >= thresholds.pctDropThreshold).length,
      color: '#8b5cf6',
    },
    {
      key: 'noLetter',
      label: 'Leave without letter',
      count: patterns.filter((p) => (p.uncoveredAbsences || 0) >= thresholds.leaveWithoutLetterMin)
        .length,
      color: '#14b8a6',
    },
  ].filter((c) => c.count > 0);

  // School-wide monthly attendance % for last 6 calendar months
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i -= 1) {
    const ref = new Date(`${demoAsOf}T12:00:00`);
    ref.setDate(1);
    ref.setMonth(ref.getMonth() - i);
    const y = ref.getFullYear();
    const m = ref.getMonth();
    const start = toDateString(new Date(Date.UTC(y, m, 1)));
    const endDate = new Date(Date.UTC(y, m + 1, 0));
    const end = toDateString(endDate);
    let presentish = 0;
    let marked = 0;
    for (const mark of marks) {
      if (mark.date < start || mark.date > end) continue;
      marked += 1;
      if (ABSENT_LIKE.has(mark.status)) continue;
      if (HALF_LIKE.has(mark.status)) presentish += 0.5;
      else presentish += 1;
    }
    monthlyTrend.push({
      month: ref.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      pct: marked ? Math.round((presentish / marked) * 1000) / 10 : null,
    });
  }
  const currentMonthPct = monthlyTrend[monthlyTrend.length - 1]?.pct;
  const prevMonthPct = monthlyTrend[monthlyTrend.length - 2]?.pct;
  const monthDelta =
    currentMonthPct != null && prevMonthPct != null
      ? Math.round((currentMonthPct - prevMonthPct) * 10) / 10
      : null;

  return {
    demo: false,
    walkthrough: false,
    asOf: demoAsOf,
    thresholds,
    enrollmentCount: enrollments.length,
    markCount: marks.length,
    summary: {
      longAbsentees: {
        total: longAbsences.length,
        immediate: immediate.length,
      },
      meetings: {
        today: mCounts.today || 0,
        followups: mCounts.followups || 0,
        open: mCounts.open || 0,
      },
      patterns: {
        flagged: patterns.length,
        highRisk: highRiskPatterns.length,
      },
      followUps: {
        total: meetings.filter(
          (m) =>
            m.status === 'Follow-up Required' ||
            (m.followUpDate && m.status !== 'Closed' && m.followUpDate <= addDays(demoAsOf, 7))
        ).length,
      },
      overallPct: currentMonthPct,
      monthDelta,
    },
    patternCategories,
    monthlyTrend,
    longAbsences,
    patterns,
    meetings,
    followUps: meetings.filter(
      (m) =>
        m.status === 'Follow-up Required' ||
        (m.followUpDate && m.status !== 'Closed' && m.followUpDate <= addDays(demoAsOf, 7))
    ),
  };
}

export async function buildStudentTimeline(studentClassId, { days = 90 } = {}) {
  const asOf = todayIso();
  const start = addDays(asOf, -(days - 1));
  const enrollment = await prisma.tblStudent_Class.findUnique({
    where: { student_class_id: studentClassId },
    include: {
      tblStudents: true,
      tblClass_Section: { include: { tblClass: true, tblSection: true } },
    },
  });
  if (!enrollment) return null;

  const marks = await getDailyMarksInRange(
    [studentClassId],
    parseDateOnly(start),
    parseDateOnly(asOf)
  );
  const events = marks.map((m) => ({
    date: m.date,
    type: 'attendance',
    status: m.status,
    label:
      m.status === 'A'
        ? 'Absent'
        : m.status === 'P'
          ? 'Present'
          : m.status === 'L'
            ? 'Late'
            : m.status === 'H'
              ? 'Half Day'
              : m.status === 'OH'
                ? 'OD – Half Day'
                : m.status === 'OF'
                  ? 'OD – Full Day'
                  : m.status,
  }));

  const docs = await prisma.tblDocuments.findMany({
    where: {
      Entity_Type: 'student',
      Entity_Id: enrollment.Student_id,
      Int_Status: { not: 0 },
    },
    orderBy: { Created_On: 'desc' },
    take: 50,
  });
  for (const d of docs) {
    events.push({
      date: toDateString(d.Leave_From) || toDateString(d.Created_On),
      type: 'leave',
      label: `Leave letter${d.Reason ? `: ${d.Reason}` : ''}`,
      status: d.Status,
      meta: { to: toDateString(d.Leave_To), documentId: d.Document_id },
    });
  }

  const messages = await prisma.tblParent_Attendance_Messages.findMany({
    where: {
      Student_Class_id: studentClassId,
      Attendance_Date: { gte: parseDateOnly(start) },
    },
    orderBy: { Attendance_Date: 'desc' },
    take: 50,
  });
  for (const msg of messages) {
    events.push({
      date: toDateString(msg.Attendance_Date),
      type: 'parent_contact',
      label: 'Parent contacted',
      status: msg.Status,
    });
  }

  const meetings = await listMeetings({ studentClassId });
  for (const m of meetings) {
    events.push({
      date: m.meetingDate,
      type: 'meeting',
      label: `Meeting (${m.status}) — ${m.reason}`,
      status: m.status,
      meta: { id: m.id, followUpDate: m.followUpDate },
    });
    if (m.followUpDate) {
      events.push({
        date: m.followUpDate,
        type: 'followup',
        label: 'Follow-up required',
        status: m.status,
        meta: { meetingId: m.id },
      });
    }
  }

  const { listNotes } = await import('./attendanceMeetingRepo.js');
  const notes = await listNotes(studentClassId);
  for (const n of notes) {
    events.push({
      date: toDateString(n.createdOn),
      type: 'note',
      label: n.text,
      status: null,
      meta: { id: n.id, by: n.createdByName },
    });
  }

  events.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return {
    student: {
      studentClassId,
      studentRecordId: enrollment.Student_id,
      name: fullName(enrollment.tblStudents?.First_Name, enrollment.tblStudents?.Last_Name),
      className: enrollment.tblClass_Section?.tblClass?.Class_Name || '',
      sectionName: enrollment.tblClass_Section?.tblSection?.Section_Name || '',
      rollNo: enrollment.Roll_No || '',
    },
    events,
  };
}

function resolveParentNameFromStudent(st) {
  return (
    st?.fatherName ||
    st?.motherName ||
    st?.guardianName ||
    st?.parentName ||
    'Parent'
  );
}

function resolveStaffName(user) {
  return user?.name || user?.displayName || user?.email?.split('@')[0] || 'Principal';
}

/**
 * Prefill parent/staff names for the schedule-meeting form when alert rows lack them.
 */
export async function getMeetingPrefill(studentClassId, user) {
  const enrollment = await prisma.tblStudent_Class.findUnique({
    where: { student_class_id: studentClassId },
    include: {
      tblStudents: true,
      tblClass_Section: { include: { tblClass: true, tblSection: true } },
    },
  });
  if (!enrollment || enrollment.Int_Status === 0 || enrollment.tblStudents?.Int_Status === 0) {
    return null;
  }

  let staffName = resolveStaffName(user);
  if (!staffName || staffName === 'Principal') {
    const staffId = user?.id || user?.sub;
    if (staffId) {
      const staffUser = await prisma.tblUsers.findUnique({
        where: { user_id: staffId },
        select: { name: true, email: true },
      });
      if (staffUser?.name) staffName = staffUser.name;
      else if (staffUser?.email) staffName = staffUser.email.split('@')[0];
    }
  }

  const student = {
    studentClassId: enrollment.student_class_id,
    studentRecordId: enrollment.Student_id,
    name: fullName(enrollment.tblStudents?.First_Name, enrollment.tblStudents?.Last_Name) || 'Student',
    className: enrollment.tblClass_Section?.tblClass?.Class_Name || '',
    sectionName: enrollment.tblClass_Section?.tblSection?.Section_Name || '',
    rollNo: enrollment.Roll_No || '',
    fatherName: enrollment.tblStudents?.Father_Name || '',
    motherName: enrollment.tblStudents?.Mother_Name || '',
    guardianName: enrollment.tblStudents?.Guardian_Name || '',
  };

  return {
    parentName: resolveParentNameFromStudent(student),
    staffName,
    student,
  };
}
