import { apiFetch, API_BASE, getToken } from './api.js';

export async function getNotificationComposerOptions() {
  return apiFetch('/api/teacher-notifications/composer-options');
}

export async function getNotificationStudents({ sectionId, q } = {}) {
  const params = new URLSearchParams();
  if (sectionId) params.set('sectionId', sectionId);
  if (q) params.set('q', q);
  return apiFetch(`/api/teacher-notifications/students?${params}`);
}

export async function previewTeacherNotification(payload) {
  return apiFetch('/api/teacher-notifications/preview', {
    method: 'POST',
    json: payload,
  });
}

export async function saveTeacherNotification(payload, file) {
  if (!file) {
    return apiFetch('/api/teacher-notifications', {
      method: 'POST',
      json: payload,
    });
  }
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  form.append('file', file);
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/teacher-notifications`, {
    method: 'POST',
    headers,
    body: form,
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
    throw new Error(data?.error || 'Could not save notification');
  }
  return data;
}
