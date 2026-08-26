import { apiFetch } from './api.js';
import {
  buildEmptyGrid,
  buildPeriodSlots,
  normalizeTimetableSettings,
} from '../data/timetableScheduling.js';

export async function getSchedulingTimetable(classSectionId) {
  const data = await apiFetch(
    `/api/timetable?classSectionId=${encodeURIComponent(classSectionId)}&mode=scheduling`
  );
  return data.timetable || {};
}

export async function saveSchedulingTimetable(classSectionId, grid, extra = {}) {
  const data = await apiFetch('/api/timetable', {
    method: 'PUT',
    json: {
      classSectionId,
      grid,
      mode: 'scheduling',
      className: extra.className || undefined,
      sectionName: extra.sectionName || undefined,
    },
  });
  return data.timetable || {};
}

export async function deleteTimetableAssignment(classSectionId, dayIndex, periodIndex) {
  const data = await apiFetch('/api/timetable/assignment', {
    method: 'DELETE',
    json: { classSectionId, dayIndex, periodIndex },
  });
  return data.timetable || {};
}

export async function getSchedulingTeachers() {
  const data = await apiFetch('/api/timetable/teachers');
  return data.teachers || [];
}

export async function getSchedulingSubjects() {
  const data = await apiFetch('/api/timetable/subjects');
  return data.subjects || [];
}

export async function getTeacherSubjects() {
  const data = await apiFetch('/api/timetable/teacher-subjects');
  return data.mappings || [];
}

export async function getTimetableSettings() {
  const data = await apiFetch('/api/timetable/settings');
  const settings = normalizeTimetableSettings(data.settings);
  return {
    settings,
    periods: data.periods?.length ? data.periods : buildPeriodSlots(settings),
    slotTypes: data.slotTypes || ['teacher', 'subject', 'library', 'activity'],
  };
}

export async function saveTimetableSettings(settings) {
  const data = await apiFetch('/api/timetable/settings', {
    method: 'PUT',
    json: { settings: normalizeTimetableSettings(settings) },
  });
  return {
    settings: normalizeTimetableSettings(data.settings),
    periods: data.periods || buildPeriodSlots(data.settings),
  };
}

export async function getTeacherAvailability(teacherId) {
  const data = await apiFetch(
    `/api/timetable/teacher-availability?teacherId=${encodeURIComponent(teacherId)}`
  );
  return data;
}

export async function validateSchedulingTimetable(classSectionId, grid) {
  const data = await apiFetch('/api/timetable/validate', {
    method: 'POST',
    json: { classSectionId, grid },
  });
  return data;
}

export function emptyFromSettings(settings) {
  const normalized = normalizeTimetableSettings(settings);
  const periods = buildPeriodSlots(normalized);
  return {
    days: normalized.workingDays,
    periods,
    grid: buildEmptyGrid(normalized.workingDays.length, periods),
    settings: normalized,
  };
}
