import crypto from 'crypto';

/** Today's date as YYYY-MM-DD in Asia/Kolkata (school timezone). */
export function todayYmd(timeZone = process.env.SCHOOL_TIMEZONE || 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function isSameDayAttendance(dateStr) {
  return String(dateStr) === todayYmd();
}

export function isPastAttendanceDate(dateStr) {
  return String(dateStr) < todayYmd();
}

export function isFutureAttendanceDate(dateStr) {
  return String(dateStr) > todayYmd();
}

export const EDIT_PERMISSION_MINUTES = Number(process.env.EDIT_PERMISSION_MINUTES) || 30;

export const APPROVER_ROLES = new Set([
  'INCHARGE',
  'HOD',
  'VICE_PRINCIPAL',
  'PRINCIPAL',
  'ADMIN',
]);

export const TEACHER_ROLES = new Set(['TEACHER']);

export function canBypassEditLock(role) {
  const r = String(role || '').toUpperCase();
  return r === 'ADMIN' || r === 'PRINCIPAL';
}

export function isApproverRole(role) {
  return APPROVER_ROLES.has(String(role || '').toUpperCase());
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

export function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return process.env.NODE_ENV !== 'production';
  if (!signatureHeader || !rawBody) return false;
  const expected = signatureHeader.replace(/^sha256=/i, '');
  const digest = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(digest, 'hex'));
  } catch {
    return false;
  }
}
