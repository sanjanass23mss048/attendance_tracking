import { apiFetch } from './api.js';

export async function listTcRequests(status) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch(`/api/tc-requests${qs}`);
}

export async function forwardTcRequest(id) {
  return apiFetch(`/api/tc-requests/${encodeURIComponent(id)}/forward`, {
    method: 'POST',
    json: {},
  });
}

export async function approveTcRequest(id, note) {
  return apiFetch(`/api/tc-requests/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    json: { note: note || undefined },
  });
}

export async function rejectTcRequest(id, note) {
  return apiFetch(`/api/tc-requests/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    json: { note: note || undefined },
  });
}

export function tcStatusLabel(status) {
  switch (String(status || '').toUpperCase()) {
    case 'REQUESTED':
      return 'Waiting on teacher';
    case 'FORWARDED':
      return 'Waiting on management';
    case 'APPROVED':
      return 'Approved — student inactive';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status || 'Unknown';
  }
}

export function tcStatusClass(status) {
  switch (String(status || '').toUpperCase()) {
    case 'REQUESTED':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'FORWARDED':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'APPROVED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}
