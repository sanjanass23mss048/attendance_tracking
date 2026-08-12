import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { newId, parseDateOnly, toDateString } from '../lib/ids.js';
import {
  holidayDescriptionFor,
  holidayTypeFromDescription,
} from '../services/schoolRepo.js';
import { serializeCalendarEvent, upsertCalendarEvent } from './calendar.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';

const router = Router();

const HOLIDAY_TYPES = ['govt', 'sudden', 'weekly', 'holiday'];

const listSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const createSchema = z.object({
  date: z.string(),
  name: z.string().min(1),
  type: z.enum(['govt', 'sudden', 'weekly']),
});

function mapLegacyHoliday(h) {
  return {
    id: h.Holiday_id,
    date: toDateString(h.Date),
    name: h.Text,
    type: holidayTypeFromDescription(h.Description),
  };
}

function mapCalendarHoliday(e) {
  return {
    id: e.id,
    date: e.date,
    name: e.title,
    type: e.type === 'holiday' ? 'govt' : e.type,
  };
}

router.get('/', requireAuth, async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const dateFilter = {};
  if (parsed.data.from || parsed.data.to) {
    dateFilter.Date = {};
    if (parsed.data.from) {
      const from = parseDateOnly(parsed.data.from);
      if (!from) return res.status(400).json({ error: 'from must be YYYY-MM-DD' });
      dateFilter.Date.gte = from;
    }
    if (parsed.data.to) {
      const to = parseDateOnly(parsed.data.to);
      if (!to) return res.status(400).json({ error: 'to must be YYYY-MM-DD' });
      dateFilter.Date.lte = to;
    }
  }

  const [legacyRows, calendarRows] = await Promise.all([
    prisma.tblHolidays.findMany({ where: dateFilter, orderBy: { Date: 'asc' } }),
    prisma.tblCalendarEvents.findMany({
      where: {
        ...dateFilter,
        Type: { in: HOLIDAY_TYPES },
      },
      orderBy: { Date: 'asc' },
    }),
  ]);

  const seen = new Set();
  const holidays = [];

  for (const row of legacyRows) {
    const item = mapLegacyHoliday(row);
    const key = `${item.date}|${item.name}|${item.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    holidays.push(item);
  }

  for (const row of calendarRows) {
    const serialized = serializeCalendarEvent(row);
    const item = mapCalendarHoliday(serialized);
    const key = `${item.date}|${item.name}|${item.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    holidays.push(item);
  }

  holidays.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

  return res.json({ holidays });
});

router.post('/', requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  const date = parseDateOnly(parsed.data.date);
  if (!date) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const existing = await prisma.tblHolidays.findFirst({
    where: { Date: date, Text: parsed.data.name },
  });

  let holiday;
  if (existing) {
    holiday = await prisma.tblHolidays.update({
      where: { Holiday_id: existing.Holiday_id },
      data: { Description: holidayDescriptionFor(parsed.data.type) },
    });
  } else {
    holiday = await prisma.tblHolidays.create({
      data: {
        Holiday_id: newId('HOL'),
        Date: date,
        Text: parsed.data.name,
        Description: holidayDescriptionFor(parsed.data.type),
      },
    });
  }

  const calType = parsed.data.type === 'weekly' ? 'weekly' : parsed.data.type;
  await upsertCalendarEvent({
    id: holiday.Holiday_id,
    date: parsed.data.date,
    type: calType === 'govt' ? 'holiday' : calType,
    title: parsed.data.name,
    subtitle:
      calType === 'sudden' ? 'Sudden Holiday' : calType === 'weekly' ? 'Weekly Holiday' : 'Holiday',
    applicable_to: 'All Classes',
    source: calType === 'sudden' ? 'sudden' : 'govt',
  });

  const payload = {
    holiday: {
      id: holiday.Holiday_id,
      date: toDateString(holiday.Date),
      name: holiday.Text,
      type: holidayTypeFromDescription(holiday.Description),
    },
  };

  logAdminAudit(req, {
    action: existing ? 'HOLIDAY_UPDATE' : 'HOLIDAY_CREATE',
    category: 'HOLIDAY',
    entityType: 'holiday',
    entityId: holiday.Holiday_id,
    summary: `${existing ? 'Updated' : 'Created'} holiday “${holiday.Text}” on ${parsed.data.date}`,
    details: { type: parsed.data.type, date: parsed.data.date },
  });

  return res.status(201).json(payload);
});

export default router;
