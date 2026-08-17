import { prisma } from './prisma.js';
import { toDateString } from './ids.js';

const CALENDAR_HOLIDAY_TYPES = ['holiday', 'govt', 'sudden', 'weekly'];

export function isSundayYmd(ymd) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 0;
}

export function sundayYmdsInRange(start, end) {
  const out = [];
  if (!start || !end) return out;
  const cur = new Date(start.getTime());
  const last = end.getTime();
  while (cur.getTime() <= last) {
    if (cur.getUTCDay() === 0) out.push(toDateString(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Sundays plus holidays from the academic calendar / holidays table. */
export async function loadNonWorkingYmdSet(start, end) {
  const set = new Set(sundayYmdsInRange(start, end));
  if (!start || !end) return set;

  const [legacy, events] = await Promise.all([
    prisma.tblHolidays.findMany({
      where: { Date: { gte: start, lte: end } },
      select: { Date: true },
    }),
    prisma.tblCalendarEvents.findMany({
      where: {
        Date: { gte: start, lte: end },
        Type: { in: CALENDAR_HOLIDAY_TYPES },
      },
      select: { Date: true },
    }),
  ]);

  for (const row of legacy) {
    const ymd = toDateString(row.Date);
    if (ymd) set.add(ymd);
  }
  for (const row of events) {
    const ymd = toDateString(row.Date);
    if (ymd) set.add(ymd);
  }
  return set;
}

export async function isNonWorkingDate(dateStr, date) {
  if (!dateStr || !date) return false;
  if (isSundayYmd(dateStr)) return true;
  const set = await loadNonWorkingYmdSet(date, date);
  return set.has(dateStr);
}
