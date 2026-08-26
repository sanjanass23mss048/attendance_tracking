/** Shared timetable scheduling helpers (periods, settings, conflict checks). */

export const DEFAULT_TIMETABLE_SETTINGS = {
  startTime: '08:45',
  periodCount: 8,
  periodDurationMinutes: 45,
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  breaks: [
    { afterPeriod: 3, label: 'Short Break', durationMinutes: 15 },
    { afterPeriod: 5, label: 'Lunch Break', durationMinutes: 45 },
  ],
};

export const SLOT_TYPES = ['teacher', 'subject', 'library', 'activity'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseHm(hm) {
  const m = String(hm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { h: 8, min: 45 };
  return { h: Number(m[1]), min: Number(m[2]) };
}

function addMinutes(h, min, add) {
  let total = h * 60 + min + add;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return { h: Math.floor(total / 60), min: total % 60 };
}

function formatRange12(startH, startM, endH, endM) {
  const fmt = (h, m, withAmPm = true) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return withAmPm ? `${h12}:${pad2(m)} ${ampm}` : `${h12}:${pad2(m)}`;
  };
  const sameAmPm = startH < 12 === endH < 12;
  if (sameAmPm) {
    return `${fmt(startH, startM, false)} - ${fmt(endH, endM, true)}`;
  }
  return `${fmt(startH, startM)} - ${fmt(endH, endM)}`;
}

export function normalizeTimetableSettings(raw) {
  const base = { ...DEFAULT_TIMETABLE_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
  const periodCount = Math.min(12, Math.max(1, Number(base.periodCount) || 8));
  const periodDurationMinutes = Math.min(120, Math.max(20, Number(base.periodDurationMinutes) || 45));
  const startTime = /^\d{1,2}:\d{2}$/.test(String(base.startTime || ''))
    ? String(base.startTime)
    : DEFAULT_TIMETABLE_SETTINGS.startTime;
  const workingDays = Array.isArray(base.workingDays) && base.workingDays.length
    ? base.workingDays.map(String)
    : [...DEFAULT_TIMETABLE_SETTINGS.workingDays];
  const breaks = Array.isArray(base.breaks)
    ? base.breaks
        .map((b) => ({
          afterPeriod: Number(b.afterPeriod),
          label: String(b.label || 'Break'),
          durationMinutes: Math.min(120, Math.max(5, Number(b.durationMinutes) || 15)),
        }))
        .filter((b) => Number.isFinite(b.afterPeriod) && b.afterPeriod >= 1 && b.afterPeriod < periodCount)
    : [...DEFAULT_TIMETABLE_SETTINGS.breaks];
  return { startTime, periodCount, periodDurationMinutes, workingDays, breaks };
}

/** Build PERIOD_TIMES-compatible slots from settings. */
export function buildPeriodSlots(settingsInput) {
  const settings = normalizeTimetableSettings(settingsInput);
  const { h: startH, min: startM } = parseHm(settings.startTime);
  let cursorH = startH;
  let cursorM = startM;
  const slots = [];
  const breakAfter = new Map(settings.breaks.map((b) => [b.afterPeriod, b]));

  for (let p = 1; p <= settings.periodCount; p += 1) {
    const end = addMinutes(cursorH, cursorM, settings.periodDurationMinutes);
    slots.push({
      period: p,
      time: formatRange12(cursorH, cursorM, end.h, end.min),
      kind: 'period',
      start: `${pad2(cursorH)}:${pad2(cursorM)}`,
      end: `${pad2(end.h)}:${pad2(end.min)}`,
    });
    cursorH = end.h;
    cursorM = end.min;
    const br = breakAfter.get(p);
    if (br) {
      const bend = addMinutes(cursorH, cursorM, br.durationMinutes);
      slots.push({
        period: null,
        time: formatRange12(cursorH, cursorM, bend.h, bend.min),
        kind: 'break',
        label: br.label,
        start: `${pad2(cursorH)}:${pad2(cursorM)}`,
        end: `${pad2(bend.h)}:${pad2(bend.min)}`,
      });
      cursorH = bend.h;
      cursorM = bend.min;
    }
  }
  return slots;
}

export function isBreakSlot(slot) {
  return slot?.kind === 'break';
}

function emptyCell() {
  return {
    subject: '',
    teacher: '',
    teacherId: null,
    subjectId: null,
    teacherSubjectId: null,
    slotType: null,
  };
}

function cloneCell(cell) {
  if (!cell || typeof cell !== 'object') return emptyCell();
  const slotType = SLOT_TYPES.includes(cell.slotType) ? cell.slotType : null;
  return {
    subject: cell.subject || '',
    teacher: cell.teacher || '',
    teacherId: cell.teacherId || null,
    subjectId: cell.subjectId || null,
    teacherSubjectId: cell.teacherSubjectId || null,
    slotType:
      slotType ||
      (cell.teacher || cell.teacherId
        ? 'teacher'
        : cell.subject
          ? String(cell.subject).toLowerCase() === 'library'
            ? 'library'
            : 'subject'
          : null),
  };
}

export function buildEmptyGrid(dayCount, periodSlots) {
  const days = Math.max(1, dayCount || 5);
  return (periodSlots || []).map((slot) =>
    isBreakSlot(slot) ? Array.from({ length: days }, () => null) : Array.from({ length: days }, () => emptyCell())
  );
}

/**
 * Align stored grid to current period slots + working day count.
 * Does not inject demo subjects — empty when missing.
 */
export function normalizeSchedulingGrid(grid, periodSlots, dayCount) {
  const days = Math.max(1, dayCount || 5);
  const slots = periodSlots || [];
  if (!Array.isArray(grid) || grid.length === 0) {
    return buildEmptyGrid(days, slots);
  }

  const teachingRows = [];
  for (const row of grid) {
    if (!Array.isArray(row)) continue;
    const looksBreak = row.every((c) => c == null);
    if (looksBreak && teachingRows.length > 0) continue;
    teachingRows.push(
      Array.from({ length: days }, (_, d) => cloneCell(row[d]))
    );
  }

  let ti = 0;
  return slots.map((slot) => {
    if (isBreakSlot(slot)) return Array.from({ length: days }, () => null);
    const row = teachingRows[ti] || Array.from({ length: days }, () => emptyCell());
    ti += 1;
    return Array.from({ length: days }, (_, d) => cloneCell(row[d]));
  });
}

/** Extract teaching-period cells: [{ dayIndex, periodNumber, cell }] */
export function flattenTeachingAssignments(grid, periodSlots) {
  const out = [];
  if (!Array.isArray(grid) || !Array.isArray(periodSlots)) return out;
  periodSlots.forEach((slot, pi) => {
    if (isBreakSlot(slot) || !slot.period) return;
    const row = grid[pi] || [];
    row.forEach((cell, dayIndex) => {
      if (!cell || typeof cell !== 'object') return;
      const hasTeacher = Boolean(cell.teacherId || cell.teacher);
      const hasSubject = Boolean(cell.subjectId || cell.subject);
      if (!hasTeacher && !hasSubject && !cell.slotType) return;
      out.push({ dayIndex, periodNumber: slot.period, periodIndex: pi, cell });
    });
  });
  return out;
}

export function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export function parseSubjectNames(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,;/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
