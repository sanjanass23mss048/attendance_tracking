import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { DEFAULT_PERIOD_COUNT, parseDateOnly } from '../lib/ids.js';
import { isAppStatus } from '../lib/statusMap.js';
import {
  getDailyMarks,
  getPeriodMarks,
  summarizeDailyMarks,
  upsertDailyMarks,
  upsertPeriodMarks,
} from '../services/attendanceRepo.js';
import {
  listParentMessages,
  recordParentMessages,
} from '../services/parentMessageRepo.js';
import {
  assertEnrollmentsInSection,
  canAccessSection,
  findClassSectionById,
  listEnrollmentsForSection,
} from '../services/schoolRepo.js';
import { prisma } from '../lib/prisma.js';
import { emitAttendanceUpdated } from '../lib/realtime.js';
import {
  isPastAttendanceDate,
  canBypassEditLock,
} from '../lib/attendanceEditRules.js';
import {
  findActiveEditPermission,
  markRequestUsed,
} from '../services/editRequestRepo.js';
import { writeAttendanceAuditLogs } from '../services/attendanceAuditRepo.js';
import { attendanceHeaderId } from '../lib/ids.js';

const router = Router();

async function forbidUnlessSectionAccess(req, res, classSectionId) {
  const ok = await canAccessSection(req.user?.sub, req.user?.role, classSectionId);
  if (!ok) {
    res.status(403).json({
      error: 'You do not have access to this class. Contact the attendance in-charge.',
      code: 'SECTION_FORBIDDEN',
    });
    return false;
  }
  return true;
}

const statusEnum = z.enum(['P', 'A', 'L', 'H', 'OH', 'OF', 'O']);

const getQuerySchema = z.object({
  date: z.string(),
  sectionId: z.string().min(1),
});

const dailyPutSchema = z.object({
  sectionId: z.string().min(1),
  date: z.string(),
  marks: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: statusEnum,
      })
    )
    .default([]),
});

const periodPutSchema = z.object({
  sectionId: z.string().min(1),
  date: z.string(),
  marks: z
    .array(
      z.object({
        studentId: z.string().min(1),
        periodNo: z.number().int().positive(),
        status: statusEnum,
      })
    )
    .min(1),
});

const parentMessagesPutSchema = z.object({
  sectionId: z.string().min(1),
  date: z.string(),
  initiatedAt: z.string().datetime().optional(),
  messages: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: statusEnum,
        message: z.string().optional(),
      })
    )
    .min(1),
});

router.get('/summary', requireAuth, async (req, res) => {
  const dateStr = typeof req.query.date === 'string' ? req.query.date : null;
  if (!dateStr) {
    return res.status(400).json({ error: 'date query (YYYY-MM-DD) is required' });
  }
  const date = parseDateOnly(dateStr);
  if (!date) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const [totalClasses, totalSections, totalStudents, counts] = await Promise.all([
    prisma.tblClass.count(),
    prisma.tblClass_Section.count({ where: { int_status: 1 } }),
    prisma.tblStudent_Class.count({ where: { Int_Status: { not: 0 } } }),
    summarizeDailyMarks(date),
  ]);

  const marked = counts.marked;
  const attendancePercent = marked ? Math.round((counts.P / marked) * 100) : 0;

  return res.json({
    date: dateStr,
    totalClasses,
    totalSections,
    totalStudents,
    marked,
    present: counts.P,
    absent: counts.A,
    late: counts.L,
    halfDay: counts.H,
    odHalfDay: counts.OH,
    odFullDay: counts.OF,
    attendancePercent,
  });
});

router.get('/daily', requireAuth, async (req, res) => {
  const parsed = getQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const date = parseDateOnly(parsed.data.date);
  if (!date) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const section = await findClassSectionById(parsed.data.sectionId);
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }
  if (!(await forbidUnlessSectionAccess(req, res, section.Class_Section_id))) return;

  const students = await listEnrollmentsForSection(section.Class_Section_id);
  const byStudent = await getDailyMarks(section.Class_Section_id, date);
  const sentMessages = await listParentMessages(section.Class_Section_id, date);

  return res.json({
    date: parsed.data.date,
    sectionId: section.Class_Section_id,
    marks: students.map((s) => ({
      studentId: s.id,
      rollNo: s.rollNo,
      name: s.name,
      status: byStudent.get(s.id) ?? null,
    })),
    sentMessages,
  });
});

