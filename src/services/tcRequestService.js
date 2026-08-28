import { apiFetch, API_BASE, apiHeaders } from './api.js';

export async function listTcRequests({ status, dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const qs = params.toString();
  return apiFetch(`/api/tc-requests${qs ? `?${qs}` : ''}`);
}

export async function getTcRequest(id) {
  return apiFetch(`/api/tc-requests/${encodeURIComponent(id)}`);
}

export async function createTcRequest({ studentClassId, reason, source }) {
  return apiFetch('/api/tc-requests', {
    method: 'POST',
    json: {
      studentClassId,
      reason: reason || undefined,
      source: source || 'STAFF',
    },
  });
}

export async function verifyTcRequest(id) {
  return apiFetch(`/api/tc-requests/${encodeURIComponent(id)}/verify`, {
    method: 'POST',
    json: {},
  });
}

/** @deprecated Prefer verifyTcRequest */
export async function forwardTcRequest(id) {
  return verifyTcRequest(id);
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

export async function generateTcRequest(id, { signerName, signerDesignation, signatureDataUrl } = {}) {
  return apiFetch(`/api/tc-requests/${encodeURIComponent(id)}/generate`, {
    method: 'POST',
    json: {
      signerName: signerName || undefined,
      signerDesignation: signerDesignation || undefined,
      signatureDataUrl: signatureDataUrl || undefined,
    },
  });
}

export async function fetchTcPreviewHtml(id) {
  const preview = await fetchTcPreview(id);
  if (preview.kind !== 'html') {
    throw new Error('This TC is a file — use preview or download');
  }
  return preview.html;
}

export async function fetchTcPreview(id) {
  const res = await fetch(`${API_BASE}/api/tc-requests/${encodeURIComponent(id)}/preview`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    let message = 'Could not load TC preview';
    try {
      const data = await res.json();
      message = data?.error || message;
    } catch {
      // ignore
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  const contentType = String(res.headers.get('Content-Type') || '').toLowerCase();
  const blob = await res.blob();
  if (contentType.includes('pdf')) return { kind: 'pdf', blob };
  if (contentType.startsWith('image/')) return { kind: 'image', blob };
  const html = await blob.text();
  return { kind: 'html', html };
}

export async function getTcSignatureSettings() {
  return apiFetch('/api/tc-requests/signature-settings');
}

export async function getTcWorkflowSettings() {
  return apiFetch('/api/tc-requests/workflow-settings');
}

export async function saveTcWorkflowSettings({ managementApproval, tcMethod } = {}) {
  return apiFetch('/api/tc-requests/workflow-settings', {
    method: 'PUT',
    json: { managementApproval, tcMethod },
  });
}

export async function saveTcSignatureSettings({
  signerName,
  signerDesignation,
  file,
  signatureDataUrl,
} = {}) {
  const form = new FormData();
  if (signerName != null) form.append('signerName', signerName);
  if (signerDesignation != null) form.append('signerDesignation', signerDesignation);
  if (file) form.append('signature', file);
  if (signatureDataUrl) form.append('signatureDataUrl', signatureDataUrl);
  return apiFetch('/api/tc-requests/signature-settings', {
    method: 'PUT',
    body: form,
  });
}

export async function uploadTcRequest(id, file) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch(`/api/tc-requests/${encodeURIComponent(id)}/upload`, {
    method: 'POST',
    body: form,
  });
}

export async function downloadTcRequest(id) {
  const res = await fetch(`${API_BASE}/api/tc-requests/${encodeURIComponent(id)}/download`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    let message = 'Could not download TC';
    try {
      const data = await res.json();
      message = data?.error || message;
    } catch {
      // ignore
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/i.exec(cd);
  const filename = match?.[1] || `TC-${id}.html`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * UI status labels aligned with mockup + pipeline:
 * Requested → (Teacher Verified column) → Pending Approval → Approved → TC Issued → Inactive
 */
export function tcStatusLabel(status) {
  switch (String(status || '').toUpperCase()) {
    case 'REQUESTED':
      return 'Requested';
    case 'FORWARDED':
      return 'Pending Approval';
    case 'APPROVED':
      return 'Approved';
    case 'TC_ISSUED':
      return 'TC Issued';
    case 'INACTIVE':
      return 'Inactive';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status || 'Unknown';
  }
}

export function tcStatusClass(status) {
  switch (String(status || '').toUpperCase()) {
    case 'REQUESTED':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'FORWARDED':
      return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'APPROVED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'TC_ISSUED':
      return 'bg-violet-50 text-violet-800 border-violet-200';
    case 'INACTIVE':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-800 border-rose-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export const TC_STATUS_FILTERS = [
  { value: '', label: 'All Status' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'FORWARDED', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'TC_ISSUED', label: 'TC Issued' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'REJECTED', label: 'Rejected' },
];
