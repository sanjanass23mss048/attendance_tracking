import { getMyEditRequests, getPendingEditRequests } from './attendanceEditRequestService.js';
import { getScheduledEvents } from './calendarService.js';
import { formatAttendanceDate, getTodayAttendanceDate } from '../utils/attendance.js';
import { useMock } from './api.js';

const SEEN_KEY = 'presence_notifications_seen_v1';

function relativeDayLabel(isoDate) {
  if (!isoDate) return '';
  const today = getTodayAttendanceDate();
  if (isoDate === today) return 'Today';
  const t = new Date(`${today}T12:00:00`);
  const d = new Date(`${isoDate}T12:00:00`);
  const diff = Math.round((d - t) / 86400000);
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return formatAttendanceDate(isoDate);
}

function requestLabel(req) {
  const cls = [req.className, req.sectionName].filter(Boolean).join('-') || 'class';
  const date = req.attendanceDate ? formatAttendanceDate(req.attendanceDate) : '';
  return { cls, date };
}

function readSeenIds() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeSeenIds(ids) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

/** Mark notification ids as seen so the badge clears. */
export function markNotificationsSeen(ids = []) {
  const seen = readSeenIds();
  for (const id of ids) {
    if (id != null) seen.add(String(id));
  }
  const trimmed = [...seen].slice(-200);
  writeSeenIds(trimmed);
  return trimmed.length;
}

/**
 * Build in-app notification feed from live school data.
 * @returns {Promise<{ notifications: Array, unreadCount: number }>}
 */
export async function getNotificationsFeed() {
  const today = getTodayAttendanceDate();
  const items = [];

  if (!useMock()) {
    try {
      const [mine, pending] = await Promise.all([
        getMyEditRequests().catch(() => ({ requests: [] })),
        getPendingEditRequests().catch(() => ({ requests: [] })),
      ]);

      const seenReq = new Set();
      for (const req of pending.requests || []) {
        if (!req?.id || seenReq.has(req.id)) continue;
        seenReq.add(req.id);
        const { cls, date } = requestLabel(req);
        items.push({
          id: `edit-pending-${req.id}`,
          category: 'approval',
          title: 'Edit request awaiting approval',
          body: `${cls}${date ? ` · ${date}` : ''} — approve or deny via WhatsApp.`,
          time: relativeDayLabel(req.attendanceDate) || 'Pending',
          page: 'edit-approvals',
          tone: 'amber',
        });
      }

      for (const req of mine.requests || []) {
        if (!req?.id || seenReq.has(req.id)) continue;
        const status = String(req.status || '').toUpperCase();
        if (status !== 'PENDING' && status !== 'APPROVED') continue;
        seenReq.add(req.id);
        const { cls, date } = requestLabel(req);
        items.push({
          id: `edit-mine-${req.id}`,
          category: 'approval',
          title:
            status === 'APPROVED'
              ? 'Edit request approved — you can edit now'
              : 'Your edit request is pending',
          body: `${cls}${date ? ` · ${date}` : ''}`,
          time: relativeDayLabel(req.attendanceDate) || status,
          page: 'attendance',
          tone: status === 'APPROVED' ? 'emerald' : 'amber',
        });
      }
    } catch {
      // keep reminder + holidays
    }
  }

  try {
    const year = new Date(`${today}T12:00:00`).getFullYear();
    const upcoming = await getScheduledEvents(8, year);
    for (const ev of upcoming || []) {
      if (!ev?.date || ev.date < today) continue;
      const isHoliday =
        /holiday|sudden|sunday|govt/i.test(String(ev.type || '')) ||
        /holiday/i.test(String(ev.source || ''));
      items.push({
        id: `cal-${ev.id || ev.date}-${ev.title}`,
        category: isHoliday ? 'holiday' : 'event',
        title: isHoliday ? `Holiday: ${ev.title}` : ev.title,
        body: isHoliday
          ? `School holiday on ${formatAttendanceDate(ev.date)}. Attendance is blocked for this date.`
          : `Scheduled for ${formatAttendanceDate(ev.date)}.`,
        time: relativeDayLabel(ev.date),
        page: 'calendar',
        tone: isHoliday ? 'violet' : 'sky',
      });
    }
  } catch {
    // ignore calendar failures
  }

  const seen = readSeenIds();
  const withRead = items.map((n) => ({
    ...n,
    read: seen.has(String(n.id)),
  }));
  const unreadCount = withRead.filter((n) => !n.read).length;
  return { notifications: withRead, unreadCount };
}
