import { API_BASE, getToken, useMock } from './api.js';

const DOCUMENT_TYPES = [
  { value: 'leave_letter', label: 'Leave Letter' },
  { value: 'medical_leave', label: 'Medical Leave Letter' },
  { value: 'od_letter', label: 'OD / On Duty Letter' },
  { value: 'other', label: 'Other' },
];

export { DOCUMENT_TYPES };

export const LEAVE_REASONS = [
  'Family function / ceremony',
  'Medical appointment',
  'Personal work',
  'Out of station',
  'Other',
];

export const LEAVE_STATUSES = {
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 ring-red-200' },
};

const mockStore = new Map();

function mockKey(entityType, entityId) {
  return `${entityType}:${entityId}`;
}

function normalizeDocument(d) {
  return {
    id: d.id,
    entityType: d.entityType,
    entityId: d.entityId,
    documentType: d.documentType || 'leave_letter',
    fileName: d.fileName,
    mimeType: d.mimeType || null,
    fileSize: d.fileSize ?? null,
    uploadedBy: d.uploadedBy ?? null,
    leaveFrom: d.leaveFrom || null,
    leaveTo: d.leaveTo || null,
    reason: d.reason || null,
    notes: d.notes || null,
    status: d.status || 'pending',
    createdAt: d.createdAt || new Date().toISOString(),
  };
}

export function documentTypeLabel(value) {
  return DOCUMENT_TYPES.find((t) => t.value === value)?.label || 'Leave Letter';
}

export function formatFileSize(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function listDocuments(entityType, entityId) {
  if (useMock()) {
    const key = mockKey(entityType, entityId);
    return { documents: (mockStore.get(key) || []).map(normalizeDocument) };
  }
  const data = await fetchJson(
    `/api/documents?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
  );
  return { documents: (data.documents || []).map(normalizeDocument) };
}

export function leaveStatusLabel(status) {
  return LEAVE_STATUSES[status]?.label || 'Pending';
}

export async function uploadDocument({
  entityType,
  entityId,
  documentType,
  file,
  leaveFrom,
  leaveTo,
  reason,
  notes,
}) {
  if (useMock()) {
    const key = mockKey(entityType, entityId);
    const list = mockStore.get(key) || [];
    const doc = normalizeDocument({
      id: `mock-doc-${Date.now()}`,
      entityType,
      entityId,
      documentType: documentType || 'leave_letter',
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      leaveFrom,
      leaveTo,
      reason,
      notes,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    list.unshift(doc);
    mockStore.set(key, list);
    return { document: doc };
  }

  const form = new FormData();
  form.append('file', file);
  form.append('entityType', entityType);
  form.append('entityId', entityId);
  form.append('documentType', documentType || 'leave_letter');
  if (leaveFrom) form.append('leaveFrom', leaveFrom);
  if (leaveTo) form.append('leaveTo', leaveTo);
  if (reason) form.append('reason', reason);
  if (notes) form.append('notes', notes);

  const data = await fetchForm('/api/documents', form);
  return { document: normalizeDocument(data.document) };
}

export async function deleteDocument(documentId) {
  if (useMock()) {
    for (const [key, list] of mockStore.entries()) {
      const next = list.filter((d) => d.id !== documentId);
      if (next.length !== list.length) {
        mockStore.set(key, next);
        return { ok: true };
      }
    }
    return { ok: true };
  }
  return fetchJson(`/api/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
}

export function documentDownloadUrl(documentId, { inline = false } = {}) {
  const base = `${API_BASE}/api/documents/${encodeURIComponent(documentId)}/download`;
  return inline ? `${base}?inline=1` : base;
}

function isPreviewableMime(mimeType, fileName = '') {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return null;
}

export async function fetchDocumentBlob(documentId, { inline = false } = {}) {
  if (useMock()) {
    throw new Error('Preview is not available in mock mode');
  }
  const token = getToken();
  const res = await fetch(documentDownloadUrl(documentId, { inline }), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(inline ? 'Could not open document' : 'Download failed');
  }
  const blob = await res.blob();
  const contentType = res.headers.get('Content-Type') || blob.type || '';
  return { blob, contentType };
}

/** Open leave letter for on-screen viewing (does not force download). */
export async function viewDocument(documentId, { fileName, mimeType } = {}) {
  const { blob, contentType } = await fetchDocumentBlob(documentId, { inline: true });
  const type = contentType || mimeType || blob.type || '';
  const previewKind = isPreviewableMime(type, fileName);
  const url = URL.createObjectURL(blob);

  if (!previewKind) {
    // DOC/DOCX etc. — open in a new tab; browser may still offer download for unsupported types
    window.open(url, '_blank', 'noopener,noreferrer');
    // Revoke later so the new tab can load the blob
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { url: null, previewKind: null, revoked: true };
  }

  return { url, previewKind, mimeType: type, fileName: fileName || 'document' };
}

export async function downloadDocument(documentId, fileName) {
  if (useMock()) {
    alert(`Mock mode: download for ${fileName || documentId}`);
    return;
  }
  const { blob } = await fetchDocumentBlob(documentId, { inline: false });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'document';
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchJson(path, options = {}) {
  const headers = { Accept: 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

async function fetchForm(path, formData) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Upload failed');
    err.status = res.status;
    throw err;
  }
  return data;
}
