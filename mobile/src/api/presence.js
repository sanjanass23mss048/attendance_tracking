import { apiFetch, clearSession, setStoredUser, setToken } from './client';

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
