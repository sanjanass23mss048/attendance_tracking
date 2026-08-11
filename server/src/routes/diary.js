import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireStaff } from '../middleware/roles.js';
import { newId, parseDateOnly, toDateString } from '../lib/ids.js';
import { canAccessSection, serializeClassSection, findClassSectionById } from '../services/schoolRepo.js';

const router = Router();

function serializeDiary(row) {
  return {
    id: row.Diary_id,
    classSectionId: row.Class_Section_id,
    date: toDateString(row.Entry_Date),
    title: row.Title,
    body: row.Body,
    createdBy: row.Created_By,
    authorName: row.author?.name || null,
    createdOn: row.Created_On?.toISOString?.() || null,
    section: row.classSection ? serializeClassSection(row.classSection) : null,
  };
}

const createSchema = z.object({
  classSectionId: z.string().min(1),
  date: z.string(),
  title: z.string().min(1).max(255),
  body: z.string().min(1),
});

router.use(requireAuth, requireStaff);

router.get('/', async (req, res) => {
  const classSectionId = req.query.classSectionId ? String(req.query.classSectionId) : '';
  if (!classSectionId) {
    return res.status(400).json({ error: 'classSectionId is required' });
  }
  const ok = await canAccessSection(req.user.sub, req.user.role, classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });

  const rows = await prisma.tblClass_Diary.findMany({
    where: { Class_Section_id: classSectionId, Int_Status: { not: 0 } },
    include: {
      author: { select: { name: true } },
      classSection: { include: { tblClass: true, tblSection: true } },
    },
    orderBy: [{ Entry_Date: 'desc' }, { Created_On: 'desc' }],
    take: 100,
  });
  return res.json({ entries: rows.map(serializeDiary) });
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid diary payload', details: parsed.error.flatten() });
  }
  const { classSectionId, date, title, body } = parsed.data;
  const ok = await canAccessSection(req.user.sub, req.user.role, classSectionId);
  if (!ok) return res.status(403).json({ error: 'Forbidden for this class' });

  const entryDate = parseDateOnly(date);
  if (!entryDate) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  const section = await findClassSectionById(classSectionId);
  if (!section) return res.status(404).json({ error: 'Class section not found' });

  const row = await prisma.tblClass_Diary.create({
    data: {
      Diary_id: newId('DRY'),
      Class_Section_id: classSectionId,
      Entry_Date: entryDate,
      Title: title,
      Body: body,
      Created_By: req.user.sub,
      Int_Status: 1,
    },
    include: {
      author: { select: { name: true } },
      classSection: { include: { tblClass: true, tblSection: true } },
    },
  });
  return res.status(201).json({ entry: serializeDiary(row) });
});

export default router;
