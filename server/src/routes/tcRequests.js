import { Router } from 'express';
import { z } from 'zod';
import { requireStaff } from '../middleware/roles.js';
import { canAccessSection, hasFullClassAccess } from '../services/schoolRepo.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import {
  TC_STATUS,
  findById,
  listForStaff,
  markForwarded,
  markReviewed,
  deactivateStudentKeepRecord,
} from '../services/tcRequestRepo.js';

const router = Router();
router.use(requireStaff);

router.get('/', async (req, res) => {
  const status = req.query.status ? String(req.query.status).toUpperCase() : '';
  const requests = await listForStaff(req.user.sub, req.user.role, {
    status: status || undefined,
  });
  return res.json({
    requests,
    canForward: true,
    canReview: hasFullClassAccess(req.user.role),
  });
});

const noteSchema = z.object({
  note: z.string().max(500).optional().nullable(),
});

router.post('/:id/forward', async (req, res) => {
  const id = String(req.params.id || '');
  const row = await findById(id);
  if (!row) return res.status(404).json({ error: 'TC request not found' });
  if (row.status !== TC_STATUS.REQUESTED) {
    return res.status(409).json({ error: 'Only a parent request can be forwarded to management' });
  }
  const ok = await canAccessSection(req.user.sub, req.user.role, row.classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });

  const updated = await markForwarded(id, req.user.sub);
  if (updated?.status !== TC_STATUS.FORWARDED) {
    return res.status(409).json({ error: 'Could not notify management' });
  }
  logAdminAudit(req, {
    action: 'TC_FORWARD',
    category: 'TC',
    entityType: 'tc_request',
    entityId: id,
    summary: `Teacher notified management of TC request for ${row.studentName}`,
    details: { classLabel: row.classLabel, studentId: row.studentId },
  });
  return res.json({ request: updated });
});

router.post('/:id/approve', async (req, res) => {
  if (!hasFullClassAccess(req.user.role)) {
    return res.status(403).json({ error: 'Only management can approve a TC request' });
  }
  const parsed = noteSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const id = String(req.params.id || '');
  const row = await findById(id);
  if (!row) return res.status(404).json({ error: 'TC request not found' });
  if (row.status !== TC_STATUS.FORWARDED) {
    return res.status(409).json({ error: 'Management can approve only after a teacher notifies them' });
  }

  await deactivateStudentKeepRecord(row.studentId, req.user.sub);
  const updated = await markReviewed(id, {
    status: TC_STATUS.APPROVED,
    reviewerId: req.user.sub,
    note: parsed.data.note,
  });
  if (updated?.status !== TC_STATUS.APPROVED) {
    return res.status(409).json({ error: 'Could not approve TC request' });
  }
  logAdminAudit(req, {
    action: 'TC_APPROVE',
    category: 'TC',
    entityType: 'tc_request',
    entityId: id,
    summary: `TC approved — ${row.studentName} set inactive (record kept)`,
    details: { studentId: row.studentId, classLabel: row.classLabel },
  });
  return res.json({ request: updated });
});

router.post('/:id/reject', async (req, res) => {
  if (!hasFullClassAccess(req.user.role)) {
    return res.status(403).json({ error: 'Only management can reject a TC request' });
  }
  const parsed = noteSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const id = String(req.params.id || '');
  const row = await findById(id);
  if (!row) return res.status(404).json({ error: 'TC request not found' });
  if (row.status !== TC_STATUS.FORWARDED) {
    return res.status(409).json({ error: 'Management can reject only after a teacher notifies them' });
  }
  const updated = await markReviewed(id, {
    status: TC_STATUS.REJECTED,
    reviewerId: req.user.sub,
    note: parsed.data.note,
  });
  if (updated?.status !== TC_STATUS.REJECTED) {
    return res.status(409).json({ error: 'Could not reject TC request' });
  }
  logAdminAudit(req, {
    action: 'TC_REJECT',
    category: 'TC',
    entityType: 'tc_request',
    entityId: id,
    summary: `TC rejected for ${row.studentName}`,
    details: { studentId: row.studentId, classLabel: row.classLabel },
  });
  return res.json({ request: updated });
});

export default router;
