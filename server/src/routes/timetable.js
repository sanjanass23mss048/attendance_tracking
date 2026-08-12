import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireStaff } from '../middleware/roles.js';
import { newId } from '../lib/ids.js';
import { canAccessSection } from '../services/schoolRepo.js';
import {
  buildDefaultWeeklyTimetable,
  PERIOD_TIMES,
  TIMETABLE_DAYS,
} from '../lib/defaultTimetable.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';

const router = Router();

async function getOrDefault(classSectionId) {
  const row = await prisma.tblTimetable.findUnique({
    where: { Class_Section_id: classSectionId },
  });
  return serializeTimetable(row, classSectionId);
}

function serializeTimetable(row, classSectionId) {
  return {
    classSectionId,
    days: TIMETABLE_DAYS,
    periods: PERIOD_TIMES,
    grid: row?.Grid_Json || buildDefaultWeeklyTimetable(classSectionId),
    updatedOn: row?.Updated_On?.toISOString?.() || null,
  };
}

router.get('/', requireAuth, async (req, res) => {
  const classSectionId = req.query.classSectionId ? String(req.query.classSectionId) : '';
  if (!classSectionId) {
    return res.status(400).json({ error: 'classSectionId is required' });
  }
  const role = String(req.user?.role || '').toUpperCase();
  if (role === 'PARENT') {
    const { listChildrenForParent } = await import('../services/schoolRepo.js');
    const children = await listChildrenForParent(req.user.sub);
    if (!children.some((c) => c.sectionId === classSectionId)) {
      return res.status(403).json({ error: 'Forbidden for this class' });
    }
  } else {
    const ok = await canAccessSection(req.user.sub, req.user.role, classSectionId);
    if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });
  }
  const timetable = await getOrDefault(classSectionId);
  return res.json({ timetable });
});

const putSchema = z.object({
  classSectionId: z.string().min(1),
  grid: z.array(z.array(z.any())).min(1),
});

router.put('/', requireAuth, requireStaff, async (req, res) => {
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid timetable payload', details: parsed.error.flatten() });
  }
  const { classSectionId, grid } = parsed.data;
  const ok = await canAccessSection(req.user.sub, req.user.role, classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });

  const row = await prisma.tblTimetable.upsert({
    where: { Class_Section_id: classSectionId },
    create: {
      Timetable_id: newId('TTB'),
      Class_Section_id: classSectionId,
      Grid_Json: grid,
    },
    update: {
      Grid_Json: grid,
      Updated_On: new Date(),
    },
  });
  logAdminAudit(req, {
    action: 'TIMETABLE_UPDATE',
    category: 'TIMETABLE',
    entityType: 'timetable',
    entityId: row.Timetable_id,
    summary: `Updated timetable for ${classSectionId}`,
    details: { classSectionId, days: Array.isArray(grid) ? grid.length : null },
  });
  return res.json({ timetable: serializeTimetable(row, classSectionId) });
});

export default router;