router.put('/daily', requireAuth, async (req, res) => {
  const parsed = dailyPutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  const date = parseDateOnly(parsed.data.date);
  if (!date) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const section = await findClassSectionById(parsed.data.sectionId);
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }
  if (!(await forbidUnlessSectionAccess(req, res, section.Class_Section_id))) return;

  const studentIds = parsed.data.marks.map((m) => m.studentId);
  const ok = await assertEnrollmentsInSection(section.Class_Section_id, studentIds);
  if (!ok) {
    return res.status(400).json({ error: 'One or more students do not belong to this section' });
  }

  for (const m of parsed.data.marks) {
    if (!isAppStatus(m.status)) {
      return res.status(400).json({ error: `Invalid status: ${m.status}` });
    }
  }

  // Expand to full section roster. Present is implied by deleting any stored mark;
  // only non-P statuses are persisted.
  const enrollments = await listEnrollmentsForSection(section.Class_Section_id);
  const byId = new Map(
    parsed.data.marks.map((m) => [String(m.studentId), m.status])
  );
  const fullMarks = enrollments.map((s) => {
    const id = String(s.id);
    return {
      studentId: id,
      status: byId.get(id) || 'P',
    };
  });

  const dateStr = parsed.data.date;
  const role = String(req.user?.role || '').toUpperCase();
  let activePermission = null;

  if (isPastAttendanceDate(dateStr) && !canBypassEditLock(role)) {
    activePermission = await findActiveEditPermission({
      teacherId: req.user.sub,
      classSectionId: section.Class_Section_id,
      attendanceDate: date,
    });
    if (!activePermission) {
      return res.status(403).json({
        error:
          'Previous-day attendance is locked. Submit an edit request and wait for approval before saving changes.',
        code: 'ATTENDANCE_LOCKED',
      });
    }
  }

  // getDailyMarks returns Map<studentId, statusCode> (not an array)
  const existingByStudent = await getDailyMarks(section.Class_Section_id, date);
  const oldByStudent = new Map(
    [...existingByStudent.entries()].map(([id, status]) => [String(id), status])
  );

  await upsertDailyMarks(
    section.Class_Section_id,
    date,
    fullMarks,
    req.user?.sub || null
  );

  const attendanceId = attendanceHeaderId(section.Class_Section_id, dateStr);
  const auditEntries = [];
  for (const m of fullMarks) {
    const oldStatus = oldByStudent.get(String(m.studentId)) || 'P';
    const newStatus = m.status || 'P';
    if (oldStatus === newStatus) continue;
    auditEntries.push({
      attendanceId,
      studentClassId: m.studentId,
      oldStatus,
      newStatus,
      changedBy: req.user?.sub || 'unknown',
      approvedBy: activePermission?.Approver_id || null,
      requestId: activePermission?.Request_id || null,
      reason: activePermission ? 'Approved attendance edit' : null,
    });
  }
  if (auditEntries.length) {
    await writeAttendanceAuditLogs(auditEntries);
  }

  if (activePermission) {
    await markRequestUsed(activePermission.Request_id);
  }

  emitAttendanceUpdated({
    sectionId: section.Class_Section_id,
    date: parsed.data.date,
    type: 'daily',
  });

  return res.json({
    ok: true,
    date: parsed.data.date,
    sectionId: section.Class_Section_id,
    updated: fullMarks.length,
    requestUsed: Boolean(activePermission),
  });
});

router.get('/periods', requireAuth, async (req, res) => {
  const parsed = getQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const date = parseDateOnly(parsed.data.date);
  if (!date) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const section = await findClassSectionById(parsed.data.sectionId);
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }
  if (!(await forbidUnlessSectionAccess(req, res, section.Class_Section_id))) return;

  const students = await listEnrollmentsForSection(section.Class_Section_id);
  const marks = await getPeriodMarks(section.Class_Section_id, date);

  return res.json({
    date: parsed.data.date,
    sectionId: section.Class_Section_id,
    periodCount: DEFAULT_PERIOD_COUNT,
    marks,
    students: students.map((s) => ({
      id: s.id,
      rollNo: s.rollNo,
      name: s.name,
    })),
  });
});

