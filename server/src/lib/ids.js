import { randomBytes } from 'crypto';

/** Short opaque id suitable for VarChar(50) PKs. */
export function newId(prefix = '') {
  const hex = randomBytes(12).toString('hex'); // 24 chars
  const id = prefix ? `${prefix}${hex}` : hex;
  return id.slice(0, 50);
}

/** Deterministic attendance header id for a class-section + date. */
export function attendanceHeaderId(classSectionId, dateStr) {
  const compact = dateStr.replace(/-/g, '');
  const id = `ATT-${compact}-${classSectionId}`;
  return id.length <= 50 ? id : id.slice(0, 50);
}

/** Reverse of attendanceHeaderId — extract class-section id from header PK. */
export function sectionIdFromAttendanceId(attendanceId, dateStr) {
  const prefix = `ATT-${dateStr.replace(/-/g, '')}-`;
  if (!attendanceId.startsWith(prefix)) return null;
  return attendanceId.slice(prefix.length) || null;
}

export function parseDateOnly(value) {
  if (value == null || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateString(date) {
  if (!date) return null;
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function fullName(first, last) {
  return [first, last].filter(Boolean).join(' ').trim();
}

export function splitFullName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/);
  if (!parts.length || !parts[0]) return { first: 'Student', last: null };
  return { first: parts[0], last: parts.slice(1).join(' ') || null };
}

export const DAILY_SESSION = 'D';
export const DEFAULT_PERIOD_COUNT = 8;

export function sessionForPeriod(periodNo) {
  return String(periodNo);
}

export function periodFromSession(session) {
  if (session == null || session === DAILY_SESSION) return null;
  const n = Number(session);
  return Number.isInteger(n) && n > 0 ? n : null;
}
