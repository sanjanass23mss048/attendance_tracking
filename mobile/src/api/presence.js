import { apiFetch, clearSession, getToken, setStoredUser, setToken } from './client';
import { API_BASE } from '../config';

export async function login({ email, password }) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    json: { email: String(email || '').trim(), password, rememberMe: true },
  });
  await setToken(data.token);
  await setStoredUser(data.user);
  return data;
}

export async function getMe() {
  return apiFetch('/api/me');
}

export async function logout() {
  await clearSession();
}

export async function getClasses() {
  return apiFetch('/api/classes');
}

export async function getAttendanceSummary(date) {
  return apiFetch(`/api/attendance/summary?date=${encodeURIComponent(date)}`);
}

export async function getDailyAttendance(sectionId, date) {
  const q = new URLSearchParams({ sectionId, date });
  return apiFetch(`/api/attendance/daily?${q}`);
}

/**
 * Save daily marks. Present (`P`) can be omitted — server treats missing as Present.
 * @param {{ sectionId: string, date: string, marks: { studentId: string, status: string }[] }} payload
 */
export async function saveDailyAttendance({ sectionId, date, marks }) {
  return apiFetch('/api/attendance/daily', {
    method: 'PUT',
    json: {
      sectionId,
      date,
      marks: (marks || []).filter((m) => m.status && m.status !== 'P'),
    },
  });
}

/**
 * Record + send parent SMS for non-present students.
 * @param {{
 *   sectionId: string,
 *   date: string,
 *   messages: { studentId: string, status: string, message?: string }[],
 * }} body
 */
export async function submitParentMessages(body) {
  return apiFetch('/api/attendance/parent-messages', {
    method: 'POST',
    json: body,
  });
}

export async function getStudents({ sectionId, q } = {}) {
  const params = new URLSearchParams();
  if (sectionId) params.set('sectionId', sectionId);
  if (q) params.set('q', q);
  return apiFetch(`/api/teacher-notifications/students?${params}`);
}

export async function getNotificationComposerOptions() {
  return apiFetch('/api/teacher-notifications/composer-options');
}

export async function previewTeacherNotification(payload) {
  return apiFetch('/api/teacher-notifications/preview', {
    method: 'POST',
    json: payload,
  });
}

/**
 * Create draft / schedule / send teacher notification.
 * Optional file via multipart FormData field `file` + JSON `payload`.
 */
export async function saveTeacherNotification(payload, file) {
  if (!file) {
    return apiFetch('/api/teacher-notifications', {
      method: 'POST',
      json: payload,
    });
  }
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  form.append('file', {
    uri: file.uri,
    name: file.name || 'attachment',
    type: file.mimeType || 'application/octet-stream',
  });
  const token = await getToken();
  const res = await fetch(`${API_BASE}/api/teacher-notifications`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}
