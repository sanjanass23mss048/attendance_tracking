import { apiFetch } from './api.js';

export async function getEditContext({ sectionId, date }) {
  const qs = new URLSearchParams({ sectionId, date });
  return apiFetch(`/api/attendance-edit-requests/context?${qs}`);
}

export async function createEditRequest({ sectionId, attendanceDate, reason }) {
  return apiFetch('/api/attendance-edit-requests', {
    method: 'POST',
    json: { sectionId, attendanceDate, reason },
  });
}

export async function getMyEditRequests() {
  return apiFetch('/api/attendance-edit-requests/my-requests');
}

export async function getPendingEditRequests() {
  return apiFetch('/api/attendance-edit-requests/pending');
}

export async function getEditRequestStatus(id) {
  return apiFetch(`/api/attendance-edit-requests/${encodeURIComponent(id)}/status`);
}

export async function approveEditRequest(id) {
  return apiFetch(`/api/attendance-edit-requests/${encodeURIComponent(id)}/approve`, {
    method: 'PATCH',
    json: {},
  });
}

export async function denyEditRequest(id, denyReason = '') {
  return apiFetch(`/api/attendance-edit-requests/${encodeURIComponent(id)}/deny`, {
    method: 'PATCH',
    json: { denyReason: denyReason || null },
  });
}

export function editStatusLabel(status) {
  switch (String(status || '').toUpperCase()) {
    case 'PENDING':
      return 'Waiting for Approval';
    case 'APPROVED':
      return 'Approved – Edit Now';
    case 'DENIED':
      return 'Request Denied';
    case 'EXPIRED':
      return 'Permission Expired';
    case 'USED':
      return 'Edit Completed';
    default:
      return status || '—';
  }
}

export function editStatusClass(status) {
  switch (String(status || '').toUpperCase()) {
    case 'PENDING':
      return 'bg-amber-50 text-amber-800 ring-amber-200';
    case 'APPROVED':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    case 'DENIED':
      return 'bg-red-50 text-red-700 ring-red-200';
    case 'EXPIRED':
      return 'bg-gray-100 text-gray-600 ring-gray-200';
    case 'USED':
      return 'bg-indigo-50 text-indigo-800 ring-indigo-200';
    default:
      return 'bg-gray-50 text-gray-600 ring-gray-200';
  }
}
