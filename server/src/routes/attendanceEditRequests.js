import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { parseDateOnly } from '../lib/ids.js';
import {
  isPastAttendanceDate,
  isSameDayAttendance,
  canBypassEditLock,
  normalizePhone,
} from '../lib/attendanceEditRules.js';
import { sendAttendanceEditApprovalMessage, isWhatsAppConfigured } from '../lib/whatsapp.js';
import { prisma } from '../lib/prisma.js';
import { findClassSectionById, listEnrollmentsForSection } from '../services/schoolRepo.js';
import { getDailyMarks } from '../services/attendanceRepo.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import {
  attendanceSnapshotDetails,
  clipAuditSummary,
  groupMarksByStatus,
  nameList,
  statusCountSummary,
} from '../lib/attendanceAuditDetails.js';
import {
  createEditRequest,
  findApproverForSection,
  findEditRequestById,
  findLatestRequestForContext,
  findPendingDuplicate,
  listMyRequests,
  listPendingForApprover,
  serializeEditRequest,
  setWhatsAppMessageId,
} from '../services/editRequestRepo.js';

const router = Router();

const createSchema = z.object({
  sectionId: z.string().min(1),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(3).max(1000),
});

router.post('/', requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  const { sectionId, attendanceDate, reason } = parsed.data;
  if (!isPastAttendanceDate(attendanceDate)) {
    return res.status(400).json({
      error: 'Edit requests are only required for previous dates. Same-day attendance can be edited directly.',
    });
  }

  const section = await findClassSectionById(sectionId);
  if (!section) return res.status(404).json({ error: 'Section not found' });

  const teacherId = req.user.sub;
  const date = parseDateOnly(attendanceDate);
  const dup = await findPendingDuplicate({
    teacherId,
    classSectionId: section.Class_Section_id,
    attendanceDate: date,
  });
  if (dup) {
    return res.status(409).json({
      error: 'A pending edit request already exists for this class and date',
      requestId: dup.Request_id,
    });
  }

  const approver = await findApproverForSection(section.Class_Section_id);
  if (!approver) {
    return res.status(422).json({
      error: 'No approver assigned for this class/section. Ask Admin to assign an attendance approver.',
    });
  }

  if (!isWhatsAppConfigured()) {
    return res.status(503).json({
      error: 'WhatsApp is not configured. Edit approvals are handled only through WhatsApp.',
    });
  }

  const approverPhone = normalizePhone(approver.phone);
  if (!approverPhone) {
    return res.status(422).json({
      error: 'Approver WhatsApp phone is missing for this class. Ask Admin to set it.',
    });
  }

  const request = await createEditRequest({
    teacherId,
    classId: section.Class_id,
    sectionId: section.Section_id,
    classSectionId: section.Class_Section_id,
    attendanceDate: date,
    reason: reason.trim(),
    approverId: approver.userId,
  });

  let whatsapp = { skipped: true };
  try {
    whatsapp = await sendAttendanceEditApprovalMessage({
      toPhone: approverPhone,
      teacherName: req.user.name || 'Teacher',
      className: section.tblClass?.Class_Name || section.Class_id,
      sectionName: section.tblSection?.Section_Name || '',
      attendanceDate,
      reason: reason.trim(),
      requestId: request.id,
    });
    if (whatsapp.messageId) {
      await setWhatsAppMessageId(request.id, whatsapp.messageId);
      request.whatsappMessageId = whatsapp.messageId;
    }
  } catch (err) {
    console.error('[edit-request] WhatsApp send failed', err);
    await prisma.tblAttendance_Edit_Requests.delete({ where: { Request_id: request.id } }).catch(() => {});
    return res.status(502).json({
      error: 'Could not send WhatsApp approval message. Request was not created.',
      details: err.message,
    });
  }

  if (whatsapp.skipped || !whatsapp.messageId) {
    await prisma.tblAttendance_Edit_Requests.delete({ where: { Request_id: request.id } }).catch(() => {});
    return res.status(502).json({
      error: 'WhatsApp approval message was not delivered. Request was not created.',
    });
  }

  const className = section.tblClass?.Class_Name || '';
  const sectionName = section.tblSection?.Section_Name || '';
  const classLabel = [className, sectionName].filter(Boolean).join('-') || section.Class_Section_id;
  const enrollments = await listEnrollmentsForSection(section.Class_Section_id);
  const currentMarks = await getDailyMarks(section.Class_Section_id, date);
  const currentByStatus = groupMarksByStatus(enrollments, currentMarks);
  const snapshot = attendanceSnapshotDetails(currentByStatus);
  const teacherName = req.user.name || req.user.email || teacherId;
  const reasonText = reason.trim();

  logAdminAudit(req, {
    action: 'EDIT_REQUEST_CREATE',
    category: 'APPROVAL',
    entityType: 'attendance_edit_request',
    entityId: request.id,
    summary: clipAuditSummary(
      `${teacherName} requested to edit Class ${classLabel} attendance on ${attendanceDate}` +
        (reasonText ? ` (reason: ${reasonText})` : '') +
        `; currently ${statusCountSummary(currentByStatus)}` +
        (snapshot.absent.length ? `; absent: ${nameList(snapshot.absent)}` : '')
    ),
    details: {
      className,
      sectionName,
      sectionId: section.Class_Section_id,
      attendanceDate,
      teacherId,
      teacherName,
      approverId: approver.userId,
      approverName: approver.name || null,
      reason: reasonText.slice(0, 500),
      currentAttendance: snapshot,
    },
  });

  return res.status(201).json({
    request,
    whatsappSent: !whatsapp.skipped && Boolean(whatsapp.messageId),
  });
});

