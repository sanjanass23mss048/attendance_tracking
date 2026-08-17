import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { newId, parseDateOnly, toDateString } from '../lib/ids.js';
import { logAdminAudit } from '../services/adminAuditRepo.js';
import { listUniqueParentPhones } from '../lib/sms.js';
import { sendSuddenHolidayWhatsApp } from '../lib/whatsapp.js';

const router = Router();

const eventSchema = z.object({
  id: z.string().max(50).optional(),
  date: z.string(),
  date_to: z.string().optional().nullable(),
  // Known types plus free-text "Others" (custom label, max 50 for DB column)
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(255),
  subtitle: z.string().max(255).optional().nullable(),
  applicable_to: z.string().max(255).optional().nullable(),
  parent_message: z.string().optional().nullable(),
  source: z.string().max(50).optional().nullable(),
});

const listSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const syncSchema = z.object({
  events: z.array(eventSchema),
});

export function serializeCalendarEvent(row) {
  return {
    id: row.Event_id,
    date: toDateString(row.Date),
    type: row.Type,
    title: row.Text,
    subtitle: row.Subtitle,
    applicable_to: row.Applicable_to,
    parent_message: row.Parent_message,
    source: row.Source,
  };
}

function isoToDmy(iso) {
  const s = String(iso || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '—';
  return `${s.slice(8, 10)}-${s.slice(5, 7)}-${s.slice(0, 4)}`;
}

function formatClosedDates(fromIso, toIso) {
  const from = isoToDmy(fromIso);
  if (!toIso || toIso === fromIso) return from;
  return `${from} & ${isoToDmy(toIso)}`;
}

function datesInclusive(fromIso, toIso) {
  const start = parseDateOnly(fromIso);
  const end = parseDateOnly(toIso || fromIso) || start;
  if (!start) return [];
  const out = [];
  const cursor = new Date(start.getTime());
  const last = end && end.getTime() >= start.getTime() ? end : start;
  while (cursor.getTime() <= last.getTime()) {
    out.push(toDateString(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

async function notifySuddenHolidayWhatsApp({ reason, fromDate, toDate, applicableTo }) {
  const phones = await listUniqueParentPhones(prisma, { applicableTo });
  if (!phones.length) {
    return { attempted: 0, sent: 0, failed: 0, skipped: 0 };
  }
  const dates = formatClosedDates(fromDate, toDate);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const chunk = 6;
  for (let i = 0; i < phones.length; i += chunk) {
    const part = phones.slice(i, i + chunk);
    const results = await Promise.all(
      part.map((toPhone) => sendSuddenHolidayWhatsApp({ toPhone, reason, dates }))
    );
    for (const r of results) {
      if (r.skipped) skipped += 1;
      else if (r.ok) sent += 1;
      else failed += 1;
    }
  }
  return { attempted: phones.length, sent, failed, skipped };
}

export async function upsertCalendarEvent(input) {
  const date = parseDateOnly(input.date);
  if (!date) throw new Error('date must be YYYY-MM-DD');

  const type = input.type;
  const title = input.title;
  const data = {
    Subtitle: input.subtitle ?? null,
    Applicable_to: input.applicable_to ?? null,
    Parent_message: input.parent_message ?? null,
    Source: input.source ?? null,
  };

  const existing = await prisma.tblCalendarEvents.findFirst({
    where: { Date: date, Text: title, Type: type },
  });

  if (existing) {
    return prisma.tblCalendarEvents.update({
      where: { Event_id: existing.Event_id },
      data,
    });
  }

  const eventId = input.id && input.id.length <= 50 ? input.id : newId('EVT');
  return prisma.tblCalendarEvents.create({
    data: {
      Event_id: eventId,
      Date: date,
      Text: title,
      Type: type,
      ...data,
    },
  });
}

router.get('/events', requireAuth, async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const where = {};
  if (parsed.data.from || parsed.data.to) {
    where.Date = {};
    if (parsed.data.from) {
      const from = parseDateOnly(parsed.data.from);
      if (!from) return res.status(400).json({ error: 'from must be YYYY-MM-DD' });
      where.Date.gte = from;
    }
    if (parsed.data.to) {
      const to = parseDateOnly(parsed.data.to);
      if (!to) return res.status(400).json({ error: 'to must be YYYY-MM-DD' });
      where.Date.lte = to;
    }
  }

  const rows = await prisma.tblCalendarEvents.findMany({
    where,
    orderBy: [{ Date: 'asc' }, { Text: 'asc' }],
  });

  return res.json({ events: rows.map(serializeCalendarEvent) });
});

router.post('/events', requireAuth, async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  try {
    const dates = datesInclusive(parsed.data.date, parsed.data.date_to);
    const days = dates.length ? dates : [parsed.data.date];
    let row = null;
    for (const day of days) {
      row = await upsertCalendarEvent({ ...parsed.data, date: day, id: day === parsed.data.date ? parsed.data.id : undefined });
    }
    let whatsapp = null;
    if (String(parsed.data.type || '').toLowerCase() === 'sudden') {
      whatsapp = await notifySuddenHolidayWhatsApp({
        reason: parsed.data.title,
        fromDate: parsed.data.date,
        toDate: parsed.data.date_to || parsed.data.date,
        applicableTo: parsed.data.applicable_to,
      });
    }
    logAdminAudit(req, {
      action: 'CALENDAR_EVENT_UPSERT',
      category: 'CALENDAR',
      entityType: 'calendar_event',
      entityId: row.Event_id,
      summary: `Saved calendar event “${row.Text || parsed.data.title}” on ${parsed.data.date}`,
      details: {
        type: parsed.data.type,
        date: parsed.data.date,
        date_to: parsed.data.date_to || null,
        source: parsed.data.source || null,
        whatsapp,
      },
    });
    return res.status(201).json({ event: serializeCalendarEvent(row), whatsapp });
  } catch (err) {
    if (err.message === 'date must be YYYY-MM-DD') {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
});

router.post('/sync', requireAuth, async (req, res) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
  }

  let upserted = 0;
  for (const event of parsed.data.events) {
    try {
      await upsertCalendarEvent(event);
      upserted += 1;
    } catch (err) {
      if (err.message !== 'date must be YYYY-MM-DD') throw err;
    }
  }

  logAdminAudit(req, {
    action: 'CALENDAR_SYNC',
    category: 'CALENDAR',
    entityType: 'calendar',
    summary: `Synced ${upserted} calendar event(s)`,
    details: { upserted, submitted: parsed.data.events.length },
  });

  return res.json({ ok: true, upserted });
});

router.delete('/events/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '').slice(0, 50);
  if (!id) return res.status(400).json({ error: 'Missing event id' });

  const existing = await prisma.tblCalendarEvents.findUnique({ where: { Event_id: id } });
  if (!existing) return res.status(404).json({ error: 'Event not found' });

  await prisma.tblCalendarEvents.delete({ where: { Event_id: id } });
  logAdminAudit(req, {
    action: 'CALENDAR_EVENT_DELETE',
    category: 'CALENDAR',
    entityType: 'calendar_event',
    entityId: id,
    summary: `Deleted calendar event “${existing.Text || id}”`,
    details: {
      date: toDateString(existing.Date),
      type: existing.Type || null,
    },
  });
  return res.json({ ok: true });
});

export default router;
