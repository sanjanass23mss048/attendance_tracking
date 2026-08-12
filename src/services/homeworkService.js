const STORAGE_KEY = 'presence_homework_assignments_v1';

export function listHomeworkAssignments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHomeworkAssignment(entry) {
  const list = listHomeworkAssignments();
  const next = [
    {
      id: `HW-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...entry,
    },
    ...list,
  ].slice(0, 200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next[0];
}

export function clearHomeworkAssignments() {
  localStorage.removeItem(STORAGE_KEY);
}
