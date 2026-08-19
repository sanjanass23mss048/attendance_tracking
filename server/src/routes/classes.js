import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { createClassWithSections, listClassesForUser } from '../services/schoolRepo.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';

const router = Router();

const managers = requireRoles(
  'ADMIN',
  'INCHARGE',
  'HOD',
  'VICE_PRINCIPAL',
  'PRINCIPAL',
  'HEADMASTER'
);

const createSchema = z.object({
  className: z.string().min(1).max(50),
  sectionNames: z.array(z.string().min(1).max(10)).optional(),
  academicYear: z.string().max(20).optional().nullable(),
});

router.get('/', requireAuth, async (req, res) => {
  const classes = await listClassesForUser(req.user.sub, req.user.role);
  return res.json({ classes });
});

router.post('/', requireAuth, managers, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  try {
    const klass = await createClassWithSections({
      className: parsed.data.className.trim(),
      sectionNames: parsed.data.sectionNames,
      academicYear: parsed.data.academicYear?.trim() || null,
    });
    logAdminAudit(req, {
      action: klass?.action === 'created' ? 'CLASS_CREATE' : 'CLASS_UPDATE',
      category: 'STUDENT',
      entityType: 'class',
      entityId: klass?.id,
      summary:
        klass?.action === 'created'
          ? `Created class ${klass?.name || parsed.data.className}`
          : `Added sections to class ${klass?.name || parsed.data.className}`,
      details: {
        className: klass?.name,
        sections: (klass?.sections || []).map((s) => s.name),
        addedSections: klass?.addedSections || [],
      },
    });
    return res.status(201).json({ class: klass });
  } catch (err) {
    if (
      err?.code === 'CLASS_EXISTS' ||
      err?.code === 'CLASS_INVALID' ||
      err?.code === 'CLASS_CREATE_RESTRICTED' ||
      err?.code === 'SECTION_EXISTS'
    ) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});

export default router;