router.put('/periods', requireAuth, async (req, res) => {
  const parsed = periodPutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  const date = parseDateOnly(parsed.data.date);
  if (!date) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const section = await findClassSectionById(parsed.data.sectionId);
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }
  if (!(await forbidUnlessSectionAccess(req, res, section.Class_Section_id))) return;

  const studentIds = parsed.data.marks.map((m) => m.studentId);
  const ok = await assertEnrollmentsInSection(section.Class_Section_id, studentIds);
  if (!ok) {
    return res.status(400).json({ error: 'One or more students do not belong to this section' });
  }

  const invalidPeriod = parsed.data.marks.find(
    (m) => m.periodNo < 1 || m.periodNo > DEFAULT_PERIOD_COUNT
  );
  if (invalidPeriod) {
    return res.status(400).json({
      error: `periodNo must be between 1 and ${DEFAULT_PERIOD_COUNT}`,
    });
  }

  const dateStr = parsed.data.date;
  const role = String(req.user?.role || '').toUpperCase();
  let activePermission = null;
  if (isPastAttendanceDate(dateStr) && !canBypassEditLock(role)) {
    activePermission = await findActiveEditPermission({
      teacherId: req.user.sub,
      classSectionId: section.Class_Section_id,
      attendanceDate: date,
    });
    if (!activePermission) {
      return res.status(403).json({
        error:
          'Previous-day attendance is locked. Submit an edit request and wait for approval before saving changes.',
        code: 'ATTENDANCE_LOCKED',
      });
    }
  }

  await upsertPeriodMarks(
    section.Class_Section_id,
    date,
    parsed.data.marks,
    req.user?.sub || null
  );

  if (activePermission) {
    await markRequestUsed(activePermission.Request_id);
  }

  emitAttendanceUpdated({
    sectionId: section.Class_Section_id,
    date: parsed.data.date,
    type: 'periods',
  });

  return res.json({
    ok: true,
    date: parsed.data.date,
    sectionId: section.Class_Section_id,
    updated: parsed.data.marks.length,
    requestUsed: Boolean(activePermission),
  });
});

/** Record parent notifications submitted for this section/date. */
router.post('/parent-messages', requireAuth, async (req, res) => {
  const parsed = parentMessagesPutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  const date = parseDateOnly(parsed.data.date);
  if (!date) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const section = await findClassSectionById(parsed.data.sectionId);
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }
  if (!(await forbidUnlessSectionAccess(req, res, section.Class_Section_id))) return;

  const studentIds = parsed.data.messages.map((m) => m.studentId);
  const ok = await assertEnrollmentsInSection(section.Class_Section_id, studentIds);
  if (!ok) {
    return res.status(400).json({ error: 'One or more students do not belong to this section' });
  }

  // Present is never messaged to parents.
  const messages = parsed.data.messages.filter((m) => m.status !== 'P');
  if (!messages.length) {
    return res.status(400).json({ error: 'No notifiable statuses to record (Present is skipped)' });
  }

  let initiatedAt = null;
  if (parsed.data.initiatedAt) {
    initiatedAt = new Date(parsed.data.initiatedAt);
  }

  const saved = await recordParentMessages({
    classSectionId: section.Class_Section_id,
    date,
    dateStr: parsed.data.date,
    messages,
    sentBy: req.user?.sub || null,
    initiatedAt,
  });

  const sentMessages = await listParentMessages(section.Class_Section_id, date);

  return res.json({
    ok: true,
    date: parsed.data.date,
    sectionId: section.Class_Section_id,
    recorded: saved.length,
    sentMessages,
  });
});

router.get('/parent-messages', requireAuth, async (req, res) => {
  const parsed = getQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const date = parseDateOnly(parsed.data.date);
  if (!date) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const section = await findClassSectionById(parsed.data.sectionId);
  if (!section) {
    return res.status(404).json({ error: 'Section not found' });
  }
  if (!(await forbidUnlessSectionAccess(req, res, section.Class_Section_id))) return;

  const sentMessages = await listParentMessages(section.Class_Section_id, date);
  return res.json({
    date: parsed.data.date,
    sectionId: section.Class_Section_id,
    sentMessages,
  });
});

export default router;
