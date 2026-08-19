import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { toDateString, parseDateOnly, newId } from '../lib/ids.js';
import {
  listChildrenForParent,
  parentAudienceScope,
  serializeClassSection,
} from '../services/schoolRepo.js';
import {
  createRequest,
  listForParent,
  listOpenForStudent,
} from '../services/tcRequestRepo.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import { listNoticesForParentScope } from '../services/noticeRepo.js';
import { serializeCalendarEvent } from './calendar.js';
import {
  normalizeWeeklyGrid,
  PERIOD_TIMES,
  TIMETABLE_DAYS,
} from '../lib/defaultTimetable.js';

const router = Router();

router.use(requireAuth, requireRoles('PARENT'));

router.get('/children', async (req, res) => {
  const children = await listChildrenForParent(req.user.sub);
  return res.json({ children });
});

router.get('/notices', async (req, res) => {
  const scope = await parentAudienceScope(req.user.sub);
  const notices = await listNoticesForParentScope({
    classSectionIds: scope.classSectionIds,
    studentClassIds: scope.studentClassIds,
    limit: req.query.limit,
  });
  return res.json({ notices });
});

/** Download a notice attachment the parent is allowed to see. */
router.get('/notices/:id/attachment', async (req, res) => {
  const noticeId = String(req.params.id || '');
  const notice = await prisma.tblNotices.findFirst({
    where: { Notice_id: noticeId, Int_Status: { not: 0 } },
  });
  if (!notice) return res.status(404).json({ error: 'Notice not found' });

  const scope = await parentAudienceScope(req.user.sub);
  const visible = await listNoticesForParentScope({
    classSectionIds: scope.classSectionIds,
    studentClassIds: scope.studentClassIds,
    limit: 200,
  });
  if (!visible.some((n) => n.id === noticeId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const storageKey = notice.Attachment_Url;
  if (!storageKey) {
    return res.status(404).json({ error: 'No attachment on this notice' });
  }

  try {
    const { readFile } = await import('../lib/storage.js');
    const buffer = await readFile(storageKey);
    const name = String(notice.Attachment_Name || 'attachment').replace(/"/g, '');
    const lower = name.toLowerCase();
    let mime = 'application/octet-stream';
    if (lower.endsWith('.pdf')) mime = 'application/pdf';
    else if (/\.jpe?g$/.test(lower)) mime = 'image/jpeg';
    else if (lower.endsWith('.png')) mime = 'image/png';
    else if (lower.endsWith('.webp')) mime = 'image/webp';
    else if (lower.endsWith('.doc')) mime = 'application/msword';
    else if (lower.endsWith('.docx')) {
      mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('Parent notice attachment download failed', err?.message || err);
    return res.status(404).json({ error: 'File not found on disk' });
  }
});

const deviceTokenSchema = z.object({
  token: z.string().min(8).max(512),
  platform: z.enum(['android', 'ios', 'web', 'socket']).optional(),
});

router.post('/device-token', async (req, res) => {
  const parsed = deviceTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid device token', details: parsed.error.flatten() });
  }
  const { token, platform } = parsed.data;
  const existing = await prisma.tblDevice_Tokens.findUnique({ where: { Token: token } });
  if (existing) {
    const row = await prisma.tblDevice_Tokens.update({
      where: { Token: token },
      data: {
        user_id: req.user.sub,
        Platform: platform || existing.Platform,
        Updated_On: new Date(),
        Int_Status: 1,
      },
    });
    // Real FCM token → drop socket placeholders for this user
    if (!String(token).startsWith('sock_')) {
      await prisma.tblDevice_Tokens.updateMany({
        where: {
          user_id: req.user.sub,
          Token: { startsWith: 'sock_' },
          Int_Status: { not: 0 },
        },
        data: { Int_Status: 0 },
      });
    }
    return res.json({ ok: true, id: row.Token_id });
  }
  const row = await prisma.tblDevice_Tokens.create({
    data: {
      Token_id: newId('DTK'),
      user_id: req.user.sub,
      Token: token,
      Platform: platform || 'android',
      Int_Status: 1,
    },
  });
  if (!String(token).startsWith('sock_')) {
    await prisma.tblDevice_Tokens.updateMany({
      where: {
        user_id: req.user.sub,
        Token: { startsWith: 'sock_' },
        Int_Status: { not: 0 },
      },
      data: { Int_Status: 0 },
    });
  }
  return res.json({ ok: true, id: row.Token_id });
});

router.delete('/device-token', async (req, res) => {
  const token = req.body?.token || req.query?.token;
  if (!token) return res.status(400).json({ error: 'token required' });
  await prisma.tblDevice_Tokens.updateMany({
    where: { Token: String(token), user_id: req.user.sub },
    data: { Int_Status: 0 },
  });
  return res.json({ ok: true });
});

router.get('/diary', async (req, res) => {
  const scope = await parentAudienceScope(req.user.sub);
  if (!scope.classSectionIds.length) return res.json({ entries: [] });

  const rows = await prisma.tblClass_Diary.findMany({
    where: {
      Class_Section_id: { in: scope.classSectionIds },
      Int_Status: { not: 0 },
    },
    include: {
      author: { select: { name: true } },
      classSection: { include: { tblClass: true, tblSection: true } },
    },
    orderBy: [{ Entry_Date: 'desc' }, { Created_On: 'desc' }],
    take: 100,
  });

  return res.json({
    entries: rows.map((row) => ({
      id: row.Diary_id,
      classSectionId: row.Class_Section_id,
      date: toDateString(row.Entry_Date),
      title: row.Title,
      body: row.Body,
      createdBy: row.Created_By,
      authorName: row.author?.name || null,
      createdOn: row.Created_On?.toISOString?.() || null,
      section: row.classSection ? serializeClassSection(row.classSection) : null,
    })),
  });
});

router.get('/calendar', async (req, res) => {
  const from = parseDateOnly(req.query.from);
  const to = parseDateOnly(req.query.to);
  const where = {};
  if (from || to) {
    where.Date = {};
    if (from) where.Date.gte = from;
    if (to) where.Date.lte = to;
  }
  const events = await prisma.tblCalendarEvents.findMany({
    where,
    orderBy: { Date: 'asc' },
  });
  const holidays = await prisma.tblHolidays.findMany({
    where: from || to
      ? {
          Date: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : undefined,
    orderBy: { Date: 'asc' },
  });
  return res.json({
    events: events.map(serializeCalendarEvent),
    holidays: holidays.map((h) => ({
      id: h.Holiday_id,
      date: toDateString(h.Date),
      title: h.Text,
      description: h.Description,
    })),
  });
});

router.get('/timetable', async (req, res) => {
  const children = await listChildrenForParent(req.user.sub);
  const classSectionId =
    (req.query.classSectionId && String(req.query.classSectionId)) ||
    children[0]?.sectionId ||
    '';
  if (!classSectionId) {
    return res.status(404).json({ error: 'No linked student / class found' });
  }
  const allowed = children.some((c) => c.sectionId === classSectionId);
  if (!allowed) return res.status(403).json({ error: 'Forbidden for this class' });

  const row = await prisma.tblTimetable.findUnique({
    where: { Class_Section_id: classSectionId },
  });
  return res.json({
    timetable: {
      classSectionId,
      days: TIMETABLE_DAYS,
      periods: PERIOD_TIMES,
      grid: normalizeWeeklyGrid(row?.Grid_Json, classSectionId),
      updatedOn: row?.Updated_On?.toISOString?.() || null,
    },
  });
});

router.get('/tc-requests', async (req, res) => {
  const requests = await listForParent(req.user.sub);
  return res.json({ requests });
});

router.post('/tc-requests', async (req, res) => {
  const studentClassId = String(req.body?.studentClassId || '').trim();
  const reason = String(req.body?.reason || '').trim();
  if (!studentClassId) {
    return res.status(400).json({ error: 'studentClassId is required' });
  }
  const children = await listChildrenForParent(req.user.sub);
  const child = children.find((c) => String(c.id) === studentClassId);
  if (!child) {
    return res.status(403).json({ error: 'This student is not linked to your account' });
  }
  const open = await listOpenForStudent(child.studentRecordId);
  if (open.length) {
    return res.status(409).json({
      error: 'A transfer certificate request is already in progress for this student',
      request: open[0],
    });
  }
  const classLabel = [child.section?.class?.name, child.section?.name].filter(Boolean).join(' - ');
  const created = await createRequest({
    studentId: child.studentRecordId,
    studentClassId: child.id,
    classSectionId: child.sectionId,
    studentName: child.name,
    classLabel,
    reason,
    requestedBy: req.user.sub,
  });
  logAdminAudit(req, {
    action: 'TC_REQUEST',
    category: 'TC',
    entityType: 'tc_request',
    entityId: created?.id,
    summary: `Parent requested TC for ${child.name}`,
    details: { classLabel, studentClassId: child.id },
  });
  return res.status(201).json({ request: created });
});

export default router;
