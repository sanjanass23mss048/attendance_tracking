import { apiFetch } from './api.js';

export function getIntelligenceSummary(params = {}) {
  const q = new URLSearchParams();
  if (params.asOf) q.set('asOf', params.asOf);
  if (params.demo) q.set('demo', '1');
  const suffix = q.toString() ? `?${q}` : '';
  return apiFetch(`/api/attendance-intelligence/summary${suffix}`);
}

export function getIntelligenceOverview(params = {}) {
  const q = new URLSearchParams();
  if (params.asOf) q.set('asOf', params.asOf);
  if (params.demo) q.set('demo', '1');
  const suffix = q.toString() ? `?${q}` : '';
  return apiFetch(`/api/attendance-intelligence/overview${suffix}`);
}

export function getIntelligenceThresholds() {
  return apiFetch('/api/attendance-intelligence/thresholds');
}

export function saveIntelligenceThresholds(thresholds) {
  return apiFetch('/api/attendance-intelligence/thresholds', {
    method: 'PUT',
    json: thresholds,
  });
}

export function getMeetingPrefill(studentClassId) {
  return apiFetch(`/api/attendance-intelligence/meeting-prefill/${encodeURIComponent(studentClassId)}`);
}

export function listIntelligenceMeetings(params = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.studentClassId) q.set('studentClassId', params.studentClassId);
  if (params.followUpOnly) q.set('followUpOnly', '1');
  const suffix = q.toString() ? `?${q}` : '';
  return apiFetch(`/api/attendance-intelligence/meetings${suffix}`);
}

export function createIntelligenceMeeting(payload) {
  return apiFetch('/api/attendance-intelligence/meetings', {
    method: 'POST',
    json: payload,
  });
}

export function updateIntelligenceMeeting(id, payload) {
  return apiFetch(`/api/attendance-intelligence/meetings/${id}`, {
    method: 'PATCH',
    json: payload,
  });
}

export function getStudentAttendanceTimeline(studentClassId, params = {}) {
  const q = new URLSearchParams();
  if (params.days) q.set('days', String(params.days));
  const suffix = q.toString() ? `?${q}` : '';
  return apiFetch(`/api/attendance-intelligence/students/${studentClassId}/timeline${suffix}`);
}

export function addStudentAttendanceNote(studentClassId, text) {
  return apiFetch(`/api/attendance-intelligence/students/${studentClassId}/notes`, {
    method: 'POST',
    json: { text },
  });
}
