/**
 * Presence mobile — talks to the same Express API as the web app.
 *
 * Override at runtime with EXPO_PUBLIC_API_URL if needed.
 * Default: production VPS.
 */
export const API_BASE = (
  process.env.EXPO_PUBLIC_API_URL ||
  'https://attendance.rioassetmanagement.net'
).replace(/\/$/, '');

export const APP_NAME = 'Presence';

export const FULL_ACCESS_ROLES = new Set([
  'INCHARGE',
  'ADMIN',
  'PRINCIPAL',
  'VICE_PRINCIPAL',
  'HEADMASTER',
  'HOD',
]);

export const STATUS_OPTIONS = [
  { code: 'P', label: 'Present', color: '#22c55e' },
  { code: 'A', label: 'Absent', color: '#ef4444' },
  { code: 'L', label: 'Late', color: '#f59e0b' },
  { code: 'H', label: 'Half Day', color: '#8b5cf6' },
  { code: 'OH', label: 'OD Half', color: '#06b6d4' },
  { code: 'OF', label: 'OD Full', color: '#0f766e' },
];

export function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
