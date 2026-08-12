import { apiFetch } from './api.js';

/**
 * @param {object} [filters]
 * @param {string} [filters.category]
 * @param {string} [filters.action]
 * @param {string} [filters.actor]
 * @param {string} [filters.q]
 * @param {string} [filters.from] ISO or YYYY-MM-DD
 * @param {string} [filters.to]
 * @param {boolean|string} [filters.success]
 * @param {number} [filters.limit]
 * @param {number} [filters.offset]
 */
export async function listAuditLogs(filters = {}) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    qs.set(key, String(value));
  });
  const query = qs.toString();
  return apiFetch(`/api/admin/audit-logs${query ? `?${query}` : ''}`);
}

export async function getAuditLogMeta() {
  return apiFetch('/api/admin/audit-logs/meta');
}

export function formatAuditWhen(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

export function categoryBadgeClass(category) {
  switch (String(category || '').toUpperCase()) {
    case 'AUTH':
      return 'bg-slate-100 text-slate-800 ring-slate-200';
    case 'ATTENDANCE':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    case 'NOTIFICATION':
      return 'bg-sky-50 text-sky-800 ring-sky-200';
    case 'NOTICE':
      return 'bg-indigo-50 text-indigo-800 ring-indigo-200';
    case 'STUDENT':
      return 'bg-amber-50 text-amber-900 ring-amber-200';
    case 'TEACHER':
      return 'bg-violet-50 text-violet-800 ring-violet-200';
    case 'HOLIDAY':
    case 'CALENDAR':
      return 'bg-rose-50 text-rose-800 ring-rose-200';
    case 'DIARY':
      return 'bg-teal-50 text-teal-800 ring-teal-200';
    case 'TIMETABLE':
      return 'bg-cyan-50 text-cyan-900 ring-cyan-200';
    case 'APPROVAL':
      return 'bg-orange-50 text-orange-900 ring-orange-200';
    case 'IMPORT':
      return 'bg-fuchsia-50 text-fuchsia-900 ring-fuchsia-200';
    default:
      return 'bg-gray-100 text-gray-700 ring-gray-200';
  }
}