router.get('/my-requests', requireAuth, async (req, res) => {
  const requests = await listMyRequests(req.user.sub);
  return res.json({ requests });
});

router.get(
  '/pending',
  requireAuth,
  requireRoles('INCHARGE', 'HOD', 'VICE_PRINCIPAL', 'PRINCIPAL', 'ADMIN'),
  async (req, res) => {
    const requests = await listPendingForApprover(req.user.sub);
    // Admins also see all pending if they are the assigned approver; optionally expand for ADMIN
    if (String(req.user.role).toUpperCase() === 'ADMIN' && requests.length === 0) {
      // keep scoped to assigned approver for security; admins should be assigned or use deny/approve by id
    }
    return res.json({ requests });
  }
);

router.get('/context', requireAuth, async (req, res) => {
  const sectionId = String(req.query.sectionId || '');
  const attendanceDate = String(req.query.date || '');
  if (!sectionId || !/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
    return res.status(400).json({ error: 'sectionId and date (YYYY-MM-DD) required' });
  }

  const sameDay = isSameDayAttendance(attendanceDate);
  const past = isPastAttendanceDate(attendanceDate);
  const bypass = canBypassEditLock(req.user.role);

  let request = null;
  if (past && !bypass) {
    request = await findLatestRequestForContext({
      teacherId: req.user.sub,
      classSectionId: sectionId,
      attendanceDate: parseDateOnly(attendanceDate),
    });
  }

  const canEditDirectly = sameDay || bypass;
  const canEditWithApproval =
    request?.status === 'APPROVED' &&
    request.editExpiresAt &&
    new Date(request.editExpiresAt).getTime() > Date.now();

  return res.json({
    date: attendanceDate,
    sectionId,
    today: sameDay,
    locked: past && !canEditDirectly && !canEditWithApproval,
    canEdit: canEditDirectly || canEditWithApproval,
    canRequestEdit: past && !canEditDirectly && !canEditWithApproval && request?.status !== 'PENDING',
    request,
  });
});

router.get('/:id/status', requireAuth, async (req, res) => {
  const row = await findEditRequestById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Request not found' });
  const role = String(req.user.role || '').toUpperCase();
  if (
    row.Teacher_id !== req.user.sub &&
    row.Approver_id !== req.user.sub &&
    !canBypassEditLock(role)
  ) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const cs = await findClassSectionById(row.Class_Section_id);
  const request = serializeEditRequest({
    ...row,
    className: cs?.tblClass?.Class_Name || null,
    sectionName: cs?.tblSection?.Section_Name || null,
  });
  return res.json({ request });
});

router.patch(
  '/:id/approve',
  requireAuth,
  requireRoles('INCHARGE', 'HOD', 'VICE_PRINCIPAL', 'PRINCIPAL', 'ADMIN'),
  async (_req, res) => {
    return res.status(403).json({
      error: 'In-app approval is disabled. Approve this request using the WhatsApp message buttons.',
    });
  }
);

router.patch(
  '/:id/deny',
  requireAuth,
  requireRoles('INCHARGE', 'HOD', 'VICE_PRINCIPAL', 'PRINCIPAL', 'ADMIN'),
  async (_req, res) => {
    return res.status(403).json({
      error: 'In-app denial is disabled. Deny this request using the WhatsApp message buttons.',
    });
  }
);

export default router;
