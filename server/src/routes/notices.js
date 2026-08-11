import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireStaff } from '../middleware/roles.js';
import { canAccessSection } from '../services/schoolRepo.js';
import { createNotice, listNotices } from '../services/noticeRepo.js';
import { notifyParentsOfNotice } from '../services/parentNotify.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const createSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  body: z.string().min(1),
  audienceType: z.enum(['ALL', 'CLASS', 'CLASSES', 'STUDENTS']),
  classSectionIds: z.array(z.string().min(1)).optional().default([]),
  studentClassIds: z.array(z.string().min(1)).optional().default([]),
  attachmentName: z.string().max(255).optional().nullable(),
  attachmentUrl: z.string().max(500).optional().nullable(),
});

router.use(requireAuth, requireStaff);

router.get('/', async (req, res) => {
  const notices = await listNotices({ limit: req.query.limit });
  return res.json({ notices });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid notice payload', details: parsed.error.flatten() });
  }

  const data = parsed.data;
  const type = data.audienceType;

  if (type === 'ALL') {
    // school-wide — any staff may post
  } else if (type === 'STUDENTS') {
    if (!data.studentClassIds?.length) {
      return res.status(400).json({ error: 'Select at least one student' });
    }
    const enrollments = await prisma.tblStudent_Class.findMany({
      where: { student_class_id: { in: data.studentClassIds }, Int_Status: { not: 0 } },
    });
    if (enrollments.length !== new Set(data.studentClassIds).size) {
      return res.status(400).json({ error: 'One or more students are invalid' });
    }
    for (const en of enrollments) {
      const ok = await canAccessSection(req.user.sub, req.user.role, en.class_section_id);
      if (!ok) return res.status(403).json({ error: 'Forbidden for one or more students' });
    }
  } else {
    const ids = data.classSectionIds || [];
    if (!ids.length) {
      return res.status(400).json({ error: 'Select at least one class' });
    }
    if (type === 'CLASS' && ids.length !== 1) {
      return res.status(400).json({ error: 'CLASS audience requires exactly one class' });
    }
    for (const csId of ids) {
      const ok = await canAccessSection(req.user.sub, req.user.role, csId);
      if (!ok) return res.status(403).json({ error: 'Forbidden for one or more classes' });
    }
  }

  const notice = await createNotice({
    title: data.title,
    body: data.body,
    audienceType: type,
    classSectionIds: data.classSectionIds,
    studentClassIds: data.studentClassIds,
    attachmentName: data.attachmentName,
    attachmentUrl: data.attachmentUrl,
    createdBy: req.user.sub,
  });

  // Fire-and-forget push / realtime to parents who will see this notice
  notifyParentsOfNotice(notice, {
    audienceType: type,
    classSectionIds: data.classSectionIds,
    studentClassIds: data.studentClassIds,
  }).catch((err) => console.warn('Parent notice notify failed', err?.message || err));

  return res.status(201).json({ notice });
});

export default router;
