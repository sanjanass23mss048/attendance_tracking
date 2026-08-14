import { API_BASE, apiHeaders } from './api.js';

async function authHeaders(extra = {}) {
  return apiHeaders(extra);
}

async function parseJsonResponse(res) {
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
    err.data = data;
    throw err;
  }
  return data;
}

async function downloadBlob(path, fallbackName) {
  const headers = await authHeaders();
  delete headers.Accept;
  headers.Accept =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream';
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    let message = 'Download failed';
    try {
      const data = await res.json();
      message = data?.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const fileName = match?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadStudentImportTemplate() {
  return downloadBlob('/api/students/import/template', 'student-import-template.xlsx');
}

export async function validateStudentImportFile(file) {
  const form = new FormData();
  form.append('file', file);
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/students/import/validate`, {
    method: 'POST',
    headers,
    body: form,
  });
  return parseJsonResponse(res);
}

export async function confirmStudentImport(importId) {
  const headers = await authHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/students/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ importId }),
  });
  return parseJsonResponse(res);
}

export async function getStudentImportHistory(limit = 50) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/students/import/history?limit=${limit}`, {
    headers,
  });
  return parseJsonResponse(res);
}

export async function downloadStudentImportErrors(importId) {
  return downloadBlob(
    `/api/students/import/${encodeURIComponent(importId)}/errors`,
    `student-import-errors-${importId}.xlsx`
  );
}

export async function extractStudentsFromChitPhotos(files, { className = '', sectionName = '' } = {}) {
  const form = new FormData();
  for (const file of files) {
    form.append('photos', file);
  }
  if (className) form.append('className', className);
  if (sectionName) form.append('sectionName', sectionName);
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/students/import/chits`, {
    method: 'POST',
    headers,
    body: form,
  });
  return parseJsonResponse(res);
}

export async function validateStudentImportRows(rows, fileName = 'chit-extract.xlsx') {
  const headers = await authHeaders({ 'Content-Type': 'application/json' });
  const res = await fetch(`${API_BASE}/api/students/import/validate-rows`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rows, fileName }),
  });
  return parseJsonResponse(res);
}
