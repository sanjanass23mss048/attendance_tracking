import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { DEFAULT_PERIOD_COUNT, parseDateOnly } from '../lib/ids.js';
import { attendancePercentFromCounts } from '../lib/attendancePercent.js';
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
  hasParentMessages,
} from '../services/parentMessageRepo.js';
import {
  assertEnrollmentsInSection,
  canAccessSection,
  findClassSectionById,
  listEnrollmentsForSection,
} from '../services/schoolRepo.js';
import { prisma } from '../lib/prisma.js';
import { emitAttendanceUpdated } from '../lib/realtime.js';
import { isNonWorkingDate } from '../lib/nonWorkingDays.js';
import {
  isPastAttendanceDate,
  attendanceLockedMessage,
} from '../lib/attendanceEditRules.js';
import {
  findActiveEditPermission,
  markRequestUsed,
} from '../services/editRequestRepo.js';
import { writeAttendanceAuditLogs } from '../services/attendanceAuditRepo.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import {
  attendanceSnapshotDetails,
  clipAuditSummary,
  formatChangeLine,
  groupMarksByStatus,
  nameList,
  statusCountSummary,
} from '../lib/attendanceAuditDetails.js';
import { attendanceHeaderId } from '../lib/ids.js';
import { isSmsConfigured, parentContactsForEnrollments, resolveRecipientPhones, sendSms } from '../lib/sms.js';
import { isWhatsAppConfigured, sendAbsenceAlertWhatsApp } from '../lib/whatsapp.js';
import { env } from '../lib/appSettings.js';

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

async function forbidIfHolidayDate(res, dateStr, date) {
  if (!(await isNonWorkingDate(dateStr, date))) return false;
  res.status(400).json({
    error: 'Attendance is not taken on Sundays or calendar holidays. Pick a working day.',
    code: 'HOLIDAY_DATE',
  });
  return true;
}

