/** Client-side helpers for drag-drop timetable scheduling (mirrors server). */

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

export const SLOT_TYPES = [
  { id: 'teacher', label: 'Teacher', className: 'bg-indigo-100 text-indigo-900 border-indigo-200' },
  { id: 'subject', label: 'Subject', className: 'bg-sky-100 text-sky-900 border-sky-200' },
  { id: 'library', label: 'Library', className: 'bg-yellow-100 text-yellow-900 border-yellow-200' },
  { id: 'activity', label: 'Activity', className: 'bg-amber-100 text-amber-900 border-amber-200' },
];

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
  const workingDays =
    Array.isArray(base.workingDays) && base.workingDays.length
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

export function emptyCell() {
  return {
    subject: '',
    teacher: '',
    teacherId: null,
    subjectId: null,
    teacherSubjectId: null,
    slotType: null,
  };
}

export function buildEmptyGrid(dayCount, periodSlots) {
  const days = Math.max(1, dayCount || 5);
  return (periodSlots || []).map((slot) =>
    isBreakSlot(slot)
      ? Array.from({ length: days }, () => null)
      : Array.from({ length: days }, () => emptyCell())
  );
}

export function cloneGrid(grid) {
  return (grid || []).map((row) =>
    (row || []).map((cell) => (cell && typeof cell === 'object' ? { ...cell } : cell))
  );
}

export function gridsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
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

export function slotTypeClass(slotType) {
  return SLOT_TYPES.find((s) => s.id === slotType)?.className || 'bg-indigo-50 text-indigo-900 border-indigo-100';
}

export function cellHasContent(cell) {
  if (!cell || typeof cell !== 'object') return false;
  return Boolean(cell.teacher || cell.teacherId || cell.subject || cell.subjectId || cell.slotType);
}

/** Local conflict check within current grid + optional remote occupancy snapshot. */
export function findLocalTeacherConflicts(grid, periods, days, occupancyByTeacher = {}) {
  const conflicts = [];
  const seen = new Map();
  periods.forEach((slot, pi) => {
    if (isBreakSlot(slot) || !slot.period) return;
    (grid[pi] || []).forEach((cell, dayIndex) => {
      if (!cellHasContent(cell)) return;
      const tid = cell.teacherId || null;
      const tname = cell.teacher || '';
      if (!tid && !tname) return;
      const key = `${tid || tname.toLowerCase()}|${dayIndex}|${slot.period}`;
      if (seen.has(key)) {
        conflicts.push(
          `${tname || 'Teacher'} assigned twice on ${days[dayIndex]} Period ${slot.period}`
        );
      } else {
        seen.set(key, true);
      }
      const occKey = tid || `name:${tname.toLowerCase()}`;
      const remote = occupancyByTeacher[occKey]?.[dayIndex]?.[slot.period];
      if (remote?.length) {
        conflicts.push(
          `${tname || 'Teacher'} already teaching ${remote[0].classLabel} on ${days[dayIndex]} Period ${slot.period}`
        );
      }
    });
  });
  return [...new Set(conflicts)];
}

export function teacherAllowsSubject(teacher, subjectName, subjectId) {
  if (!teacher) return false;
  const names = (teacher.subjectNames || teacher.subjects?.map((s) => s.name) || []).map((n) =>
    String(n).toLowerCase()
  );
  if (!names.length) return true; // no mapping yet — allow
  if (subjectId && teacher.subjects?.some((s) => s.subjectId === subjectId)) return true;
  if (subjectName && names.includes(String(subjectName).toLowerCase())) return true;
  return false;
}

export function subjectsForTeacher(teacher, allSubjects) {
  if (!teacher) return allSubjects || [];
  const mapped = teacher.subjects?.filter((s) => s.subjectId || s.name) || [];
  if (!mapped.length) return allSubjects || [];
  if (mapped.some((s) => s.subjectId)) {
    const ids = new Set(mapped.map((s) => s.subjectId).filter(Boolean));
    const names = new Set(mapped.map((s) => String(s.name || '').toLowerCase()));
    return (allSubjects || []).filter(
      (s) => ids.has(s.id) || names.has(String(s.name).toLowerCase())
    );
  }
  const names = new Set(mapped.map((s) => String(s.name).toLowerCase()));
  return (allSubjects || []).filter((s) => names.has(String(s.name).toLowerCase()));
}

export function teachersForSubject(subject, allTeachers) {
  if (!subject) return allTeachers || [];
  const sid = subject.id;
  const sname = String(subject.name || '').toLowerCase();
  const filtered = (allTeachers || []).filter((t) => {
    const names = (t.subjectNames || t.subjects?.map((s) => s.name) || []).map((n) =>
      String(n).toLowerCase()
    );
    if (!names.length && !(t.subjects || []).length) return true;
    if (t.subjects?.some((s) => s.subjectId === sid)) return true;
    return names.includes(sname);
  });
  return filtered.length ? filtered : allTeachers || [];
}
