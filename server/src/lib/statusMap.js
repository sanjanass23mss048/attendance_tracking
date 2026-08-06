import { prisma } from './prisma.js';

/** App status codes ↔ tblAttendanceStatus rows (Status_id = code). */
export const STATUS_DEFS = [
  { Status_id: 'P', Text: 'Present' },
  { Status_id: 'A', Text: 'Absent' },
  { Status_id: 'L', Text: 'Late' },
  { Status_id: 'H', Text: 'Half Day' },
  { Status_id: 'OH', Text: 'OD - Half Day' },
  { Status_id: 'OF', Text: 'OD - Full Day' },
];

const ALLOWED = new Set(STATUS_DEFS.map((s) => s.Status_id));

let cache = null;

/** Legacy On Duty (`O`) maps to OD - Full Day (`OF`). */
export function normalizeAppStatus(code) {
  if (code === 'O') return 'OF';
  return code;
}

export function isAppStatus(code) {
  return ALLOWED.has(normalizeAppStatus(code));
}

/** Present is implied by absence of a stored daily mark (Status_id P is not persisted). */
export function isPresentStatus(code) {
  const normalized = normalizeAppStatus(code);
  return !normalized || normalized === 'P';
}

export function statusIdFromCode(code) {
  const normalized = normalizeAppStatus(code);
  if (!ALLOWED.has(normalized)) {
    throw new Error(`Unknown attendance status: ${code}`);
  }
  return normalized;
}

export function codeFromStatusId(statusId) {
  if (statusId === 'O') return 'OF';
  if (ALLOWED.has(statusId)) return statusId;
  return null;
}

/** Ensure P/A/L/H/OH/OF rows exist; never deletes existing statuses (legacy O kept if present). */
export async function ensureAttendanceStatuses() {
  for (const row of STATUS_DEFS) {
    await prisma.tblAttendanceStatus.upsert({
      where: { Status_id: row.Status_id },
      create: row,
      update: { Text: row.Text },
    });
  }
  cache = Object.fromEntries(STATUS_DEFS.map((s) => [s.Status_id, s.Status_id]));
  return cache;
}

export async function getStatusMap() {
  if (cache) return cache;
  const rows = await prisma.tblAttendanceStatus.findMany();
  const byId = Object.fromEntries(rows.map((r) => [r.Status_id, r.Status_id]));
  const byText = Object.fromEntries(
    rows.map((r) => [String(r.Text || '').toUpperCase(), r.Status_id])
  );

  // Prefer Status_id === code; fall back to Text match.
  const map = {};
  for (const def of STATUS_DEFS) {
    map[def.Status_id] =
      byId[def.Status_id] ||
      byText[def.Text.toUpperCase()] ||
      byText[def.Status_id] ||
      null;
  }

  if (Object.values(map).some((v) => !v)) {
    await ensureAttendanceStatuses();
    return getStatusMap();
  }

  cache = map;
  return cache;
}