async function requireAttendanceEditPermission(req, res, { dateStr, date, classSectionId }) {
  const past = isPastAttendanceDate(dateStr);
  const finalized = await hasParentMessages(classSectionId, date);
  if (!past && !finalized) return { activePermission: null };

  const activePermission = await findActiveEditPermission({
    teacherId: req.user.sub,
    classSectionId,
    attendanceDate: date,
  });
  if (activePermission) return { activePermission };

  res.status(403).json({
    error: attendanceLockedMessage({ past, finalized }),
    code: 'ATTENDANCE_LOCKED',
  });
  return false;
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
  channel: z.enum(['whatsapp', 'sms', 'whatsapp_sms']).optional().default('sms'),
  recipient: z.enum(['father', 'mother', 'both']).optional().default('father'),
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
  const attendancePercent = attendancePercentFromCounts(counts);

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
      status: byStudent.get(s.id) ?? 'P',
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
  if (await forbidIfHolidayDate(res, parsed.data.date, date)) return;

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

  // Expand to full section roster; every status (P, A, L, H, OH, OF) is persisted.
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
  const permission = await requireAttendanceEditPermission(req, res, {
    dateStr,
    date,
    classSectionId: section.Class_Section_id,
  });
  if (!permission) return;
  const activePermission = permission.activePermission;

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

  const className = section.tblClass?.Class_Name || '';
  const sectionName = section.tblSection?.Section_Name || '';
  const classLabel = [className, sectionName].filter(Boolean).join('-') || section.Class_Section_id;
  const marksByStudent = new Map(fullMarks.map((m) => [String(m.studentId), m.status || 'P']));
  const byStatus = groupMarksByStatus(enrollments, marksByStudent);
  const snapshot = attendanceSnapshotDetails(byStatus);
  const enrollmentById = new Map(enrollments.map((s) => [String(s.id), s]));
  const changes = auditEntries.map((e) => {
    const s = enrollmentById.get(String(e.studentClassId));
    return {
      studentId: e.studentClassId,
      rollNo: s?.rollNo ?? null,
      name: s?.name || e.studentClassId,
      from: e.oldStatus,
      to: e.newStatus,
    };
  });
  const isEditAfterApproval = Boolean(activePermission);
  const absentNames = nameList(snapshot.absent);
  let summary;
  if (isEditAfterApproval) {
    const changeText = changes.length
      ? changes.map(formatChangeLine).join('; ')
      : 'no status changes';
    summary = `Edited Class ${classLabel} on ${parsed.data.date} after approval: ${changeText}`;
  } else {
    summary = `Saved attendance for Class ${classLabel} on ${parsed.data.date}: ${statusCountSummary(byStatus)}`;
    if (absentNames) summary += `; absent: ${absentNames}`;
  }

  logAdminAudit(req, {
    action: isEditAfterApproval ? 'ATTENDANCE_EDIT_AFTER_APPROVAL' : 'ATTENDANCE_SAVE_DAILY',
    category: 'ATTENDANCE',
    entityType: 'class_section',
    entityId: section.Class_Section_id,
    summary: clipAuditSummary(summary),
    details: {
      date: parsed.data.date,
      className,
      sectionName,
      sectionId: section.Class_Section_id,
      updated: fullMarks.length,
      statusChanges: changes.length,
      editAfterApproval: isEditAfterApproval,
      requestId: activePermission?.Request_id || null,
      approverId: activePermission?.Approver_id || null,
      ...snapshot,
      changes,
    },
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
  if (await forbidIfHolidayDate(res, parsed.data.date, date)) return;

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
  const permission = await requireAttendanceEditPermission(req, res, {
    dateStr,
    date,
    classSectionId: section.Class_Section_id,
  });
  if (!permission) return;
  const activePermission = permission.activePermission;

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

  const className = section.tblClass?.Class_Name || '';
  const sectionName = section.tblSection?.Section_Name || '';
  const classLabel = [className, sectionName].filter(Boolean).join('-') || section.Class_Section_id;
  const enrollments = await listEnrollmentsForSection(section.Class_Section_id);
  const enrollmentById = new Map(enrollments.map((s) => [String(s.id), s]));
  const periodMarks = parsed.data.marks.map((m) => {
    const s = enrollmentById.get(String(m.studentId));
    return {
      studentId: m.studentId,
      rollNo: s?.rollNo ?? null,
      name: s?.name || m.studentId,
      periodNo: m.periodNo,
      status: m.status,
    };
  });
  const absentPeriod = periodMarks.filter((m) => String(m.status).toUpperCase() === 'A');
  const isEditAfterApproval = Boolean(activePermission);
  const periodSummary = isEditAfterApproval
    ? `Edited period attendance for Class ${classLabel} on ${parsed.data.date} after approval (${periodMarks.length} marks)`
    : `Saved period attendance for Class ${classLabel} on ${parsed.data.date} (${periodMarks.length} marks)`;

  logAdminAudit(req, {
    action: isEditAfterApproval ? 'ATTENDANCE_EDIT_PERIODS_AFTER_APPROVAL' : 'ATTENDANCE_SAVE_PERIODS',
    category: 'ATTENDANCE',
    entityType: 'class_section',
    entityId: section.Class_Section_id,
    summary: clipAuditSummary(
      absentPeriod.length
        ? `${periodSummary}; absent: ${nameList(absentPeriod)}`
        : periodSummary
    ),
    details: {
      date: parsed.data.date,
      className,
      sectionName,
      sectionId: section.Class_Section_id,
      updated: periodMarks.length,
      editAfterApproval: isEditAfterApproval,
      requestId: activePermission?.Request_id || null,
      approverId: activePermission?.Approver_id || null,
      marks: periodMarks,
      absent: absentPeriod,
    },
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

  const channel = parsed.data.channel || 'sms';
  const recipient = parsed.data.recipient || 'father';

  // Previous-day edit / unlock / re-confirm must never re-blast parents.
  // Absence WhatsApp/SMS only fires for live (today) attendance marking.
  if (isPastAttendanceDate(parsed.data.date)) {
    const existing = await listParentMessages(section.Class_Section_id, date);
    const classLabel =
      [section.tblClass?.Class_Name, section.tblSection?.Section_Name].filter(Boolean).join('-') ||
      section.Class_Section_id;
    logAdminAudit(req, {
      action: 'PARENT_ALERT_SKIPPED_PAST_DATE',
      category: 'NOTIFICATION',
      entityType: 'class_section',
      entityId: section.Class_Section_id,
      summary: clipAuditSummary(
        `Skipped parent attendance alerts for Class ${classLabel} on past date ${parsed.data.date} (${messages.length} initiated, not sent)`
      ),
      details: {
        date: parsed.data.date,
        className: section.tblClass?.Class_Name || null,
        sectionName: section.tblSection?.Section_Name || null,
        channel,
        recipient,
        requested: messages.length,
        counts: {
          initiated: messages.length,
          sent: 0,
          undelivered: messages.length,
          skipped: messages.length,
          failed: 0,
        },
        skipReason: 'past_attendance_date',
      },
    });
    return res.json({
      ok: true,
      date: parsed.data.date,
      sectionId: section.Class_Section_id,
      recorded: 0,
      skippedDelivery: true,
      skipReason: 'past_attendance_date',
      message:
        'Parent absence alerts are not sent for previous-day attendance. Alerts only go out for today\'s marking.',
      channel,
      recipient,
      sentMessages: existing,
      delivery: [],
      summary: { sent: 0, skipped: messages.length, failed: 0 },
      sms: {
        configured: isSmsConfigured(),
        provider: String(env('SMS_PROVIDER', 'console')).toLowerCase(),
        sent: 0,
        skipped: messages.length,
        failed: 0,
      },
      whatsapp: {
        configured: isWhatsAppConfigured(),
        sent: 0,
        skipped: messages.length,
        failed: 0,
      },
    });
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

  // Deliver alerts to parents via SMS and/or WhatsApp.
  const sendSmsChannel = channel === 'sms' || channel === 'whatsapp_sms';
  const sendWhatsAppChannel = channel === 'whatsapp' || channel === 'whatsapp_sms';

  const contacts = await parentContactsForEnrollments(
    messages.map((m) => m.studentId),
    prisma
  );

  // Format date for SMS template var3 (e.g. 06 Aug 2026)
  const dateObj = parsed.data.date ? new Date(`${parsed.data.date}T12:00:00`) : null;
  const dateLabel =
    dateObj && !Number.isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : parsed.data.date;
  const iso = String(parsed.data.date || '');
  const dateDmy = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`
    : dateLabel;
  const classSectionLabel = [section.tblClass?.Class_Name, section.tblSection?.Section_Name]
    .filter(Boolean)
    .join('-') || '—';
  const className = section.tblClass?.Class_Name || '';
  const sectionName = section.tblSection?.Section_Name || '';
  const classLabel = classSectionLabel === '—' ? section.Class_Section_id : classSectionLabel;

  const delivery = [];
  for (const m of messages) {
    const contact = contacts.get(m.studentId) || {};
    const phones = resolveRecipientPhones(contact, recipient);
    const studentName = contact.name || 'Student';
    const rollNo = contact.rollNo || '-';
    const body =
      m.message ||
      `Name : ${studentName}\nRoll Number : ${rollNo}\nYour ward is absent on ${dateLabel}\nRegards,\nRIOBizSols`;

    if (!phones.length) {
      delivery.push({
        studentId: m.studentId,
        studentName,
        rollNo,
        status: m.status,
        message: body,
        phone: null,
        channel,
        recipient,
        ok: false,
        skipped: true,
        provider: null,
        error: `No registered phone for recipient=${recipient}`,
        channels: [],
      });
      continue;
    }

    for (const phone of phones) {
      const channelResults = [];

      if (sendSmsChannel) {
        const result = await sendSms({
          to: phone,
          body,
          vars: {
            studentName,
            rollNo,
            date: dateLabel,
          },
        });
        channelResults.push({
          channel: 'sms',
          ok: result.ok,
          skipped: Boolean(result.skipped),
          provider: result.provider || null,
          error: result.error || null,
          to: result.to || phone || null,
        });
      }

      if (sendWhatsAppChannel) {
        const result = await sendAbsenceAlertWhatsApp({
          toPhone: phone,
          body,
          studentName,
          classSection: classSectionLabel,
          date: dateDmy,
        });
        channelResults.push({
          channel: 'whatsapp',
          ok: result.ok,
          skipped: Boolean(result.skipped),
          provider: result.provider || 'whatsapp',
          error: result.error || result.reason || null,
          to: result.to || phone || null,
        });
      }

      const anyOk = channelResults.some((r) => r.ok);
      const allSkipped = channelResults.length > 0 && channelResults.every((r) => r.skipped);
      const firstError = channelResults.find((r) => !r.ok && !r.skipped)?.error || null;

      delivery.push({
        studentId: m.studentId,
        studentName,
        rollNo,
        status: m.status,
        message: body,
        phone: channelResults[0]?.to || phone || null,
        channel,
        recipient,
        ok: anyOk,
        skipped: allSkipped && !anyOk,
        provider: channelResults.map((r) => r.provider).filter(Boolean).join('+') || null,
        error: anyOk ? null : firstError,
        channels: channelResults,
      });
    }
  }

  const sentOk = delivery.filter((d) => d.ok && !d.skipped).length;
  const sentSkipped = delivery.filter((d) => d.skipped).length;
  const sentFailed = delivery.filter((d) => !d.ok && !d.skipped).length;
  const initiatedCount = messages.length;
  const undeliveredCount = sentFailed + sentSkipped;

  const countChannel = (name, pred) =>
    delivery.filter((d) => d.channels?.some((c) => c.channel === name && pred(c))).length;

  const sentMessages = await listParentMessages(section.Class_Section_id, date);

  const auditMessages = delivery.map((d) => ({
    studentId: d.studentId,
    studentName: d.studentName || 'Student',
    rollNo: d.rollNo || null,
    status: d.status,
    deliveryStatus: d.ok && !d.skipped ? 'sent' : d.skipped ? 'skipped' : 'undelivered',
    phone: d.phone || null,
    channel: d.channel,
    error: d.error || null,
    message: d.message || null,
    channels: d.channels || [],
  }));

  const payload = {
    ok: true,
    date: parsed.data.date,
    sectionId: section.Class_Section_id,
    recorded: saved.length,
    channel,
    recipient,
    sentMessages,
    delivery,
    summary: {
      initiated: initiatedCount,
      sent: sentOk,
      undelivered: undeliveredCount,
      skipped: sentSkipped,
      failed: sentFailed,
    },
    sms: {
      configured: isSmsConfigured(),
      provider: String(env('SMS_PROVIDER', 'console')).toLowerCase(),
      sent: sendSmsChannel ? countChannel('sms', (c) => c.ok && !c.skipped) : 0,
      skipped: sendSmsChannel ? countChannel('sms', (c) => c.skipped) : 0,
      failed: sendSmsChannel ? countChannel('sms', (c) => !c.ok && !c.skipped) : 0,
    },
    whatsapp: {
      configured: isWhatsAppConfigured(),
      sent: sendWhatsAppChannel ? countChannel('whatsapp', (c) => c.ok && !c.skipped) : 0,
      skipped: sendWhatsAppChannel ? countChannel('whatsapp', (c) => c.skipped) : 0,
      failed: sendWhatsAppChannel ? countChannel('whatsapp', (c) => !c.ok && !c.skipped) : 0,
    },
  };

  logAdminAudit(req, {
    action: 'PARENT_ALERT_SEND',
    category: 'NOTIFICATION',
    entityType: 'class_section',
    entityId: section.Class_Section_id,
    summary: clipAuditSummary(
      `Parent attendance alerts for Class ${classLabel} on ${parsed.data.date} via ${channel}: ` +
        `${initiatedCount} initiated, ${sentOk} sent, ${undeliveredCount} undelivered`
    ),
    details: {
      date: parsed.data.date,
      className,
      sectionName,
      sectionId: section.Class_Section_id,
      channel,
      recipient,
      initiatedAt: initiatedAt?.toISOString?.() || initiatedAt || new Date().toISOString(),
      recorded: saved.length,
      counts: {
        initiated: initiatedCount,
        sent: sentOk,
        undelivered: undeliveredCount,
        skipped: sentSkipped,
        failed: sentFailed,
      },
      summary: payload.summary,
      messages: auditMessages,
    },
  });

  return res.json(payload);
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
