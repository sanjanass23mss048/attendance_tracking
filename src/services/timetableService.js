import { apiFetch } from './api.js';
import { normalizeWeeklyGrid } from '../data/timetableData.js';

export async function getTimetable(classSectionId) {
  const data = await apiFetch(
    `/api/timetable?classSectionId=${encodeURIComponent(classSectionId)}`
  );
  const timetable = data.timetable || {};
  return {
    ...timetable,
    grid: normalizeWeeklyGrid(timetable.grid),
  };
}

export async function saveTimetable(classSectionId, grid, extra = {}) {
  const data = await apiFetch('/api/timetable', {
    method: 'PUT',
    json: {
      classSectionId,
      grid: normalizeWeeklyGrid(grid),
      className: extra.className || undefined,
      sectionName: extra.sectionName || undefined,
    },
  });
  const timetable = data.timetable || {};
  return {
    ...timetable,
    grid: normalizeWeeklyGrid(timetable.grid),
  };
}
